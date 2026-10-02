import { Router } from "express";
import {
  AcademicSession,
  AttendanceRecord,
  AuditLog,
  ClassSession,
  Department,
  ReplacementRequest,
  Student,
  SystemSetting,
  Teacher,
  Transfer,
  User,
  audit,
} from "./models.js";
import { dbOk } from "./db-guard.js";
import { isDbConfigured } from "./db-config.js";
import {
  hydrateScope,
  requireAuth,
  requirePermission,
  type AuthedRequest,
} from "./rbac.js";

export const adminRouter = Router();
adminRouter.use(requireAuth);
adminRouter.use(hydrateScope);

// Dashboard: system health + institute snapshot (no fake data).
adminRouter.get(
  "/overview",
  requirePermission("audit.read"),
  async (_req, res) => {
    if (!dbOk(res)) return;
    const today = new Date().toISOString().slice(0, 10);
    const [
      users,
      activeUsers,
      byRole,
      sessions,
      activeSession,
      departments,
      students,
      teachers,
      openClasses,
      pendingReplacements,
      pendingTransfers,
      recentAudits,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ status: "ACTIVE" }),
      User.aggregate([
        { $unwind: "$roles" },
        { $group: { _id: "$roles", n: { $sum: 1 } } },
      ]),
      AcademicSession.countDocuments(),
      AcademicSession.findOne({ state: "ACTIVE" }).lean(),
      Department.countDocuments(),
      Student.countDocuments(),
      Teacher.countDocuments(),
      ClassSession.countDocuments({ date: today, status: "OPEN" }),
      ReplacementRequest.countDocuments({ status: "PENDING" }),
      Transfer.countDocuments({
        status: { $in: ["PENDING", "VALIDATED", "APPROVED"] },
      }),
      AuditLog.find().sort({ createdAt: -1 }).limit(10).lean(),
    ]);
    const attendanceToday = await AttendanceRecord.countDocuments().catch(
      () => 0,
    );
    res.json({
      success: true,
      data: {
        users: { total: users, active: activeUsers, byRole },
        sessions: { total: sessions, active: activeSession },
        departments,
        students,
        teachers,
        attendance: {
          openClassesToday: openClasses,
          recordsTotal: attendanceToday,
        },
        pending: {
          replacements: pendingReplacements,
          transfers: pendingTransfers,
        },
        recentAudits,
        db: { configured: isDbConfigured() },
        uptime: process.uptime(),
      },
    });
  },
);

// Audit viewer with filters + pagination (append-only, no edit/delete routes).
function auditMatch(q: Record<string, unknown>): Record<string, unknown> {
  const match: Record<string, unknown> = {};
  if (q.action) match.action = String(q.action);
  if (q.entity) match.entity = String(q.entity);
  if (q.role) match.role = String(q.role);
  if (q.actorUserId) match.actorUserId = String(q.actorUserId);
  if (q.sessionId) match.sessionId = String(q.sessionId);
  if (q.departmentId) match.departmentId = String(q.departmentId);
  if (q.from || q.to) {
    match.createdAt = {
      ...(q.from ? { $gte: new Date(String(q.from)) } : {}),
      ...(q.to ? { $lte: new Date(String(q.to)) } : {}),
    };
  }
  if (q.q) {
    const s = String(q.q);
    match.$or = [
      { action: new RegExp(s, "i") },
      { entity: new RegExp(s, "i") },
      { entityId: new RegExp(s, "i") },
    ];
  }
  return match;
}

export function toCsv(rows: Record<string, unknown>[]): string {
  const cols = [
    "createdAt",
    "actorUserId",
    "role",
    "action",
    "entity",
    "entityId",
  ];
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [
    cols.join(","),
    ...rows.map((r) => cols.map((c) => esc(r[c])).join(",")),
  ].join("\n");
}

adminRouter.get("/audit", requirePermission("audit.read"), async (req, res) => {
  if (!dbOk(res)) return;
  const page = Math.max(1, Number(req.query.page ?? 1));
  const limit = Math.min(200, Math.max(1, Number(req.query.limit ?? 50)));
  const match = auditMatch(req.query as Record<string, unknown>);
  const [items, total] = await Promise.all([
    AuditLog.find(match)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    AuditLog.countDocuments(match),
  ]);
  res.json({ success: true, data: { items, total, page, limit } });
});

adminRouter.get(
  "/audit/export",
  requirePermission("audit.read"),
  async (req, res) => {
    if (!dbOk(res)) return;
    const match = auditMatch(req.query as Record<string, unknown>);
    const rows = (await AuditLog.find(match)
      .sort({ createdAt: -1 })
      .limit(5000)
      .lean()) as unknown as Record<string, unknown>[];
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=audit.csv");
    res.send(toCsv(rows));
  },
);

adminRouter.get(
  "/reports/summary",
  requirePermission("audit.read"),
  async (req, res) => {
    if (!dbOk(res)) return;
    const match = auditMatch(req.query as Record<string, unknown>);
    const [byAction, byEntity, byRole, total] = await Promise.all([
      AuditLog.aggregate([
        { $match: match },
        { $group: { _id: "$action", n: { $sum: 1 } } },
        { $sort: { n: -1 } },
        { $limit: 20 },
      ]),
      AuditLog.aggregate([
        { $match: match },
        { $group: { _id: "$entity", n: { $sum: 1 } } },
        { $sort: { n: -1 } },
        { $limit: 20 },
      ]),
      AuditLog.aggregate([
        { $match: match },
        { $group: { _id: "$role", n: { $sum: 1 } } },
      ]),
      AuditLog.countDocuments(match),
    ]);
    res.json({ success: true, data: { total, byAction, byEntity, byRole } });
  },
);

adminRouter.get(
  "/audit/actions",
  requirePermission("audit.read"),
  async (_req, res) => {
    if (!dbOk(res)) return;
    res.json({ success: true, data: await AuditLog.distinct("action") });
  },
);

// System settings (SUPER_ADMIN only via settings.manage).
adminRouter.get(
  "/settings",
  requirePermission("settings.manage"),
  async (_req, res) => {
    if (!dbOk(res)) return;
    res.json({
      success: true,
      data: await SystemSetting.find().sort({ key: 1 }).limit(200).lean(),
    });
  },
);

adminRouter.put(
  "/settings/:key",
  requirePermission("settings.manage"),
  async (req: AuthedRequest, res) => {
    if (!dbOk(res)) return;
    const key = String(req.params.key);
    if (!/^[a-z0-9._-]{3,80}$/.test(key))
      return res
        .status(400)
        .json({ success: false, error: { code: "INVALID_KEY" } });
    const before = await SystemSetting.findOne({ key }).lean();
    const doc = await SystemSetting.findOneAndUpdate(
      { key },
      {
        value: (req.body as { value?: unknown }).value,
        updatedBy: req.user!.id,
      },
      { upsert: true, new: true },
    );
    await audit({
      actorUserId: req.user!.id,
      role: "SUPER_ADMIN",
      action: "settings.update",
      entity: "SystemSetting",
      entityId: key,
      before: (before as unknown as { value?: unknown } | null)?.value,
      after: (req.body as { value?: unknown }).value,
    });
    res.json({ success: true, data: doc });
  },
);
