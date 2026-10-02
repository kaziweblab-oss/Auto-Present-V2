import { Router } from "express";
import { z } from "zod";
import { PERMISSIONS, ROLES, type Permission } from "@auto-present-v2/shared";
import { User, Department, audit } from "./models.js";
import { dbOk } from "./db-guard.js";
import {
  hydrateScope,
  myPermissions,
  requireAuth,
  requirePermission,
  type AuthedRequest,
} from "./rbac.js";

export const authRouter = Router();
authRouter.use(requireAuth);
authRouter.use(hydrateScope);

// Who am I + what can I do (all authenticated roles).
authRouter.get("/me", (req: AuthedRequest, res) => {
  const roles = req.user?.roles ?? [];
  res.json({
    success: true,
    data: {
      id: req.user?.id,
      email: req.user?.email,
      roles,
      departmentScope: req.user?.departmentScope ?? null,
      permissions: myPermissions(roles),
    },
  });
});

// Catalog (permission-based read, no hardcoded role checks in UI).
authRouter.get("/roles", requirePermission("session.read"), (_req, res) => {
  res.json({ success: true, data: ROLES });
});

authRouter.get(
  "/permissions",
  requirePermission("session.read"),
  (_req, res) => {
    const catalog = (Object.keys(PERMISSIONS) as Permission[]).map((p) => ({
      permission: p,
      roles: PERMISSIONS[p],
    }));
    res.json({ success: true, data: catalog });
  },
);

// --- User management (SUPER_ADMIN only) ---
const createUserSchema = z.object({
  email: z.string().email().toLowerCase(),
  displayName: z.string().min(2).max(100),
  roles: z.array(z.enum(ROLES)).default([]),
  departmentScope: z.string().min(1).optional(),
});

authRouter.get(
  "/users",
  requirePermission("user.manage"),
  async (_req, res) => {
    if (!dbOk(res)) return;
    const users = await User.find()
      .populate("departmentScope")
      .limit(200)
      .lean();
    res.json({ success: true, data: users });
  },
);

authRouter.post(
  "/users",
  requirePermission("user.manage"),
  async (req: AuthedRequest, res) => {
    if (!dbOk(res)) return;
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({ success: false, error: { code: "VALIDATION_ERROR" } });
    if (
      parsed.data.roles.includes("DEPARTMENT_HEAD_CI") &&
      !parsed.data.departmentScope
    )
      return res
        .status(400)
        .json({ success: false, error: { code: "CI_SCOPE_REQUIRED" } });
    if (parsed.data.departmentScope) {
      const dept = await Department.findById(
        parsed.data.departmentScope,
      ).lean();
      if (!dept)
        return res
          .status(400)
          .json({ success: false, error: { code: "DEPT_NOT_FOUND" } });
    }
    try {
      const u = await User.create({
        googleSubject: `provisioned:${parsed.data.email}:${Date.now()}`,
        email: parsed.data.email,
        displayName: parsed.data.displayName,
        roles: parsed.data.roles,
        departmentScope: parsed.data.departmentScope ?? undefined,
      });
      await audit({
        actorUserId: req.user!.id,
        role: "SUPER_ADMIN",
        action: "user.create",
        entity: "User",
        entityId: String(u._id),
      });
      res.status(201).json({ success: true, data: u });
    } catch {
      res.status(409).json({ success: false, error: { code: "USER_EXISTS" } });
    }
  },
);

const assignRoleSchema = z.object({
  role: z.enum(ROLES),
  departmentScope: z.string().min(1).optional(),
});

authRouter.post(
  "/users/:id/roles",
  requirePermission("role.assign"),
  async (req: AuthedRequest, res) => {
    if (!dbOk(res)) return;
    const parsed = assignRoleSchema.safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({ success: false, error: { code: "VALIDATION_ERROR" } });
    if (
      parsed.data.role === "DEPARTMENT_HEAD_CI" &&
      !parsed.data.departmentScope
    )
      return res
        .status(400)
        .json({ success: false, error: { code: "CI_SCOPE_REQUIRED" } });
    const update: Record<string, unknown> = {
      $addToSet: { roles: parsed.data.role },
    };
    if (parsed.data.departmentScope) {
      const dept = await Department.findById(
        parsed.data.departmentScope,
      ).lean();
      if (!dept)
        return res
          .status(400)
          .json({ success: false, error: { code: "DEPT_NOT_FOUND" } });
      (update as { $set: unknown }).$set = {
        departmentScope: parsed.data.departmentScope,
      };
    }
    const user = await User.findByIdAndUpdate(req.params.id, update, {
      new: true,
    }).lean();
    if (!user)
      return res
        .status(404)
        .json({ success: false, error: { code: "USER_NOT_FOUND" } });
    await audit({
      actorUserId: req.user!.id,
      role: "SUPER_ADMIN",
      action: "role.assign",
      entity: "User",
      entityId: String((user as { _id: unknown })._id),
      after: parsed.data,
    });
    res.json({ success: true, data: user });
  },
);

authRouter.delete(
  "/users/:id/roles/:role",
  requirePermission("role.assign"),
  async (req: AuthedRequest, res) => {
    if (!dbOk(res)) return;
    const role = String(req.params.role);
    if (!(ROLES as readonly string[]).includes(role))
      return res
        .status(400)
        .json({ success: false, error: { code: "INVALID_ROLE" } });
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $pull: { roles: role } },
      { new: true },
    ).lean();
    if (!user)
      return res
        .status(404)
        .json({ success: false, error: { code: "USER_NOT_FOUND" } });
    await audit({
      actorUserId: req.user!.id,
      role: "SUPER_ADMIN",
      action: "role.remove",
      entity: "User",
      entityId: String((user as { _id: unknown })._id),
      after: { role },
    });
    res.json({ success: true, data: user });
  },
);

const statusSchema = z.object({ status: z.enum(["ACTIVE", "INACTIVE"]) });

authRouter.patch(
  "/users/:id/status",
  requirePermission("user.manage"),
  async (req: AuthedRequest, res) => {
    if (!dbOk(res)) return;
    const parsed = statusSchema.safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({ success: false, error: { code: "VALIDATION_ERROR" } });
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { status: parsed.data.status },
      { new: true },
    ).lean();
    if (!user)
      return res
        .status(404)
        .json({ success: false, error: { code: "USER_NOT_FOUND" } });
    await audit({
      actorUserId: req.user!.id,
      role: "SUPER_ADMIN",
      action: "user.status",
      entity: "User",
      entityId: String((user as { _id: unknown })._id),
      after: parsed.data,
    });
    res.json({ success: true, data: user });
  },
);
