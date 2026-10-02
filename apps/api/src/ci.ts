import { Router } from "express";
import {
  AcademicSession,
  ClassCaptain,
  ClassSession,
  Department,
  DroppedHistory,
  Notice,
  Result,
  RoutineEntry,
  StudentSession,
  Teacher,
  Transfer,
} from "./models.js";
import { dbOk } from "./db-guard.js";
import {
  hydrateScope,
  requireAuth,
  requirePermission,
  type AuthedRequest,
} from "./rbac.js";

export const ciRouter = Router();
ciRouter.use(requireAuth);
ciRouter.use(hydrateScope);

// Department-scoped analytics. CI sees own scope only.
ciRouter.get(
  "/overview",
  requirePermission("student.read"),
  async (req: AuthedRequest, res) => {
    if (!dbOk(res)) return;
    const roles = req.user?.roles ?? [];
    const isPrivileged =
      roles.includes("SUPER_ADMIN") || roles.includes("PRINCIPAL");
    let departmentId = req.query.departmentId
      ? String(req.query.departmentId)
      : undefined;
    const scope = req.user?.departmentScope ?? null;
    if (!isPrivileged) {
      if (!roles.includes("DEPARTMENT_HEAD_CI"))
        return res
          .status(403)
          .json({ success: false, error: { code: "FORBIDDEN_SCOPE" } });
      if (!scope)
        return res
          .status(403)
          .json({ success: false, error: { code: "NO_DEPARTMENT_SCOPE" } });
      if (departmentId && departmentId !== scope)
        return res
          .status(403)
          .json({ success: false, error: { code: "SCOPE_MISMATCH" } });
      departmentId = scope;
    }
    if (!departmentId)
      return res
        .status(400)
        .json({ success: false, error: { code: "DEPARTMENT_REQUIRED" } });

    const today = new Date().toISOString().slice(0, 10);
    const sessionFilter: Record<string, unknown> = {};
    if (req.query.sessionId) sessionFilter._id = String(req.query.sessionId);
    else sessionFilter.state = "ACTIVE";

    const [department, session] = await Promise.all([
      Department.findById(departmentId).lean(),
      AcademicSession.findOne(sessionFilter).lean(),
    ]);
    if (!department)
      return res
        .status(404)
        .json({ success: false, error: { code: "DEPT_NOT_FOUND" } });
    const sessionId = (session as unknown as { _id: unknown } | null)?._id
      ? String((session as unknown as { _id: unknown })._id)
      : undefined;

    const scoped: Record<string, unknown> = { departmentId };
    if (sessionId) scoped.sessionId = sessionId;

    const [
      students,
      teachers,
      captains,
      routines,
      openClasses,
      resultsByStatus,
      dropped,
      transfersPending,
      notices,
    ] = await Promise.all([
      StudentSession.countDocuments(scoped),
      Teacher.countDocuments({ departmentId, status: "ACTIVE" }),
      ClassCaptain.countDocuments({ ...scoped, status: "ACTIVE" }),
      RoutineEntry.countDocuments({ ...scoped, status: "ACTIVE" }),
      ClassSession.countDocuments({ ...scoped, date: today, status: "OPEN" }),
      Result.aggregate([
        { $match: scoped },
        { $group: { _id: "$overallStatus", n: { $sum: 1 } } },
      ]),
      DroppedHistory.countDocuments({
        status: "DROPPED",
        ...(sessionId ? { sessionId } : {}),
      }),
      Transfer.countDocuments({ status: { $in: ["PENDING", "VALIDATED"] } }),
      Notice.find({
        $or: [
          { targetType: "ALL" },
          { targetType: "DEPARTMENT", departmentId },
        ],
        status: "PUBLISHED",
      })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
    ]);

    const alerts: string[] = [];
    if (!session) alerts.push("No ACTIVE session.");
    if (routines === 0)
      alerts.push("No routine entries — create the weekly routine.");

    res.json({
      success: true,
      data: {
        department,
        session: session ?? null,
        students,
        teachers,
        captains,
        routines,
        openClassesToday: openClasses,
        results: resultsByStatus,
        dropped,
        transfersPending,
        notices,
        alerts,
      },
    });
  },
);
