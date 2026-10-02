import { Router } from "express";
import { z } from "zod";
import { AcademicSession, audit } from "./models.js";
import { canTransition } from "./session-flow.js";
import { dbOk } from "./db-guard.js";
import { requireAuth, requirePermission, type AuthedRequest } from "./rbac.js";
import { sessionDbKey } from "@auto-present-v2/shared";

export const sessionsRouter = Router();
sessionsRouter.use(requireAuth);

const createSchema = z
  .object({
    name: z.string().regex(/^\d{4}-\d{2}$/, "Use format 2025-26"),
    startDate: z.string().datetime({ offset: true }).optional(),
    endDate: z.string().datetime({ offset: true }).optional(),
  })
  .refine(
    (v) => {
      if (v.startDate && v.endDate)
        return new Date(v.startDate) < new Date(v.endDate);
      return true;
    },
    { message: "startDate must be before endDate" },
  );

const updateSchema = z
  .object({
    startDate: z.string().datetime({ offset: true }).optional(),
    endDate: z.string().datetime({ offset: true }).optional(),
  })
  .refine(
    (v) => {
      if (v.startDate && v.endDate)
        return new Date(v.startDate) < new Date(v.endDate);
      return true;
    },
    { message: "startDate must be before endDate" },
  );

sessionsRouter.get(
  "/",
  requirePermission("session.read"),
  async (_req, res) => {
    if (!dbOk(res)) return;
    const sessions = await AcademicSession.find()
      .sort({ createdAt: -1 })
      .lean();
    res.json({
      success: true,
      data: sessions,
      meta: { requestId: res.locals.requestId },
    });
  },
);

sessionsRouter.post(
  "/",
  requirePermission("session.create"),
  async (req: AuthedRequest, res) => {
    if (!dbOk(res)) return;
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", issues: parsed.error.issues },
        meta: { requestId: res.locals.requestId },
      });
    try {
      const s = await AcademicSession.create({
        name: parsed.data.name,
        startDate: parsed.data.startDate,
        endDate: parsed.data.endDate,
        dbKey: sessionDbKey(parsed.data.name),
        createdBy: req.user!.id,
      });
      await audit({
        actorUserId: req.user!.id,
        role: req.user!.roles[0],
        action: "session.create",
        entity: "Session",
        entityId: String(s._id),
        after: { name: s.name, state: "DRAFT" },
      });
      res.status(201).json({ success: true, data: s });
    } catch {
      res
        .status(409)
        .json({ success: false, error: { code: "SESSION_EXISTS" } });
    }
  },
);

// Edit DRAFT only (Principal).
sessionsRouter.patch(
  "/:id",
  requirePermission("session.create"),
  async (req: AuthedRequest, res) => {
    if (!dbOk(res)) return;
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({ success: false, error: { code: "VALIDATION_ERROR" } });
    const s = await AcademicSession.findById(req.params.id);
    if (!s)
      return res
        .status(404)
        .json({ success: false, error: { code: "SESSION_NOT_FOUND" } });
    if (s.state !== "DRAFT")
      return res
        .status(409)
        .json({ success: false, error: { code: "ONLY_DRAFT_EDITABLE" } });
    const before = { startDate: s.startDate, endDate: s.endDate };
    if (parsed.data.startDate)
      s.startDate = new Date(parsed.data.startDate) as never;
    if (parsed.data.endDate) s.endDate = new Date(parsed.data.endDate) as never;
    await s.save();
    await audit({
      actorUserId: req.user!.id,
      role: "PRINCIPAL",
      action: "session.update",
      entity: "Session",
      entityId: String(s._id),
      before,
      after: parsed.data,
    });
    res.json({ success: true, data: s });
  },
);

async function transition(
  req: AuthedRequest,
  res: Parameters<Parameters<typeof sessionsRouter.post>[1]>[1] & {
    locals: { requestId?: string };
  },
  id: string,
  to: "ACTIVE" | "CLOSED" | "ARCHIVED",
) {
  if (!dbOk(res)) return;
  const s = await AcademicSession.findById(id);
  if (!s)
    return res
      .status(404)
      .json({ success: false, error: { code: "SESSION_NOT_FOUND" } });
  if (!canTransition(s.state as never, to)) {
    return res.status(409).json({
      success: false,
      error: { code: "INVALID_TRANSITION", from: s.state },
    });
  }
  if (to === "ACTIVE") {
    // Only one ACTIVE: close current holder, history preserved.
    await AcademicSession.updateMany(
      { state: "ACTIVE" },
      { $set: { state: "CLOSED" } },
    );
    s.activatedBy = req.user!.id as never;
  }
  const before = s.state;
  s.state = to;
  await s.save();
  await audit({
    actorUserId: req.user!.id,
    role: "PRINCIPAL",
    action: `session.${to.toLowerCase()}`,
    entity: "Session",
    entityId: String(s._id),
    before: { state: before },
    after: { state: to },
  });
  res.json({ success: true, data: s });
}

sessionsRouter.post(
  "/:id/activate",
  requirePermission("session.activate"),
  (req: AuthedRequest, res) =>
    transition(req, res as never, String(req.params.id), "ACTIVE"),
);
sessionsRouter.post(
  "/:id/close",
  requirePermission("session.close"),
  (req: AuthedRequest, res) =>
    transition(req, res as never, String(req.params.id), "CLOSED"),
);
sessionsRouter.post(
  "/:id/archive",
  requirePermission("session.close"),
  (req: AuthedRequest, res) =>
    transition(req, res as never, String(req.params.id), "ARCHIVED"),
);
