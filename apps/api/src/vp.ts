import { Router } from "express";
import {
  AcademicSession,
  AttendanceRecord,
  ClassSession,
  Department,
  DroppedHistory,
  Notice,
  ReplacementRequest,
  Result,
  Student,
  StudentSession,
  Teacher,
  Transfer,
} from "./models.js";
import { dbOk } from "./db-guard.js";
import { hydrateScope, requireAuth, requirePermission } from "./rbac.js";

export const vpRouter = Router();
vpRouter.use(requireAuth);
vpRouter.use(hydrateScope);

// Institute operational visibility (read-only aggregates, no writes here).
vpRouter.get(
  "/overview",
  requirePermission("session.read"),
  async (_req, res) => {
    if (!dbOk(res)) return;
    const today = new Date().toISOString().slice(0, 10);
    const [
      activeSession,
      students,
      teachers,
      departments,
      deptStudentRows,
      openClasses,
      closedClasses,
      attendanceRecords,
      notices,
      resultsByStatus,
      transfersPending,
      dropped,
      pendingReplacements,
    ] = await Promise.all([
      AcademicSession.findOne({ state: "ACTIVE" }).lean(),
      Student.countDocuments(),
      Teacher.countDocuments(),
      Department.find().lean(),
      StudentSession.aggregate([
        { $group: { _id: "$departmentId", n: { $sum: 1 } } },
      ]),
      ClassSession.countDocuments({ date: today, status: "OPEN" }),
      ClassSession.countDocuments({ date: today, status: "CLOSED" }),
      AttendanceRecord.countDocuments(),
      Notice.find({ status: "PUBLISHED" })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
      Result.aggregate([{ $group: { _id: "$overallStatus", n: { $sum: 1 } } }]),
      Transfer.countDocuments({
        status: { $in: ["PENDING", "VALIDATED", "APPROVED"] },
      }),
      DroppedHistory.countDocuments({ status: "DROPPED" }),
      ReplacementRequest.countDocuments({ status: "PENDING" }),
    ]);

    const deptCounts = new Map(
      (deptStudentRows as { _id: unknown; n: number }[]).map((r) => [
        String(r._id),
        r.n,
      ]),
    );
    const alerts: string[] = [];
    if (!activeSession)
      alerts.push("No ACTIVE session — Principal must activate one.");
    if (pendingReplacements > 10)
      alerts.push(`${pendingReplacements} replacement requests pending.`);
    if (transfersPending > 0)
      alerts.push(`${transfersPending} transfers awaiting action.`);

    res.json({
      success: true,
      data: {
        activeSession,
        students,
        teachers,
        departments: (
          departments as unknown as {
            _id: unknown;
            code: string;
            name: string;
          }[]
        ).map((d) => ({
          ...d,
          enrollments: deptCounts.get(String(d._id)) ?? 0,
        })),
        attendance: {
          openClassesToday: openClasses,
          closedClassesToday: closedClasses,
          recordsTotal: attendanceRecords,
        },
        notices,
        results: resultsByStatus,
        transfers: { pending: transfersPending },
        dropped,
        alerts,
      },
    });
  },
);
