import { Router } from "express";
import { z } from "zod";
import {
  ClassGroup,
  Department,
  RoutineEntry,
  Subject,
  Teacher,
  audit,
} from "./models.js";
import { dbOk } from "./db-guard.js";
import { findConflicts, toMinutes } from "./conflicts.js";
import {
  hydrateScope,
  requireAuth,
  requireDepartmentScope,
  requirePermission,
  type AuthedRequest,
} from "./rbac.js";

export const routinesRouter = Router();
routinesRouter.use(requireAuth);
routinesRouter.use(hydrateScope);

// --- Subjects (CI scoped) ---
const subjectSchema = z.object({
  code: z.string().min(2).max(20),
  name: z.string().min(2).max(120),
  departmentId: z.string().min(1),
  type: z.enum(["THEORY", "LAB"]).default("THEORY"),
  credit: z.number().min(0).max(20).optional(),
});

routinesRouter.post(
  "/subjects",
  requirePermission("subject.manage"),
  requireDepartmentScope({ body: "departmentId" }),
  async (req: AuthedRequest, res) => {
    if (!dbOk(res)) return;
    const parsed = subjectSchema.safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({ success: false, error: { code: "VALIDATION_ERROR" } });
    try {
      const s = await Subject.create({
        ...parsed.data,
        code: parsed.data.code.toUpperCase(),
      });
      await audit({
        actorUserId: req.user!.id,
        role: req.user!.roles[0],
        action: "subject.create",
        entity: "Subject",
        entityId: String(s._id),
      });
      res.status(201).json({ success: true, data: s });
    } catch {
      res
        .status(409)
        .json({ success: false, error: { code: "SUBJECT_EXISTS" } });
    }
  },
);

routinesRouter.get(
  "/subjects",
  requirePermission("routine.read"),
  async (req, res) => {
    if (!dbOk(res)) return;
    const match: Record<string, unknown> = {};
    if (req.query.departmentId)
      match.departmentId = String(req.query.departmentId);
    res.json({
      success: true,
      data: await Subject.find(match).limit(200).lean(),
    });
  },
);

// --- Class groups (CI scoped) ---
const groupSchema = z.object({
  departmentId: z.string().min(1),
  sessionId: z.string().min(1),
  shift: z.enum(["1ST", "2ND"]),
  name: z.string().min(1).max(40),
  room: z.string().max(40).optional(),
  capacity: z.number().int().min(1).max(500).optional(),
  classTeacherId: z.string().min(1).optional(),
});

routinesRouter.post(
  "/groups",
  requirePermission("class.manage"),
  requireDepartmentScope({ body: "departmentId" }),
  async (req: AuthedRequest, res) => {
    if (!dbOk(res)) return;
    const parsed = groupSchema.safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({ success: false, error: { code: "VALIDATION_ERROR" } });
    try {
      const g = await ClassGroup.create({
        ...parsed.data,
        classTeacherId: parsed.data.classTeacherId ?? undefined,
      });
      await audit({
        actorUserId: req.user!.id,
        role: req.user!.roles[0],
        action: "class.create",
        entity: "ClassGroup",
        entityId: String(g._id),
      });
      res.status(201).json({ success: true, data: g });
    } catch {
      res.status(409).json({ success: false, error: { code: "GROUP_EXISTS" } });
    }
  },
);

routinesRouter.get(
  "/groups",
  requirePermission("routine.read"),
  async (req, res) => {
    if (!dbOk(res)) return;
    const match: Record<string, unknown> = {};
    if (req.query.sessionId) match.sessionId = String(req.query.sessionId);
    if (req.query.departmentId)
      match.departmentId = String(req.query.departmentId);
    res.json({
      success: true,
      data: await ClassGroup.find(match).limit(200).lean(),
    });
  },
);

