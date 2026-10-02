import { Router } from "express";
import { z } from "zod";
import {
  AcademicSession,
  DroppedHistory,
  Result,
  ResultImport,
  ResultRevision,
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

export const revisionsRouter = Router();
revisionsRouter.use(requireAuth);
revisionsRouter.use(hydrateScope);

const reviseSchema = z.object({
  studentId: z.string().min(1),
  fromSessionId: z.string().min(1),
  toSessionId: z.string().min(1).optional(),
  newStatus: z.enum([
    "PASSED",
    "FAILED",
    "DROPPED",
    "RETAINED",
    "REVISED",
    "TRANSFERRED",
    "COMPLETED",
  ]),
  publicationDate: z.string().datetime({ offset: true }),
  note: z.string().max(500).optional(),
});

// Board-challenge revised result: old row superseded, dropped history kept,
// student restored into target session (new enrollment, old DROPPED row kept).
revisionsRouter.post(
  "/",
  requirePermission("result.revise"),
  async (req: AuthedRequest, res) => {
    if (!dbOk(res)) return;
    const parsed = reviseSchema.safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({ success: false, error: { code: "VALIDATION_ERROR" } });

    const student = await Student.findById(parsed.data.studentId);
    if (!student)
      return res
        .status(404)
        .json({ success: false, error: { code: "STUDENT_NOT_FOUND" } });
    const fromSess = await AcademicSession.findById(
      parsed.data.fromSessionId,
    ).lean();
    if (!fromSess)
      return res
        .status(400)
        .json({ success: false, error: { code: "SESSION_NOT_FOUND" } });
    if (parsed.data.toSessionId) {
      const toSess = await AcademicSession.findById(
        parsed.data.toSessionId,
      ).lean();
      if (!toSess)
        return res.status(400).json({
          success: false,
          error: { code: "TARGET_SESSION_NOT_FOUND" },
        });
    }

    const result = await Result.findOne({
      studentId: parsed.data.studentId,
      sessionId: parsed.data.fromSessionId,
    });
    if (!result)
      return res
        .status(404)
        .json({ success: false, error: { code: "RESULT_NOT_FOUND" } });
    const oldStatus = result.overallStatus as string;

    const imp = await ResultImport.create({
      source: "BTEB_REVISED",
      publicationDate: new Date(parsed.data.publicationDate),
      importedBy: req.user!.id,
      totalRows: 1,
      matched: 1,
      unmatched: [],
      status: "COMPLETED",
    });

    const revision = await ResultRevision.create({
      resultId: result._id,
      studentId: parsed.data.studentId,
      fromSessionId: parsed.data.fromSessionId,
      toSessionId: parsed.data.toSessionId ?? parsed.data.fromSessionId,
      oldStatus,
      newStatus: parsed.data.newStatus,
      importId: imp._id,
      note: parsed.data.note,
    });

    result.overallStatus = parsed.data.newStatus as never;
    await result.save();

    const targetSession = parsed.data.toSessionId ?? parsed.data.fromSessionId;
    const wasDropped = oldStatus === "DROPPED";
    const nowPassing = ["PASSED", "COMPLETED", "REVISED"].includes(
      parsed.data.newStatus,
    );

    if (wasDropped && nowPassing) {
      // Restore: old DROPPED enrollment stays, new ENROLLED placement created.
      const oldEnroll = await StudentSession.findOne({
        studentId: parsed.data.studentId,
        sessionId: parsed.data.fromSessionId,
      }).lean();
      const deptId = (oldEnroll as unknown as { departmentId: unknown } | null)
        ?.departmentId;
      const roll =
        (oldEnroll as unknown as { roll: string } | null)?.roll ?? "RESTORED";
      const shift =
        (oldEnroll as unknown as { shift: "1ST" | "2ND" } | null)?.shift ??
        "1ST";
      if (
        deptId &&
        String(targetSession) !== String(parsed.data.fromSessionId)
      ) {
        await StudentSession.findOneAndUpdate(
          { studentId: parsed.data.studentId, sessionId: targetSession },
          { departmentId: deptId, shift, roll, status: "ENROLLED" },
          { upsert: true },
        );
      } else {
        await StudentSession.findOneAndUpdate(
          { studentId: parsed.data.studentId, sessionId: targetSession },
          { status: "ENROLLED" },
        );
      }
      await Student.findByIdAndUpdate(parsed.data.studentId, {
        status: "ACTIVE",
      });
      await DroppedHistory.create({
        studentId: parsed.data.studentId,
        sessionId: parsed.data.fromSessionId,
        resultId: result._id,
        importId: imp._id,
        status: "RESTORED",
        note:
          parsed.data.note ?? `Revised ${oldStatus} → ${parsed.data.newStatus}`,
      });
    }

    if (parsed.data.newStatus === "DROPPED" && !wasDropped) {
      await Student.findByIdAndUpdate(parsed.data.studentId, {
        status: "DROPPED",
      });
      await StudentSession.findOneAndUpdate(
        {
          studentId: parsed.data.studentId,
          sessionId: parsed.data.fromSessionId,
        },
        { status: "DROPPED" },
      );
      await DroppedHistory.create({
        studentId: parsed.data.studentId,
        sessionId: parsed.data.fromSessionId,
        resultId: result._id,
        importId: imp._id,
        status: "DROPPED",
        note: parsed.data.note ?? "Revised to DROPPED",
      });
    }

    await audit({
      actorUserId: req.user!.id,
      role: "PRINCIPAL",
      action: "result.revise",
      entity: "ResultRevision",
      entityId: String(revision._id),
      before: { status: oldStatus },
      after: { status: parsed.data.newStatus },
    });
    res.status(201).json({ success: true, data: { revision, import: imp } });
  },
);

revisionsRouter.get("/", requirePermission("result.read"), async (req, res) => {
  if (!dbOk(res)) return;
  const match: Record<string, unknown> = {};
  if (req.query.studentId) match.studentId = String(req.query.studentId);
  if (req.query.sessionId) match.fromSessionId = String(req.query.sessionId);
  const items = await ResultRevision.find(match)
    .populate("studentId fromSessionId toSessionId importId")
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();
  res.json({ success: true, data: items });
});

const reassignSchema = z.object({ toSessionId: z.string().min(1) });

// §28: move DROPPED placement to lower/next session without deleting history.
revisionsRouter.post(
  "/dropped/:studentId/reassign",
  requirePermission("result.revise"),
  async (req: AuthedRequest, res) => {
    if (!dbOk(res)) return;
    const parsed = reassignSchema.safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({ success: false, error: { code: "VALIDATION_ERROR" } });
    const sid = String(req.params.studentId);
    const dropped = await DroppedHistory.findOne({
      studentId: sid,
      status: "DROPPED",
    }).sort({
      createdAt: -1,
    });
    if (!dropped)
      return res
        .status(404)
        .json({ success: false, error: { code: "NO_DROPPED_RECORD" } });
    const oldEnroll = (await StudentSession.findOne({
      studentId: sid,
      sessionId: (dropped as unknown as { sessionId: unknown }).sessionId,
    }).lean()) as unknown as {
      departmentId: unknown;
      roll: string;
      shift: "1ST" | "2ND";
    } | null;
    if (!oldEnroll)
      return res
        .status(409)
        .json({ success: false, error: { code: "NO_ENROLLMENT" } });
    const target = String(parsed.data.toSessionId);
    if (
      String((dropped as unknown as { sessionId: unknown }).sessionId) ===
      target
    )
      return res
        .status(400)
        .json({ success: false, error: { code: "SAME_SESSION" } });
    await StudentSession.findOneAndUpdate(
      { studentId: sid, sessionId: target },
      {
        departmentId: oldEnroll.departmentId,
        shift: oldEnroll.shift,
        roll: oldEnroll.roll,
        status: "ENROLLED",
      },
      { upsert: true },
    );
    await audit({
      actorUserId: req.user!.id,
      role: "PRINCIPAL",
      action: "dropped.reassign",
      entity: "Student",
      entityId: sid,
      before: {
        from: (dropped as unknown as { sessionId: unknown }).sessionId,
      },
      after: { to: target },
    });
    res.json({ success: true, data: { studentId: sid, to: target } });
  },
);
