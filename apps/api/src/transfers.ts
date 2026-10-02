import { Router } from "express";
import { z } from "zod";
import {
  Student,
  StudentSession,
  Transfer,
  TransferImport,
  audit,
} from "./models.js";
import { dbOk } from "./db-guard.js";
import { extractRegistrations, extractRolls } from "./transfer-parse.js";
import {
  hydrateScope,
  requireAuth,
  requirePermission,
  type AuthedRequest,
} from "./rbac.js";

export const transfersRouter = Router();
transfersRouter.use(requireAuth);
transfersRouter.use(hydrateScope);

// Step 2: extract from pasted official PDF text (no silent processing).
transfersRouter.post(
  "/parse",
  requirePermission("transfer.import"),
  (req, res) => {
    const text = String((req.body as { text?: string })?.text ?? "");
    if (!text || text.length > 200000)
      return res
        .status(400)
        .json({ success: false, error: { code: "TEXT_REQUIRED" } });
    res.json({
      success: true,
      data: {
        rolls: extractRolls(text),
        registrations: extractRegistrations(text),
      },
    });
  },
);

const rowSchema = z.object({
  roll: z.string().min(1).max(20),
  registrationNumber: z.string().min(1).max(40).optional(),
});

const importSchema = z.object({
  fileName: z.string().max(200).optional(),
  noticeRef: z.string().max(100).optional(),
  noticeDate: z.string().datetime({ offset: true }).optional(),
  sourceInstitute: z.string().max(120).optional(),
  destinationInstitute: z.string().max(120).optional(),
  sourceSessionId: z.string().min(1).optional(),
  destinationSessionId: z.string().min(1).optional(),
  rows: z.array(rowSchema).min(1).max(5000),
});

