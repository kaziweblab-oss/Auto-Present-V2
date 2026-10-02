import { Router } from "express";
import {
  AttendanceRecord,
  ClassSession,
  DroppedHistory,
  Holiday,
  Notice,
  Result,
  ResultSubject,
  RoutineEntry,
  Student,
  StudentSession,
  Transfer,
} from "./models.js";
import { dbOk } from "./db-guard.js";
import {
  hydrateScope,
  requireAuth,
  requirePermission,
  type AuthedRequest,
} from "./rbac.js";

export const studentDashRouter = Router();
studentDashRouter.use(requireAuth);
studentDashRouter.use(hydrateScope);

function resolveStudentId(req: AuthedRequest): string | null {
  if (req.query.studentId) return String(req.query.studentId);
  const h = (req.header("x-demo-student-id") as string) || null;
  return h;
}

// Profile + session + routine + attendance + results + notices (student-scoped).
studentDashRouter.get(
  "/overview",
  requirePermission("attendance.read"),
  async (req: AuthedRequest, res) => {
    if (!dbOk(res)) return;
    const studentId = resolveStudentId(req);
    if (!studentId)
      return res
        .status(400)
        .json({ success: false, error: { code: "STUDENT_REQUIRED" } });
    const student = await Student.findById(studentId).lean();
    if (!student)
      return res
        .status(404)
        .json({ success: false, error: { code: "STUDENT_NOT_FOUND" } });

    const history = await StudentSession.find({ studentId })
      .populate("sessionId departmentId classGroupId")
      .sort({ createdAt: 1 })
      .lean();
    const current =
      [...history]
        .reverse()
        .find(
          (h) => (h as unknown as { status: string }).status === "ENROLLED",
        ) ??
      history[history.length - 1] ??
      null;

    const cur = current as unknown as {
      sessionId: { _id?: unknown } | string | null;
      classGroupId: { _id?: unknown } | string | null;
      departmentId: unknown;
      shift: string;
      roll: string;
      status: string;
    } | null;
    const sessionKey = cur?.sessionId
      ? String((cur.sessionId as { _id?: unknown })._id ?? cur.sessionId)
      : null;
    const classKey = cur?.classGroupId
      ? String((cur.classGroupId as { _id?: unknown })._id ?? cur.classGroupId)
      : null;

    const [
      routine,
      sessions,
      records,
      results,
      subjects,
      dropped,
      transfers,
      notices,
      holidays,
    ] = await Promise.all([
      classKey
        ? RoutineEntry.find({ classGroupId: classKey, status: "ACTIVE" })
            .populate("subjectId teacherId")
            .sort({ day: 1, startTime: 1 })
            .limit(100)
            .lean()
        : [],
      sessionKey
        ? ClassSession.find({ classGroupId: classKey })
            .sort({ date: -1 })
            .limit(20)
            .lean()
        : [],
      AttendanceRecord.find({ studentId }).limit(200).lean(),
      Result.find({ studentId }).populate("sessionId importId").lean(),
      ResultSubject.find({ studentId }).limit(200).lean(),
      DroppedHistory.find({ studentId }).sort({ createdAt: 1 }).lean(),
      Transfer.find({ studentId }).sort({ createdAt: -1 }).limit(20).lean(),
      Notice.find({ status: "PUBLISHED" })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
      Holiday.find({
        status: "ACTIVE",
        date: { $gte: new Date().toISOString().slice(0, 10) },
      })
        .sort({ date: 1 })
        .limit(5)
        .lean(),
    ]);

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

    res.json({
      success: true,
      data: {
        student,
        current,
        history,
        routine,
        recentSessions: sessions,
        attendance: { summary, recent: records.slice(-20).reverse() },
        results: { results, subjects, dropped },
        transfers,
        notices,
        holidays,
      },
    });
  },
);
