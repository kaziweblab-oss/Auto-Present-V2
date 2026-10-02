import { Router } from "express";
import { z } from "zod";
import {
  ReplacementRequest,
  RoutineEntry,
  SystemSetting,
  Teacher,
  audit,
} from "./models.js";
import { dbOk } from "./db-guard.js";
import { findConflicts } from "./conflicts.js";
import {
  DEFAULTS,
  leadOk,
  manualWithinDays,
  responseDeadline,
} from "./replacement-time.js";
import {
  hydrateScope,
  requireAuth,
  requirePermission,
  type AuthedRequest,
} from "./rbac.js";

export const replacementsRouter = Router();
replacementsRouter.use(requireAuth);
replacementsRouter.use(hydrateScope);

async function config() {
  const rows = await SystemSetting.find({
    key: {
      $in: [
        "replacement.minLeadMinutes",
        "replacement.responseWindowMinutes",
        "replacement.maxManualDays",
      ],
    },
  }).lean();
  const get = (k: string, fallback: number) => {
    const r = rows.find(
      (x) => (x as unknown as { key: string }).key === k,
    ) as unknown as { value: number } | undefined;
    return typeof r?.value === "number" ? r.value : fallback;
  };
  return {
    minLeadMinutes: get("replacement.minLeadMinutes", DEFAULTS.minLeadMinutes),
    responseWindowMinutes: get(
      "replacement.responseWindowMinutes",
      DEFAULTS.responseWindowMinutes,
    ),
    maxManualDays: get("replacement.maxManualDays", DEFAULTS.maxManualDays),
  };
}

replacementsRouter.get(
  "/config",
  requirePermission("replacement.request"),
  async (_req, res) => {
    if (!dbOk(res)) return;
    res.json({ success: true, data: await config() });
  },
);

const configSchema = z.object({
  minLeadMinutes: z
    .number()
    .int()
    .min(0)
    .max(24 * 60)
    .optional(),
  responseWindowMinutes: z
    .number()
    .int()
    .min(5)
    .max(24 * 60)
    .optional(),
  maxManualDays: z.number().int().min(1).max(60).optional(),
});

replacementsRouter.put(
  "/config",
  requirePermission("replacement.configure"),
  async (req: AuthedRequest, res) => {
    if (!dbOk(res)) return;
    const parsed = configSchema.safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({ success: false, error: { code: "VALIDATION_ERROR" } });
    const map: Record<string, keyof typeof DEFAULTS> = {
      minLeadMinutes: "minLeadMinutes",
      responseWindowMinutes: "responseWindowMinutes",
      maxManualDays: "maxManualDays",
    };
    for (const [k] of Object.entries(parsed.data)) {
      const key = `replacement.${k}`;
      await SystemSetting.findOneAndUpdate(
        { key },
        {
          value: (parsed.data as Record<string, number>)[k],
          updatedBy: req.user!.id,
        },
        { upsert: true },
      );
      void map;
    }
    await audit({
      actorUserId: req.user!.id,
      role: "PRINCIPAL",
      action: "replacement.config",
      entity: "SystemSetting",
      after: parsed.data,
    });
    res.json({ success: true, data: await config() });
  },
);

const createSchema = z.object({
  routineEntryId: z.string().min(1).optional(),
  requestedTeacherId: z.string().min(1),
  // manual fields (when no routineEntryId)
  sessionId: z.string().min(1).optional(),
  departmentId: z.string().min(1).optional(),
  classGroupId: z.string().min(1).optional(),
  subjectId: z.string().min(1).optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  startTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .optional(),
  endTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .optional(),
  requesterTeacherId: z.string().min(1),
  reason: z.string().min(3).max(500),
});

