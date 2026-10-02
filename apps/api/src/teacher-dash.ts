import { Router } from "express";
import {
  AttendanceRecord,
  ClassCaptain,
  ClassSession,
  Notice,
  ReplacementRequest,
  RoutineEntry,
  Teacher,
} from "./models.js";
import { dbOk } from "./db-guard.js";
import { todayStr } from "./attendance-time.js";
import {
  hydrateScope,
  requireAuth,
  requirePermission,
  type AuthedRequest,
} from "./rbac.js";

export const teacherDashRouter = Router();
teacherDashRouter.use(requireAuth);
teacherDashRouter.use(hydrateScope);

const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;

async function resolveTeacherId(req: AuthedRequest): Promise<string | null> {
  const q = req.query.teacherId ? String(req.query.teacherId) : null;
  if (q) return q;
  const h = (req.header("x-demo-teacher-id") as string) || null;
  if (h) return h;
  try {
    const t = (await Teacher.findOne({
      userId: req.user!.id,
    }).lean()) as unknown as {
      _id: unknown;
    } | null;
    if (t) return String(t._id);
  } catch {
    /* demo ids are not ObjectIds */
  }
  return null;
}

// Personal schedule + classes + requests + notices (teacher-scoped).
teacherDashRouter.get(
  "/overview",
  requirePermission("attendance.take"),
  async (req: AuthedRequest, res) => {
    if (!dbOk(res)) return;
    const teacherId = await resolveTeacherId(req);
    if (!teacherId)
      return res
        .status(400)
        .json({ success: false, error: { code: "TEACHER_REQUIRED" } });
    const teacher = await Teacher.findById(teacherId).lean();
    if (!teacher)
      return res
        .status(404)
        .json({ success: false, error: { code: "TEACHER_NOT_FOUND" } });
    const today = todayStr();
    const weekday = DAYS[new Date().getDay()];
    const [todaysRoutines, sessionsToday, incoming, outgoing, notices, marked] =
      await Promise.all([
        RoutineEntry.find({ teacherId, day: weekday, status: "ACTIVE" })
          .populate("subjectId classGroupId")
          .sort({ startTime: 1 })
          .lean(),
        ClassSession.find({ teacherId, date: today })
          .populate("subjectId classGroupId")
          .lean(),
        ReplacementRequest.find({
          requestedTeacherId: teacherId,
          status: "PENDING",
        })
          .sort({ createdAt: -1 })
          .limit(20)
          .lean(),
        ReplacementRequest.find({ requesterTeacherId: teacherId })
          .sort({ createdAt: -1 })
          .limit(20)
          .lean(),
        Notice.find({ status: "PUBLISHED" })
          .sort({ createdAt: -1 })
          .limit(5)
          .lean(),
        AttendanceRecord.countDocuments({}).catch(() => 0),
      ]);
    const classIds = [
      ...new Set(
        (todaysRoutines as unknown as { classGroupId: unknown }[]).map((r) =>
          String(r.classGroupId),
        ),
      ),
    ];
    const captains =
      classIds.length > 0
        ? await ClassCaptain.find({
            classGroupId: { $in: classIds },
            status: "ACTIVE",
          })
            .populate("studentId")
            .lean()
        : [];
    const weekRoutine = await RoutineEntry.find({ teacherId, status: "ACTIVE" })
      .sort({ day: 1, startTime: 1 })
      .limit(100)
      .lean();
    res.json({
      success: true,
      data: {
        teacher,
        today: {
          date: today,
          weekday,
          routines: todaysRoutines,
          sessions: sessionsToday,
        },
        replacements: { incoming, outgoing },
        notices,
        captains,
        weekRoutine,
        attendance: { markedTotal: marked },
      },
    });
  },
);
