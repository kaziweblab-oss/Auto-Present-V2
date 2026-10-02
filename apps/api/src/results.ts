import { Router } from "express";
import { z } from "zod";
import {
  AcademicSession,
  Department,
  DroppedHistory,
  Result,
  ResultImport,
  ResultSubject,
  Student,
  StudentSession,
  audit,
} from "./models.js";
import { dbOk } from "./db-guard.js";
import {
  hydrateScope,
  requireAuth,
  requirePermission,
  type AuthedRequest,
} from "./rbac.js";

export const resultsRouter = Router();
resultsRouter.use(requireAuth);
resultsRouter.use(hydrateScope);

const rowSchema = z.object({
  roll: z.string().min(1).max(20),
  registrationNumber: z.string().min(1).max(40).optional(),
  overallStatus: z.enum([
    "PASSED",
    "FAILED",
    "DROPPED",
    "RETAINED",
    "TRANSFERRED",
    "COMPLETED",
  ]),
  gpa: z.number().min(0).max(4).optional(),
  subjects: z
    .array(
      z.object({
        subjectCode: z.string().min(1).max(20),
        grade: z.string().max(10).optional(),
        status: z.enum(["PASSED", "FAILED"]).default("PASSED"),
      }),
    )
    .default([]),
});

const importSchema = z.object({
  sessionId: z.string().min(1),
  departmentId: z.string().min(1),
  source: z.enum(["BTEB_BOARD", "BTEB_REVISED"]).default("BTEB_BOARD"),
  publicationDate: z.string().datetime({ offset: true }),
  fileName: z.string().max(200).optional(),
  rows: z.array(rowSchema).min(1).max(5000),
});

// Import official BTEB result → match → store → derive DROPPED. Audited.
resultsRouter.post(
  "/imports",
  requirePermission("result.import"),
  async (req: AuthedRequest, res) => {
    if (!dbOk(res)) return;
    const parsed = importSchema.safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({ success: false, error: { code: "VALIDATION_ERROR" } });
    const sess = await AcademicSession.findById(parsed.data.sessionId).lean();
    const dept = await Department.findById(parsed.data.departmentId).lean();
    if (!sess)
      return res
        .status(400)
        .json({ success: false, error: { code: "SESSION_NOT_FOUND" } });
    if (!dept)
      return res
        .status(400)
        .json({ success: false, error: { code: "DEPT_NOT_FOUND" } });

    const imp = await ResultImport.create({
      source: parsed.data.source,
      publicationDate: new Date(parsed.data.publicationDate),
      fileName: parsed.data.fileName,
      importedBy: req.user!.id,
      totalRows: parsed.data.rows.length,
      matched: 0,
      unmatched: [],
      status: "COMPLETED",
    });

    let matched = 0;
    const unmatched: string[] = [];
    for (const row of parsed.data.rows) {
      const student =
        (row.registrationNumber &&
          (await Student.findOne({
            registrationNumber: row.registrationNumber,
          }))) ||
        (await Student.findOne({ roll: row.roll }));
      if (!student) {
        unmatched.push(row.registrationNumber ?? row.roll);
        continue;
      }
      const sid = String((student as unknown as { _id: unknown })._id);
      const result = await Result.findOneAndUpdate(
        { studentId: sid, sessionId: parsed.data.sessionId },
        {
          studentId: sid,
          sessionId: parsed.data.sessionId,
          departmentId: parsed.data.departmentId,
          importId: imp._id,
          overallStatus: row.overallStatus,
          gpa: row.gpa,
          publishedAt: new Date(parsed.data.publicationDate),
        },
        { upsert: true, new: true },
      );
      await ResultSubject.deleteMany({ resultId: result._id });
      if (row.subjects.length > 0) {
        await ResultSubject.insertMany(
          row.subjects.map((s) => ({
            resultId: result._id,
            studentId: sid,
            sessionId: parsed.data.sessionId,
            subjectCode: s.subjectCode.toUpperCase(),
            grade: s.grade,
            status: s.status,
          })),
        );
      }
      // DROPPED derived from official status — history preserved.
      if (row.overallStatus === "DROPPED") {
        await Student.findByIdAndUpdate(sid, { status: "DROPPED" });
        await StudentSession.findOneAndUpdate(
          { studentId: sid, sessionId: parsed.data.sessionId },
          { status: "DROPPED" },
        );
        await DroppedHistory.create({
          studentId: sid,
          sessionId: parsed.data.sessionId,
          resultId: result._id,
          importId: imp._id,
          status: "DROPPED",
          note: `Official ${parsed.data.source} ${parsed.data.publicationDate}`,
        });
      }
      matched += 1;
    }
    imp.matched = matched;
    imp.unmatched = unmatched;
    await imp.save();
    await audit({
      actorUserId: req.user!.id,
      role: "PRINCIPAL",
      action: "result.import",
      entity: "ResultImport",
      entityId: String(imp._id),
      after: {
        total: parsed.data.rows.length,
        matched,
        unmatched: unmatched.length,
      },
    });
    res
      .status(201)
      .json({ success: true, data: { import: imp, matched, unmatched } });
  },
);

resultsRouter.get(
  "/imports",
  requirePermission("result.read"),
  async (_req, res) => {
    if (!dbOk(res)) return;
    const items = await ResultImport.find()
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    res.json({ success: true, data: items });
  },
);

resultsRouter.get("/", requirePermission("result.read"), async (req, res) => {
  if (!dbOk(res)) return;
  const match: Record<string, unknown> = {};
  if (req.query.sessionId) match.sessionId = String(req.query.sessionId);
  if (req.query.overallStatus)
    match.overallStatus = String(req.query.overallStatus);
  if (req.query.departmentId)
    match.departmentId = String(req.query.departmentId);
  const items = await Result.find(match)
    .populate("studentId sessionId")
    .sort({ createdAt: -1 })
    .limit(500)
    .lean();
  res.json({ success: true, data: items });
});

resultsRouter.get(
  "/dropped",
  requirePermission("result.read"),
  async (req, res) => {
    if (!dbOk(res)) return;
    const match: Record<string, unknown> = { status: "DROPPED" };
    if (req.query.sessionId) match.sessionId = String(req.query.sessionId);
    const items = await DroppedHistory.find(match)
      .populate("studentId sessionId importId")
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();
    res.json({ success: true, data: items });
  },
);

resultsRouter.get(
  "/students/:id",
  requirePermission("result.read"),
  async (req, res) => {
    if (!dbOk(res)) return;
    const sid = String(req.params.id);
    const results = await Result.find({ studentId: sid })
      .populate("sessionId importId")
      .sort({ createdAt: 1 })
      .lean();
    const subjects = await ResultSubject.find({ studentId: sid })
      .limit(500)
      .lean();
    const dropped = await DroppedHistory.find({ studentId: sid })
      .sort({ createdAt: 1 })
      .lean();
    res.json({ success: true, data: { results, subjects, dropped } });
  },
);