async function teacherFree(
  teacherId: string,
  sessionId: string,
  day: string,
  startTime: string,
  endTime: string,
  date: string,
  excludeId?: string,
): Promise<{ ok: boolean; conflicts: unknown[] }> {
  const [routines, accepted] = await Promise.all([
    RoutineEntry.find({ sessionId, teacherId, day, status: "ACTIVE" }).lean(),
    ReplacementRequest.find({
      requestedTeacherId: teacherId,
      date,
      status: "ACCEPTED",
    }).lean(),
  ]);
  const c1 = findConflicts(
    { teacherId, classGroupId: "__new__", day, startTime, endTime },
    (
      routines as unknown as {
        teacherId: string;
        classGroupId: string;
        day: string;
        startTime: string;
        endTime: string;
      }[]
    ).map((r) => ({ ...r, teacherId: String(teacherId) })),
  );
  const c2 = (
    accepted as unknown as {
      startTime: string;
      endTime: string;
      _id: unknown;
    }[]
  ).filter(
    (a) =>
      String(a._id) !== String(excludeId ?? "") &&
      startTime < a.endTime &&
      a.startTime < endTime,
  );
  return { ok: c1.length === 0 && c2.length === 0, conflicts: [...c1, ...c2] };
}

function dayOf(date: string): string {
  return ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][
    new Date(`${date}T12:00:00`).getDay()
  ];
}

async function sweepExpired() {
  await ReplacementRequest.updateMany(
    { status: "PENDING", expiresAt: { $lt: new Date() } },
    { $set: { status: "EXPIRED" } },
  );
}

replacementsRouter.post(
  "/",
  requirePermission("replacement.request"),
  async (req: AuthedRequest, res) => {
    if (!dbOk(res)) return;
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({ success: false, error: { code: "VALIDATION_ERROR" } });
    const cfg = await config();
    const { requestedTeacherId, requesterTeacherId, reason } = parsed.data;
    if (requestedTeacherId === requesterTeacherId)
      return res
        .status(400)
        .json({ success: false, error: { code: "SELF_REQUEST" } });

    let slot: {
      sessionId: string;
      departmentId: string;
      classGroupId: string;
      subjectId: string;
      date: string;
      startTime: string;
      endTime: string;
      routineEntryId?: string;
    };
    if (parsed.data.routineEntryId) {
      const routine = (await RoutineEntry.findById(
        parsed.data.routineEntryId,
      ).lean()) as unknown as {
        sessionId: unknown;
        departmentId: unknown;
        classGroupId: unknown;
        subjectId: unknown;
      } | null;
      if (!routine)
        return res
          .status(404)
          .json({ success: false, error: { code: "ROUTINE_NOT_FOUND" } });
      // Next occurrence: use supplied date or today.
      const date = parsed.data.date ?? new Date().toISOString().slice(0, 10);
      const full = (await RoutineEntry.findById(
        parsed.data.routineEntryId,
      ).lean()) as unknown as {
        startTime: string;
        endTime: string;
      };
      slot = {
        sessionId: String(routine.sessionId),
        departmentId: String(routine.departmentId),
        classGroupId: String(routine.classGroupId),
        subjectId: String(routine.subjectId),
        date,
        startTime: parsed.data.startTime ?? full.startTime,
        endTime: parsed.data.endTime ?? full.endTime,
        routineEntryId: parsed.data.routineEntryId,
      };
    } else {
      if (
        !parsed.data.sessionId ||
        !parsed.data.departmentId ||
        !parsed.data.classGroupId ||
        !parsed.data.subjectId ||
        !parsed.data.date ||
        !parsed.data.startTime ||
        !parsed.data.endTime
      )
        return res
          .status(400)
          .json({ success: false, error: { code: "MANUAL_FIELDS_REQUIRED" } });
      if (!manualWithinDays(parsed.data.date, cfg.maxManualDays))
        return res.status(409).json({
          success: false,
          error: { code: "BEYOND_MAX_DAYS", max: cfg.maxManualDays },
        });
      slot = {
        sessionId: parsed.data.sessionId,
        departmentId: parsed.data.departmentId,
        classGroupId: parsed.data.classGroupId,
        subjectId: parsed.data.subjectId,
        date: parsed.data.date,
        startTime: parsed.data.startTime,
        endTime: parsed.data.endTime,
      };
    }

    if (!leadOk(slot.date, slot.startTime, cfg.minLeadMinutes))
      return res.status(409).json({
        success: false,
        error: { code: "LEAD_TIME_VIOLATION", min: cfg.minLeadMinutes },
      });

    const requester = await Teacher.findById(requesterTeacherId).lean();
    const requested = await Teacher.findById(requestedTeacherId).lean();
    if (!requester || !requested)
      return res
        .status(404)
        .json({ success: false, error: { code: "TEACHER_NOT_FOUND" } });

    const free = await teacherFree(
      requestedTeacherId,
      slot.sessionId,
      dayOf(slot.date),
      slot.startTime,
      slot.endTime,
      slot.date,
    );
    if (!free.ok)
      return res.status(409).json({
        success: false,
        error: { code: "TEACHER_BUSY", conflicts: free.conflicts },
      });

    const doc = await ReplacementRequest.create({
      requesterTeacherId,
      requestedTeacherId,
      ...slot,
      reason,
      expiresAt: responseDeadline(new Date(), cfg.responseWindowMinutes),
      status: "PENDING",
    });
    await audit({
      actorUserId: req.user!.id,
      role: "TEACHER",
      action: "replacement.request",
      entity: "ReplacementRequest",
      entityId: String(doc._id),
    });
    res.status(201).json({ success: true, data: doc });
  },
);

