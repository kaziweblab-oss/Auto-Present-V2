import { Router } from "express";
import { z } from "zod";
import {
  ClassGroup,
  RoutineEntry,
  ShiftMerge,
  StudentSession,
  SystemSetting,
  audit,
} from "./models.js";
import { dbOk } from "./db-guard.js";
import { findConflicts } from "./conflicts.js";
import {
  hydrateScope,
  requireAuth,
  requirePermission,
  type AuthedRequest,
} from "./rbac.js";

export const shiftsRouter = Router();
shiftsRouter.use(requireAuth);
shiftsRouter.use(hydrateScope);

const DEFAULT_CONFIG = {
  shifts: [
    { id: "1ST", name: "1st Shift" },
    { id: "2ND", name: "2nd Shift" },
  ],
};

async function shiftConfig() {
  const row = (await SystemSetting.findOne({
    key: "shift.config",
  }).lean()) as unknown as {
    value: typeof DEFAULT_CONFIG;
  } | null;
  return row?.value ?? DEFAULT_CONFIG;
}

shiftsRouter.get(
  "/config",
  requirePermission("shift.read"),
  async (_req, res) => {
    if (!dbOk(res)) return;
    res.json({ success: true, data: await shiftConfig() });
  },
);

const configSchema = z.object({
  shifts: z
    .array(
      z.object({ id: z.enum(["1ST", "2ND"]), name: z.string().min(2).max(40) }),
    )
    .min(1)
    .max(2),
});

shiftsRouter.put(
  "/config",
  requirePermission("shift.manage"),
  async (req: AuthedRequest, res) => {
    if (!dbOk(res)) return;
    const parsed = configSchema.safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({ success: false, error: { code: "VALIDATION_ERROR" } });
    await SystemSetting.findOneAndUpdate(
      { key: "shift.config" },
      { value: parsed.data, updatedBy: req.user!.id },
      { upsert: true },
    );
    await audit({
      actorUserId: req.user!.id,
      role: "PRINCIPAL",
      action: "shift.config",
      entity: "SystemSetting",
      after: parsed.data,
    });
    res.json({ success: true, data: parsed.data });
  },
);

// Per-shift stats: students, classes, routines, teachers.
shiftsRouter.get(
  "/stats",
  requirePermission("shift.read"),
  async (req, res) => {
    if (!dbOk(res)) return;
    const match: Record<string, unknown> = {};
    if (req.query.sessionId) match.sessionId = String(req.query.sessionId);
    if (req.query.departmentId)
      match.departmentId = String(req.query.departmentId);
    const out: Record<string, unknown> = {};
    for (const shift of ["1ST", "2ND"] as const) {
      const [students, classes, routines] = await Promise.all([
        StudentSession.countDocuments({ ...match, shift }),
        ClassGroup.countDocuments({ ...match, shift }),
        RoutineEntry.countDocuments({ ...match, shift, status: "ACTIVE" }),
      ]);
      const teachers = await RoutineEntry.distinct("teacherId", {
        ...match,
        shift,
        status: "ACTIVE",
      });
      out[shift] = { students, classes, routines, teachers: teachers.length };
    }
    res.json({ success: true, data: out });
  },
);

const mergeSchema = z.object({
  from: z.enum(["1ST", "2ND"]),
  to: z.enum(["1ST", "2ND"]),
  sessionId: z.string().min(1).optional(),
  departmentId: z.string().min(1).optional(),
  reason: z.string().min(5).max(500),
  force: z.boolean().default(false),
});

async function impact(from: string, sessionId?: string, departmentId?: string) {
  const match: Record<string, unknown> = { shift: from, status: "ACTIVE" };
  const sm: Record<string, unknown> = { shift: from };
  if (sessionId) {
    match.sessionId = sessionId;
    sm.sessionId = sessionId;
  }
  if (departmentId) {
    match.departmentId = departmentId;
    sm.departmentId = departmentId;
  }
  const [students, classes, routines] = await Promise.all([
    StudentSession.countDocuments(sm),
    ClassGroup.countDocuments({ ...sm, status: "ACTIVE" }),
    RoutineEntry.find(match).lean(),
  ]);
  const teachers = new Set(
    (routines as unknown as { teacherId: unknown }[]).map((r) =>
      String(r.teacherId),
    ),
  ).size;
  // Conflicts the merge would create: moved entries vs existing target-shift entries.
  const target = await RoutineEntry.find({
    ...match,
    shift: (match as { shift: string }).shift ? undefined : undefined,
  }).lean();
  void target;
  const existing = await RoutineEntry.find({
    ...(sessionId ? { sessionId } : {}),
    ...(departmentId ? { departmentId } : {}),
    status: "ACTIVE",
  }).lean();
  const moved = routines as unknown as {
    teacherId: string;
    classGroupId: string;
    room?: string;
    day: string;
    startTime: string;
    endTime: string;
    shift: string;
    _id: unknown;
  }[];
  // Simulate: moved entries now in `to` shift — check teacher/class/room clashes
  // against entries already in target shift handled by caller via toShift query.
  void moved;
  return {
    students,
    classes,
    routines: routines.length,
    teachers,
    sampleRoutineIds: (routines as { _id: unknown }[])
      .slice(0, 5)
      .map((r) => String(r._id)),
  };
}