// --- Routine entries with conflict detection ---
const entrySchema = z
  .object({
    sessionId: z.string().min(1),
    departmentId: z.string().min(1),
    shift: z.enum(["1ST", "2ND"]),
    classGroupId: z.string().min(1),
    subjectId: z.string().min(1),
    teacherId: z.string().min(1),
    day: z.enum(["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"]),
    startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    room: z.string().max(40).optional(),
  })
  .refine((v) => toMinutes(v.startTime) < toMinutes(v.endTime), {
    message: "startTime must be before endTime",
  });

async function checkConflicts(
  candidate: {
    teacherId: string;
    classGroupId: string;
    room?: string;
    day: string;
    startTime: string;
    endTime: string;
    _id?: string;
  },
  sessionId: string,
) {
  const existing = await RoutineEntry.find({
    sessionId,
    status: "ACTIVE",
  }).lean();
  return findConflicts(candidate, existing as never[]);
}

routinesRouter.post(
  "/entries",
  requirePermission("routine.manage"),
  requireDepartmentScope({ body: "departmentId" }),
  async (req: AuthedRequest, res) => {
    if (!dbOk(res)) return;
    const parsed = entrySchema.safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({ success: false, error: { code: "VALIDATION_ERROR" } });
    const [teacher, group, subject, dept] = await Promise.all([
      Teacher.findById(parsed.data.teacherId).lean(),
      ClassGroup.findById(parsed.data.classGroupId).lean(),
      Subject.findById(parsed.data.subjectId).lean(),
      Department.findById(parsed.data.departmentId).lean(),
    ]);
    if (!teacher)
      return res
        .status(400)
        .json({ success: false, error: { code: "TEACHER_NOT_FOUND" } });
    if (!group)
      return res
        .status(400)
        .json({ success: false, error: { code: "GROUP_NOT_FOUND" } });
    if (!subject)
      return res
        .status(400)
        .json({ success: false, error: { code: "SUBJECT_NOT_FOUND" } });
    if (!dept)
      return res
        .status(400)
        .json({ success: false, error: { code: "DEPT_NOT_FOUND" } });

    const conflicts = await checkConflicts(parsed.data, parsed.data.sessionId);
    if (conflicts.length > 0)
      return res.status(409).json({
        success: false,
        error: { code: "SCHEDULE_CONFLICT", conflicts },
      });

    const entry = await RoutineEntry.create(parsed.data);
    await audit({
      actorUserId: req.user!.id,
      role: req.user!.roles[0],
      action: "routine.create",
      entity: "RoutineEntry",
      entityId: String(entry._id),
    });
    res.status(201).json({ success: true, data: entry });
  },
);

// Read: weekly / daily / teacher / class / department views.
routinesRouter.get(
  "/entries",
  requirePermission("routine.read"),
  async (req, res) => {
    if (!dbOk(res)) return;
    const match: Record<string, unknown> = { status: "ACTIVE" };
    for (const k of [
      "sessionId",
      "departmentId",
      "teacherId",
      "classGroupId",
      "day",
      "shift",
    ] as const) {
      if (req.query[k]) match[k] = String(req.query[k]);
    }
    const items = await RoutineEntry.find(match)
      .populate("subjectId teacherId classGroupId")
      .sort({ day: 1, startTime: 1 })
      .limit(500)
      .lean();
    res.json({ success: true, data: items });
  },
);

routinesRouter.delete(
  "/entries/:id",
  requirePermission("routine.manage"),
  async (req: AuthedRequest, res) => {
    if (!dbOk(res)) return;
    const entry = await RoutineEntry.findByIdAndUpdate(
      String(req.params.id),
      { status: "INACTIVE" },
      { new: true },
    ).lean();
    if (!entry)
      return res
        .status(404)
        .json({ success: false, error: { code: "ENTRY_NOT_FOUND" } });
    await audit({
      actorUserId: req.user!.id,
      role: req.user!.roles[0],
      action: "routine.remove",
      entity: "RoutineEntry",
      entityId: String(req.params.id),
    });
    res.json({ success: true, data: entry });
  },
);