replacementsRouter.get(
  "/",
  requirePermission("replacement.request"),
  async (req, res) => {
    if (!dbOk(res)) return;
    await sweepExpired();
    const match: Record<string, unknown> = {};
    if (req.query.teacherId) {
      match.$or = [
        { requesterTeacherId: String(req.query.teacherId) },
        { requestedTeacherId: String(req.query.teacherId) },
      ];
    }
    if (req.query.status) match.status = String(req.query.status);
    if (req.query.date) match.date = String(req.query.date);
    const items = await ReplacementRequest.find(match)
      .populate("requesterTeacherId requestedTeacherId")
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    res.json({ success: true, data: items });
  },
);

async function decide(
  req: AuthedRequest,
  res: Parameters<Parameters<typeof replacementsRouter.post>[1]>[1] & {
    locals?: unknown;
  },
  id: string,
  to: "ACCEPTED" | "REJECTED" | "CANCELLED",
) {
  if (!dbOk(res)) return;
  await sweepExpired();
  const doc = await ReplacementRequest.findById(id);
  if (!doc)
    return res
      .status(404)
      .json({ success: false, error: { code: "NOT_FOUND" } });
  if (doc.status !== "PENDING")
    return res.status(409).json({
      success: false,
      error: { code: "NOT_PENDING", status: doc.status },
    });
  // Only requested teacher accepts/rejects; only requester cancels.
  const teacherId = String(
    (req.query.teacherId ?? req.body?.teacherId ?? "") as string,
  );
  if (
    to !== "CANCELLED" &&
    teacherId &&
    String(doc.requestedTeacherId) !== teacherId
  )
    return res
      .status(403)
      .json({ success: false, error: { code: "NOT_REQUESTED_TEACHER" } });
  if (
    to === "CANCELLED" &&
    teacherId &&
    String(doc.requesterTeacherId) !== teacherId
  )
    return res
      .status(403)
      .json({ success: false, error: { code: "NOT_REQUESTER" } });
  doc.status = to;
  doc.decidedAt = new Date();
  await doc.save();
  await audit({
    actorUserId: req.user!.id,
    role: "TEACHER",
    action: `replacement.${to.toLowerCase()}`,
    entity: "ReplacementRequest",
    entityId: String(doc._id),
  });
  res.json({ success: true, data: doc });
}

replacementsRouter.post(
  "/:id/accept",
  requirePermission("replacement.respond"),
  (req: AuthedRequest, res) =>
    decide(req, res as never, String(req.params.id), "ACCEPTED"),
);
replacementsRouter.post(
  "/:id/reject",
  requirePermission("replacement.respond"),
  (req: AuthedRequest, res) =>
    decide(req, res as never, String(req.params.id), "REJECTED"),
);
replacementsRouter.post(
  "/:id/cancel",
  requirePermission("replacement.request"),
  (req: AuthedRequest, res) =>
    decide(req, res as never, String(req.params.id), "CANCELLED"),
);
replacementsRouter.post(
  "/sweep",
  requirePermission("replacement.configure"),
  async (req: AuthedRequest, res) => {
    if (!dbOk(res)) return;
    await sweepExpired();
    await audit({
      actorUserId: req.user!.id,
      role: "PRINCIPAL",
      action: "replacement.sweep",
      entity: "ReplacementRequest",
    });
    res.json({ success: true, data: { swept: true } });
  },
);
