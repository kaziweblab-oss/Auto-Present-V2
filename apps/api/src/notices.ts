import { Router } from "express";
import { z } from "zod";
import { Notice, NoticeRead, audit } from "./models.js";
import { dbOk } from "./db-guard.js";
import {
  hydrateScope,
  requireAuth,
  requirePermission,
  type AuthedRequest,
} from "./rbac.js";

export const noticesRouter = Router();
noticesRouter.use(requireAuth);
noticesRouter.use(hydrateScope);

const createSchema = z.object({
  title: z.string().min(3).max(200),
  body: z.string().min(1).max(10000),
  attachment: z.string().max(2000).optional(),
  targetType: z.enum([
    "ALL",
    "ROLE",
    "DEPARTMENT",
    "SESSION",
    "CLASS",
    "STUDENT",
    "CAPTAIN",
    "SHIFT",
  ]),
  targetRole: z.string().min(1).optional(),
  departmentId: z.string().min(1).optional(),
  sessionId: z.string().min(1).optional(),
  classGroupId: z.string().min(1).optional(),
  studentId: z.string().min(1).optional(),
  shift: z.enum(["1ST", "2ND"]).optional(),
  publishAt: z.string().datetime({ offset: true }).optional(),
  expiresAt: z.string().datetime({ offset: true }).optional(),
  priority: z.enum(["NORMAL", "IMPORTANT", "URGENT"]).default("NORMAL"),
  ackRequired: z.boolean().default(false),
});

function needFor(t: string): string[] {
  switch (t) {
    case "ROLE":
      return ["targetRole"];
    case "DEPARTMENT":
      return ["departmentId"];
    case "SESSION":
      return ["sessionId"];
    case "CLASS":
      return ["classGroupId"];
    case "STUDENT":
      return ["studentId"];
    case "SHIFT":
      return ["shift"];
    default:
      return [];
  }
}

noticesRouter.post(
  "/",
  requirePermission("notice.create"),
  async (req: AuthedRequest, res) => {
    if (!dbOk(res)) return;
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({ success: false, error: { code: "VALIDATION_ERROR" } });
    for (const f of needFor(parsed.data.targetType)) {
      if (!(parsed.data as Record<string, unknown>)[f])
        return res.status(400).json({
          success: false,
          error: { code: "TARGET_REQUIRED", field: f },
        });
    }
    // CI may only target own department; teachers own class scope enforced later.
    const roles = req.user?.roles ?? [];
    if (
      roles.includes("DEPARTMENT_HEAD_CI") &&
      !roles.includes("PRINCIPAL") &&
      parsed.data.departmentId &&
      req.user?.departmentScope &&
      parsed.data.departmentId !== req.user.departmentScope
    )
      return res
        .status(403)
        .json({ success: false, error: { code: "SCOPE_MISMATCH" } });

    const doc = await Notice.create({
      ...parsed.data,
      publishAt: parsed.data.publishAt
        ? new Date(parsed.data.publishAt)
        : new Date(),
      expiresAt: parsed.data.expiresAt
        ? new Date(parsed.data.expiresAt)
        : undefined,
      createdBy: req.user!.id,
      senderRole: req.user!.roles[0],
    });
    await audit({
      actorUserId: req.user!.id,
      role: req.user!.roles[0],
      action: "notice.publish",
      entity: "Notice",
      entityId: String(doc._id),
    });
    res.status(201).json({ success: true, data: doc });
  },
);

type Viewer = {
  userId: string;
  roles: string[];
  departmentScope?: string | null;
  studentId?: string | null;
  classGroupIds?: string[];
  sessionId?: string | null;
  shift?: string | null;
};

function viewerFrom(req: AuthedRequest): Viewer {
  return {
    userId: req.user!.id,
    roles: req.user!.roles ?? [],
    departmentScope: req.user?.departmentScope ?? null,
    studentId: (req.header("x-demo-student-id") as string) || null,
    classGroupIds: ((req.header("x-demo-class-ids") as string) || "")
      .split(",")
      .filter(Boolean),
    sessionId: (req.header("x-demo-session-id") as string) || null,
    shift: (req.header("x-demo-shift") as string) || null,
  };
}

