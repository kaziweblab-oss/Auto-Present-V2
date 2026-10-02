import { Router } from "express";
import { z } from "zod";
import {
  AcademicSession,
  AuditLog,
  ClassGroup,
  Department,
  Student,
  StudentSession,
  Subject,
  Teacher,
  User,
  audit,
} from "./models.js";
import { canTransition } from "./session-flow.js";
import { dbOk } from "./db-guard.js";
import { requireAuth, requirePermission, type AuthedRequest } from "./rbac.js";
import { sessionDbKey } from "@auto-present-v2/shared";

export const foundationRouter = Router();
foundationRouter.use(requireAuth);

// --- Departments (Phase 1: create + list) ---
const deptSchema = z.object({
  code: z.string().min(2).max(10),
  name: z.string().min(2).max(100),
});

foundationRouter.get(
  "/departments",
  requirePermission("department.read"),
  async (_req, res) => {
    if (!dbOk(res)) return;
    res.json({ success: true, data: await Department.find().lean() });
  },
);

foundationRouter.post(
  "/departments",
  requirePermission("department.manage"),
  async (req: AuthedRequest, res) => {
    if (!dbOk(res)) return;
    const parsed = deptSchema.safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({ success: false, error: { code: "VALIDATION_ERROR" } });
    try {
      const d = await Department.create({
        code: parsed.data.code.toUpperCase(),
        name: parsed.data.name,
      });
      await audit({
        actorUserId: req.user!.id,
        action: "department.create",
        entity: "Department",
        entityId: String(d._id),
      });
      res.status(201).json({ success: true, data: d });
    } catch {
      res
        .status(409)
        .json({ success: false, error: { code: "DEPARTMENT_EXISTS" } });
    }
  },
);

// --- Sessions (Principal only; read for all academic roles) ---
const sessionSchema = z.object({
  name: z.string().regex(/^\d{4}-\d{2}$/),
  startDate: z.string().datetime({ offset: true }).optional(),
  endDate: z.string().datetime({ offset: true }).optional(),
});

foundationRouter.get(
  "/sessions",
  requirePermission("session.read"),
  async (_req, res) => {
    if (!dbOk(res)) return;
    res.json({
      success: true,
      data: await AcademicSession.find().sort({ createdAt: -1 }).lean(),
    });
  },
);

foundationRouter.post(
  "/sessions",
  requirePermission("session.create"),
  async (req: AuthedRequest, res) => {
    if (!dbOk(res)) return;
    const parsed = sessionSchema.safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({ success: false, error: { code: "VALIDATION_ERROR" } });
    try {
      const s = await AcademicSession.create({
        ...parsed.data,
        dbKey: sessionDbKey(parsed.data.name),
        createdBy: req.user!.id,
      });
      await audit({
        actorUserId: req.user!.id,
        action: "session.create",
        entity: "Session",
        entityId: String(s._id),
      });
      res.status(201).json({ success: true, data: s });
    } catch {
      res
        .status(409)
        .json({ success: false, error: { code: "SESSION_EXISTS" } });
    }
  },
);

foundationRouter.post(
  "/sessions/:id/activate",
  requirePermission("session.activate"),
  async (req: AuthedRequest, res) => {
    if (!dbOk(res)) return;
    const s = await AcademicSession.findById(req.params.id);
    if (!s)
      return res
        .status(404)
        .json({ success: false, error: { code: "NOT_FOUND" } });
    if (!canTransition(s.state as never, "ACTIVE"))
      return res
        .status(409)
        .json({ success: false, error: { code: "INVALID_TRANSITION" } });
    await AcademicSession.updateMany(
      { state: "ACTIVE" },
      { $set: { state: "CLOSED" } },
    );
    s.state = "ACTIVE";
    s.activatedBy = req.user!.id as never;
    await s.save();
    await audit({
      actorUserId: req.user!.id,
      action: "session.activate",
      entity: "Session",
      entityId: String(s._id),
    });
    res.json({ success: true, data: s });
  },
);

// --- Phase 1 overview counts (no fake data) ---
foundationRouter.get(
  "/overview",
  requirePermission("session.read"),
  async (_req, res) => {
    if (!dbOk(res)) return;
    const [
      departments,
      sessions,
      students,
      teachers,
      groups,
      subjects,
      users,
      audits,
    ] = await Promise.all([
      Department.countDocuments(),
      AcademicSession.countDocuments(),
      Student.countDocuments(),
      Teacher.countDocuments(),
      ClassGroup.countDocuments(),
      Subject.countDocuments(),
      User.countDocuments(),
      AuditLog.countDocuments(),
    ]);
    res.json({
      success: true,
      data: {
        departments,
        sessions,
        students,
        teachers,
        groups,
        subjects,
        users,
        audits,
      },
    });
  },
);

// StudentSession history stays queryable; detailed student CRUD lands in Phase 4.
foundationRouter.get(
  "/students/:id/history",
  requirePermission("student.read"),
  async (req, res) => {
    if (!dbOk(res)) return;
    const rows = await StudentSession.find({ studentId: req.params.id })
      .populate("sessionId departmentId")
      .sort({ createdAt: 1 })
      .lean();
    res.json({ success: true, data: rows });
  },
);
