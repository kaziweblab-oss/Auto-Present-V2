import { Router } from "express";
import { z } from "zod";
import {
  AttendanceRecord,
  ClassSession,
  RoutineEntry,
  StudentSession,
  audit,
} from "./models.js";
import { dbOk } from "./db-guard.js";
import { nowMinutes, todayStr, windowFor } from "./attendance-time.js";
import {
  hydrateScope,
  requireAnyPermission,
  requireAuth,
  requirePermission,
  type AuthedRequest,
} from "./rbac.js";

export const attendanceRouter = Router();
attendanceRouter.use(requireAuth);
attendanceRouter.use(hydrateScope);

const openSchema = z.object({
  routineEntryId: z.string().min(1),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

// Open today's class session from a routine entry.
attendanceRouter.post(
  "/sessions/open",
  requireAnyPermission("attendance.take", "routine.manage"),
  async (req: AuthedRequest, res) => {
    if (!dbOk(res)) return;
    const parsed = openSchema.safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({ success: false, error: { code: "VALIDATION_ERROR" } });
    const routine = await RoutineEntry.findById(
      parsed.data.routineEntryId,
    ).lean();
    if (
      !routine ||
      (routine as unknown as { status: string }).status !== "ACTIVE"
    )
      return res
        .status(404)
        .json({ success: false, error: { code: "ROUTINE_NOT_FOUND" } });
    const r = routine as unknown as {
      sessionId: unknown;
      departmentId: unknown;
      classGroupId: unknown;
      subjectId: unknown;
      teacherId: unknown;
      startTime: string;
      endTime: string;
    };
    const date = parsed.data.date ?? todayStr();
    try {
      const s = await ClassSession.create({
        routineEntryId: parsed.data.routineEntryId,
        sessionId: r.sessionId,
        departmentId: r.departmentId,
        classGroupId: r.classGroupId,
        subjectId: r.subjectId,
        teacherId: r.teacherId,
        date,
        startTime: r.startTime,
        endTime: r.endTime,
        status: "OPEN",
      });
      await audit({
        actorUserId: req.user!.id,
        role: req.user!.roles[0],
        action: "attendance.open",
        entity: "ClassSession",
        entityId: String(s._id),
      });
      res.status(201).json({ success: true, data: s });
    } catch {
      const existing = await ClassSession.findOne({
        routineEntryId: parsed.data.routineEntryId,
        date,
      }).lean();
      res.status(200).json({ success: true, data: existing });
    }
  },
);

attendanceRouter.get(
  "/sessions",
  requireAnyPermission("attendance.read", "attendance.take"),
  async (req, res) => {
    if (!dbOk(res)) return;
    const match: Record<string, unknown> = {};
    for (const k of [
      "sessionId",
      "teacherId",
      "classGroupId",
      "date",
      "status",
    ] as const) {
      if (req.query[k]) match[k] = String(req.query[k]);
    }
    if (!match.date) match.date = todayStr();
    const items = await ClassSession.find(match)
      .populate("subjectId teacherId classGroupId")
      .sort({ startTime: 1 })
      .limit(200)
      .lean();
    const now = nowMinutes();
    const withWindow = items.map((s) => {
      const r = s as unknown as {
        startTime: string;
        endTime: string;
        status: string;
      };
      const computed =
        r.status !== "OPEN" ? "CLOSED" : windowFor(r.startTime, r.endTime, now);
      return { ...s, window: computed, serverNow: now };
    });
    res.json({ success: true, data: withWindow });
  },
);

async function autoCloseIfPast(id: string) {
  const s = await ClassSession.findById(id);
  if (!s || s.status !== "OPEN") return s;
  if (
    nowMinutes() >
    Number(String(s.endTime).slice(0, 2)) * 60 +
      Number(String(s.endTime).slice(3))
  ) {
    s.status = "CLOSED";
    await s.save();
  }
  return s;
}

attendanceRouter.get(
  "/sessions/:id",
  requireAnyPermission("attendance.read", "attendance.take"),
  async (req, res) => {
    if (!dbOk(res)) return;
    const sid = String(req.params.id);
    await autoCloseIfPast(sid);
    const s = await ClassSession.findById(sid)
      .populate("subjectId teacherId classGroupId sessionId")
      .lean();
    if (!s)
      return res
        .status(404)
        .json({ success: false, error: { code: "SESSION_NOT_FOUND" } });
    const records = await AttendanceRecord.find({ classSessionId: sid })
      .populate("studentId")
      .lean();
    const r = s as unknown as {
      startTime: string;
      endTime: string;
      status: string;
    };
    const now = nowMinutes();
    const window =
      r.status !== "OPEN" ? "CLOSED" : windowFor(r.startTime, r.endTime, now);
    const counts = {
      PRESENT: records.filter(
        (x) => (x as unknown as { status: string }).status === "PRESENT",
      ).length,
      LATE: records.filter(
        (x) => (x as unknown as { status: string }).status === "LATE",
      ).length,
      ABSENT: records.filter(
        (x) => (x as unknown as { status: string }).status === "ABSENT",
      ).length,
      EXCUSED: records.filter(
        (x) => (x as unknown as { status: string }).status === "EXCUSED",
      ).length,
    };
    res.json({
      success: true,
      data: { session: s, records, counts, window, serverNow: now },
    });
  },
);

const markSchema = z.object({
  studentId: z.string().min(1),
  status: z.enum(["PRESENT", "LATE", "ABSENT", "EXCUSED"]),
});

// Server enforces PRESENT-first-half / LATE-second-half / CLOSED-blocked.
attendanceRouter.post(
  "/sessions/:id/mark",
  requirePermission("attendance.take"),
  async (req: AuthedRequest, res) => {
    if (!dbOk(res)) return;
    const parsed = markSchema.safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({ success: false, error: { code: "VALIDATION_ERROR" } });
    const sid = String(req.params.id);
    await autoCloseIfPast(sid);
    const s = await ClassSession.findById(sid);
    if (!s)
      return res
        .status(404)
        .json({ success: false, error: { code: "SESSION_NOT_FOUND" } });
    if (s.status !== "OPEN")
      return res
        .status(409)
        .json({ success: false, error: { code: "ATTENDANCE_CLOSED" } });
    const window = windowFor(
      s.startTime as string,
      s.endTime as string,
      nowMinutes(),
    );
    if (window === "NOT_OPEN")
      return res
        .status(409)
        .json({ success: false, error: { code: "ATTENDANCE_NOT_OPEN" } });
    if (window === "CLOSED") {
      s.status = "CLOSED";
      await s.save();
      return res
        .status(409)
        .json({ success: false, error: { code: "ATTENDANCE_CLOSED" } });
    }
    if (parsed.data.status === "PRESENT" && window !== "PRESENT")
      return res
        .status(409)
        .json({ success: false, error: { code: "PRESENT_WINDOW_PASSED" } });
    if (parsed.data.status === "LATE" && window !== "LATE")
      return res
        .status(409)
        .json({ success: false, error: { code: "LATE_WINDOW_ONLY" } });

    const enrolled = await StudentSession.findOne({
      studentId: parsed.data.studentId,
      sessionId: s.sessionId,
    }).lean();
    if (!enrolled)
      return res
        .status(409)
        .json({ success: false, error: { code: "STUDENT_NOT_ENROLLED" } });

    const record = await AttendanceRecord.findOneAndUpdate(
      { classSessionId: sid, studentId: parsed.data.studentId },
      { status: parsed.data.status, markedBy: req.user!.id },
      { upsert: true, new: true },
    );
    await audit({
      actorUserId: req.user!.id,
      role: req.user!.roles[0],
      action: "attendance.mark",
      entity: "AttendanceRecord",
      entityId: String(record._id),
      after: { status: parsed.data.status },
    });
    res.json({ success: true, data: record });
  },
);

attendanceRouter.post(
  "/sessions/:id/close",
  requireAnyPermission("attendance.take", "routine.manage"),
  async (req: AuthedRequest, res) => {
    if (!dbOk(res)) return;
    const s = await ClassSession.findByIdAndUpdate(
      String(req.params.id),
      { status: "CLOSED" },
      { new: true },
    ).lean();
    if (!s)
      return res
        .status(404)
        .json({ success: false, error: { code: "SESSION_NOT_FOUND" } });
    await audit({
      actorUserId: req.user!.id,
      role: req.user!.roles[0],
      action: "attendance.close",
      entity: "ClassSession",
      entityId: String(req.params.id),
    });
    res.json({ success: true, data: s });
  },
);

attendanceRouter.get(
  "/summary",
  requireAnyPermission("attendance.read", "attendance.take"),
  async (req, res) => {
    if (!dbOk(res)) return;
    const { studentId, sessionId } = req.query as {
      studentId?: string;
      sessionId?: string;
    };
    if (!studentId)
      return res
        .status(400)
        .json({ success: false, error: { code: "STUDENT_REQUIRED" } });
    const match: Record<string, unknown> = { studentId };
    if (sessionId) {
      const sessions = await ClassSession.find({ sessionId })
        .select("_id")
        .lean();
      match.classSessionId = { $in: sessions.map((s) => s._id) };
    }
    const records = await AttendanceRecord.find(match).lean();
    const summary = {
      total: records.length,
      PRESENT: records.filter(
        (r) => (r as unknown as { status: string }).status === "PRESENT",
      ).length,
      LATE: records.filter(
        (r) => (r as unknown as { status: string }).status === "LATE",
      ).length,
      ABSENT: records.filter(
        (r) => (r as unknown as { status: string }).status === "ABSENT",
      ).length,
      EXCUSED: records.filter(
        (r) => (r as unknown as { status: string }).status === "EXCUSED",
      ).length,
    };
    res.json({ success: true, data: summary });
  },
);