function matchFor(v: Viewer): Record<string, unknown> {
  const now = new Date();
  const base: Record<string, unknown> = {
    status: "PUBLISHED",
    publishAt: { $lte: now },
    $and: [{ $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] }],
  };
  const ors: Record<string, unknown>[] = [{ targetType: "ALL" }];
  if (v.roles.length > 0) {
    ors.push({ targetType: "ROLE", targetRole: { $in: v.roles } });
    ors.push({ targetType: "CAPTAIN" }); // captains read via class membership below
  }
  if (v.departmentScope)
    ors.push({ targetType: "DEPARTMENT", departmentId: v.departmentScope });
  if (v.sessionId) ors.push({ targetType: "SESSION", sessionId: v.sessionId });
  if (v.classGroupIds && v.classGroupIds.length > 0)
    ors.push({ targetType: "CLASS", classGroupId: { $in: v.classGroupIds } });
  if (v.studentId) ors.push({ targetType: "STUDENT", studentId: v.studentId });
  if (v.shift) ors.push({ targetType: "SHIFT", shift: v.shift });
  return { ...base, $or: ors };
}

// Inbox: visible notices + per-user read state (never global).
noticesRouter.get(
  "/",
  requirePermission("notice.read"),
  async (req: AuthedRequest, res) => {
    if (!dbOk(res)) return;
    await Notice.updateMany(
      { status: "PUBLISHED", expiresAt: { $lt: new Date() } },
      { $set: { status: "EXPIRED" } },
    );
    const v = viewerFrom(req);
    const items = await Notice.find(matchFor(v))
      .sort({ priority: -1, createdAt: -1 })
      .limit(200)
      .lean();
    const reads = await NoticeRead.find({
      userId: v.userId,
      noticeId: { $in: items.map((n) => n._id) },
    }).lean();
    const byNotice = new Map(
      reads.map((r) => [
        String((r as unknown as { noticeId: unknown }).noticeId),
        r,
      ]),
    );
    res.json({
      success: true,
      data: items.map((n) => {
        const r = byNotice.get(String((n as { _id: unknown })._id)) as
          { readAt?: Date; acknowledgedAt?: Date } | undefined;
        return {
          ...n,
          read: !!r,
          readAt: r?.readAt ?? null,
          acknowledgedAt: r?.acknowledgedAt ?? null,
        };
      }),
    });
  },
);

noticesRouter.post(
  "/:id/read",
  requirePermission("notice.read"),
  async (req: AuthedRequest, res) => {
    if (!dbOk(res)) return;
    const nid = String(req.params.id);
    const doc = await Notice.findById(nid).lean();
    if (!doc)
      return res
        .status(404)
        .json({ success: false, error: { code: "NOT_FOUND" } });
    const read = await NoticeRead.findOneAndUpdate(
      { noticeId: nid, userId: req.user!.id },
      { readAt: new Date() },
      { upsert: true, new: true },
    );
    res.json({ success: true, data: read });
  },
);

noticesRouter.post(
  "/:id/acknowledge",
  requirePermission("notice.read"),
  async (req: AuthedRequest, res) => {
    if (!dbOk(res)) return;
    const nid = String(req.params.id);
    const doc = await Notice.findById(nid).lean();
    if (!doc)
      return res
        .status(404)
        .json({ success: false, error: { code: "NOT_FOUND" } });
    const read = await NoticeRead.findOneAndUpdate(
      { noticeId: nid, userId: req.user!.id },
      { readAt: new Date(), acknowledgedAt: new Date() },
      { upsert: true, new: true },
    );
    await audit({
      actorUserId: req.user!.id,
      role: req.user!.roles[0],
      action: "notice.acknowledge",
      entity: "Notice",
      entityId: nid,
    });
    res.json({ success: true, data: read });
  },
);

noticesRouter.get(
  "/:id/reads",
  requirePermission("notice.create"),
  async (req, res) => {
    if (!dbOk(res)) return;
    const reads = await NoticeRead.find({ noticeId: String(req.params.id) })
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();
    res.json({ success: true, data: reads });
  },
);