// Step 1-5: upload → match → PENDING preview (never auto-completes).
transfersRouter.post(
  "/imports",
  requirePermission("transfer.import"),
  async (req: AuthedRequest, res) => {
    if (!dbOk(res)) return;
    const parsed = importSchema.safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({ success: false, error: { code: "VALIDATION_ERROR" } });

    const imp = await TransferImport.create({
      fileName: parsed.data.fileName,
      noticeRef: parsed.data.noticeRef,
      noticeDate: parsed.data.noticeDate
        ? new Date(parsed.data.noticeDate)
        : undefined,
      sourceInstitute: parsed.data.sourceInstitute,
      destinationInstitute: parsed.data.destinationInstitute,
      sourceSessionId: parsed.data.sourceSessionId ?? undefined,
      destinationSessionId: parsed.data.destinationSessionId ?? undefined,
      uploadedBy: req.user!.id,
      totalRows: parsed.data.rows.length,
      matched: 0,
      unmatched: [],
      status: "PENDING",
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
      if (student) matched += 1;
      else unmatched.push(row.registrationNumber ?? row.roll);
      await Transfer.create({
        studentId: student
          ? (student as unknown as { _id: unknown })._id
          : undefined,
        importId: imp._id,
        sourceInstitute: parsed.data.sourceInstitute,
        destinationInstitute: parsed.data.destinationInstitute,
        sourceSessionId: parsed.data.sourceSessionId ?? undefined,
        destinationSessionId: parsed.data.destinationSessionId ?? undefined,
        roll: row.roll,
        registrationNumber: row.registrationNumber,
        status: student ? "VALIDATED" : "PENDING",
      });
    }
    imp.matched = matched;
    imp.unmatched = unmatched;
    imp.status = "VALIDATED";
    await imp.save();
    await audit({
      actorUserId: req.user!.id,
      role: req.user!.roles[0],
      action: "transfer.import",
      entity: "TransferImport",
      entityId: String(imp._id),
      after: { total: parsed.data.rows.length, matched },
    });
    res
      .status(201)
      .json({ success: true, data: { import: imp, matched, unmatched } });
  },
);

transfersRouter.get(
  "/imports",
  requirePermission("transfer.read"),
  async (_req, res) => {
    if (!dbOk(res)) return;
    res.json({
      success: true,
      data: await TransferImport.find()
        .sort({ createdAt: -1 })
        .limit(100)
        .lean(),
    });
  },
);

transfersRouter.get(
  "/",
  requirePermission("transfer.read"),
  async (req, res) => {
    if (!dbOk(res)) return;
    const match: Record<string, unknown> = {};
    if (req.query.importId) match.importId = String(req.query.importId);
    if (req.query.status) match.status = String(req.query.status);
    res.json({
      success: true,
      data: await Transfer.find(match)
        .populate("studentId importId")
        .sort({ createdAt: -1 })
        .limit(500)
        .lean(),
    });
  },
);

// Step 6-7: approve (validated only), then process (transfer + history).
transfersRouter.post(
  "/imports/:id/approve",
  requirePermission("transfer.approve"),
  async (req: AuthedRequest, res) => {
    if (!dbOk(res)) return;
    const imp = await TransferImport.findById(String(req.params.id));
    if (!imp)
      return res
        .status(404)
        .json({ success: false, error: { code: "NOT_FOUND" } });
    if (imp.status !== "VALIDATED" && imp.status !== "PENDING")
      return res
        .status(409)
        .json({ success: false, error: { code: "INVALID_STATE" } });
    await Transfer.updateMany(
      {
        importId: imp._id,
        status: { $in: ["PENDING", "VALIDATED"] },
        studentId: { $exists: true },
      },
      { $set: { status: "APPROVED", approvedBy: req.user!.id } },
    );
    imp.status = "APPROVED";
    await imp.save();
    await audit({
      actorUserId: req.user!.id,
      role: "PRINCIPAL",
      action: "transfer.approve",
      entity: "TransferImport",
      entityId: String(imp._id),
    });
    res.json({ success: true, data: imp });
  },
);

transfersRouter.post(
  "/imports/:id/process",
  requirePermission("transfer.approve"),
  async (req: AuthedRequest, res) => {
    if (!dbOk(res)) return;
    const imp = await TransferImport.findById(String(req.params.id));
    if (!imp)
      return res
        .status(404)
        .json({ success: false, error: { code: "NOT_FOUND" } });
    if (imp.status !== "APPROVED")
      return res
        .status(409)
        .json({ success: false, error: { code: "APPROVE_FIRST" } });
    const approved = await Transfer.find({
      importId: imp._id,
      status: "APPROVED",
    });
    for (const t of approved) {
      const tid = (t as unknown as { studentId?: unknown }).studentId;
      if (!tid) continue;
      const sid = String(tid);
      await Student.findByIdAndUpdate(sid, { status: "TRANSFERRED" });
      const src = (t as unknown as { sourceSessionId?: unknown })
        .sourceSessionId;
      if (src) {
        await StudentSession.findOneAndUpdate(
          { studentId: sid, sessionId: String(src) },
          { status: "TRANSFERRED" },
        );
      }
      t.status = "COMPLETED";
      await t.save();
    }
    imp.status = "COMPLETED";
    await imp.save();
    await audit({
      actorUserId: req.user!.id,
      role: "PRINCIPAL",
      action: "transfer.process",
      entity: "TransferImport",
      entityId: String(imp._id),
      after: { count: approved.length },
    });
    res.json({
      success: true,
      data: { import: imp, processed: approved.length },
    });
  },
);

transfersRouter.post(
  "/imports/:id/reject",
  requirePermission("transfer.approve"),
  async (req: AuthedRequest, res) => {
    if (!dbOk(res)) return;
    const imp = await TransferImport.findByIdAndUpdate(
      String(req.params.id),
      { status: "REJECTED" },
      { new: true },
    ).lean();
    if (!imp)
      return res
        .status(404)
        .json({ success: false, error: { code: "NOT_FOUND" } });
    await Transfer.updateMany(
      { importId: (imp as unknown as { _id: unknown })._id },
      { $set: { status: "REJECTED" } },
    );
    await audit({
      actorUserId: req.user!.id,
      role: "PRINCIPAL",
      action: "transfer.reject",
      entity: "TransferImport",
      entityId: String(req.params.id),
    });
    res.json({ success: true, data: imp });
  },
);