async function mergeConflicts(
  from: string,
  to: string,
  sessionId?: string,
  departmentId?: string,
) {
  const base: Record<string, unknown> = { status: "ACTIVE" };
  if (sessionId) base.sessionId = sessionId;
  if (departmentId) base.departmentId = departmentId;
  const [moving, staying] = await Promise.all([
    RoutineEntry.find({ ...base, shift: from }).lean(),
    RoutineEntry.find({ ...base, shift: to }).lean(),
  ]);
  const conflicts: unknown[] = [];
  for (const m of moving as unknown as {
    teacherId: unknown;
    classGroupId: unknown;
    room?: string;
    day: string;
    startTime: string;
    endTime: string;
    _id: unknown;
  }[]) {
    const found = findConflicts(
      {
        ...m,
        teacherId: String(m.teacherId),
        classGroupId: String(m.classGroupId),
        _id: String(m._id),
      },
      staying as never[],
    );
    if (found.length > 0)
      conflicts.push({ moving: String(m._id), conflicts: found });
  }
  return conflicts;
}

// Preview without writing.
shiftsRouter.post(
  "/merge/preview",
  requirePermission("shift.merge"),
  async (req, res) => {
    if (!dbOk(res)) return;
    const parsed = mergeSchema.safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({ success: false, error: { code: "VALIDATION_ERROR" } });
    if (parsed.data.from === parsed.data.to)
      return res
        .status(400)
        .json({ success: false, error: { code: "SAME_SHIFT" } });
    const [imp, conflicts] = await Promise.all([
      impact(parsed.data.from, parsed.data.sessionId, parsed.data.departmentId),
      mergeConflicts(
        parsed.data.from,
        parsed.data.to,
        parsed.data.sessionId,
        parsed.data.departmentId,
      ),
    ]);
    res.json({
      success: true,
      data: { ...imp, conflicts, conflictCount: conflicts.length },
    });
  },
);

// Confirm with explicit reason; history preserved in ShiftMerge + audit.
shiftsRouter.post(
  "/merge",
  requirePermission("shift.merge"),
  async (req: AuthedRequest, res) => {
    if (!dbOk(res)) return;
    const parsed = mergeSchema.safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({ success: false, error: { code: "VALIDATION_ERROR" } });
    if (parsed.data.from === parsed.data.to)
      return res
        .status(400)
        .json({ success: false, error: { code: "SAME_SHIFT" } });
    const conflicts = await mergeConflicts(
      parsed.data.from,
      parsed.data.to,
      parsed.data.sessionId,
      parsed.data.departmentId,
    );
    if (conflicts.length > 0 && !parsed.data.force)
      return res.status(409).json({
        success: false,
        error: {
          code: "MERGE_CONFLICTS",
          conflicts,
          hint: "Re-run with force:true",
        },
      });

    const scope: Record<string, unknown> = { shift: parsed.data.from };
    if (parsed.data.sessionId) scope.sessionId = parsed.data.sessionId;
    if (parsed.data.departmentId) scope.departmentId = parsed.data.departmentId;

    const [sUpd, cUpd, rUpd] = await Promise.all([
      StudentSession.updateMany(scope, { $set: { shift: parsed.data.to } }),
      ClassGroup.updateMany(
        { ...scope, status: "ACTIVE" },
        { $set: { shift: parsed.data.to } },
      ),
      RoutineEntry.updateMany(
        { ...scope, status: "ACTIVE" },
        { $set: { shift: parsed.data.to } },
      ),
    ]);
    const imp = {
      students: sUpd.modifiedCount,
      classes: cUpd.modifiedCount,
      routines: rUpd.modifiedCount,
      conflicts: conflicts.length,
      forced: parsed.data.force,
    };
    const record = await ShiftMerge.create({
      fromShift: parsed.data.from,
      toShift: parsed.data.to,
      sessionId: parsed.data.sessionId ?? undefined,
      departmentId: parsed.data.departmentId ?? undefined,
      reason: parsed.data.reason,
      status: "COMPLETED",
      impact: imp,
      mergedBy: req.user!.id,
    });
    await audit({
      actorUserId: req.user!.id,
      role: "PRINCIPAL",
      action: "shift.merge",
      entity: "ShiftMerge",
      entityId: String(record._id),
      before: { from: parsed.data.from },
      after: { to: parsed.data.to, ...imp },
    });
    res.json({ success: true, data: { merge: record, impact: imp } });
  },
);

shiftsRouter.get(
  "/merges",
  requirePermission("shift.read"),
  async (_req, res) => {
    if (!dbOk(res)) return;
    res.json({
      success: true,
      data: await ShiftMerge.find().sort({ createdAt: -1 }).limit(100).lean(),
    });
  },
);
