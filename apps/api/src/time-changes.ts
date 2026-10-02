import { Router } from "express";
import { z } from "zod";
import {
  ClassCaptain,
  ClassTimeChangeRequest,
  RoutineEntry,
  audit,
} from "./models.js";
import { dbOk } from "./db-guard.js";
import { findConflicts, toMinutes } from "./conflicts.js";
import {
  hydrateScope,
  requireAnyPermission,
  requireAuth,
  type AuthedRequest,
} from "./rbac.js";

export const timeChangesRouter = Router();
timeChangesRouter.use(requireAuth);
timeChangesRouter.use(hydrateScope);

const createSchema = z
  .object({
    routineEntryId: z.string().min(1),
    requestedByRole: z.enum(["TEACHER", "CAPTAIN"]),
    requesterTeacherId: z.string().min(1).optional(),
    captainId: z.string().min(1).optional(),
    newDay: z.enum(["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"]),
    newStartTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    newEndTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    newRoom: z.string().max(40).optional(),
    reason: z.string().min(3).max(500),
  })
  .refine((v) => toMinutes(v.newStartTime) < toMinutes(v.newEndTime), {
    message: "newStartTime must be before newEndTime",
  });

// Teacher or ACTIVE captain requests a new slot. No CI gate, but conflicts mandatory.
timeChangesRouter.post(
  "/",
  requireAnyPermission(
    "attendance.take",
    "routine.manage",
    "class.manage",
    "student.read",
  ),
  async (req: AuthedRequest, res) => {
    if (!dbOk(res)) return;
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({ success: false, error: { code: "VALIDATION_ERROR" } });
    const routine = (await RoutineEntry.findById(
      parsed.data.routineEntryId,
    ).lean()) as unknown as {
      _id: unknown;
      sessionId: unknown;
      departmentId: unknown;
      classGroupId: unknown;
      subjectId: unknown;
      teacherId: unknown;
      day: string;
      startTime: string;
      endTime: string;
      room?: string;
      status: string;
    } | null;
    if (!routine || routine.status !== "ACTIVE")
      return res
        .status(404)
        .json({ success: false, error: { code: "ROUTINE_NOT_FOUND" } });

    if (
      parsed.data.requestedByRole === "TEACHER" &&
      !parsed.data.requesterTeacherId
    )
      return res
        .status(400)
        .json({ success: false, error: { code: "REQUESTER_REQUIRED" } });
    if (parsed.data.requestedByRole === "CAPTAIN") {
      if (!parsed.data.captainId)
        return res
          .status(400)
          .json({ success: false, error: { code: "CAPTAIN_REQUIRED" } });
      const cap = (await ClassCaptain.findById(
        parsed.data.captainId,
      ).lean()) as unknown as {
        status: string;
        classGroupId: unknown;
        sessionId: unknown;
      } | null;
      if (!cap || cap.status !== "ACTIVE")
        return res
          .status(403)
          .json({ success: false, error: { code: "NOT_ACTIVE_CAPTAIN" } });
      if (
        String(cap.classGroupId ?? "") !== String(routine.classGroupId ?? "") &&
        cap.classGroupId
      ) {
        // Captain must belong to the same class when class-scoped.
        return res
          .status(403)
          .json({ success: false, error: { code: "CAPTAIN_CLASS_MISMATCH" } });
      }
    }

    const existing = await RoutineEntry.find({
      sessionId: routine.sessionId,
      status: "ACTIVE",
    }).lean();
    const conflicts = findConflicts(
      {
        teacherId: String(routine.teacherId),
        classGroupId: String(routine.classGroupId),
        room: parsed.data.newRoom ?? routine.room,
        day: parsed.data.newDay,
        startTime: parsed.data.newStartTime,
        endTime: parsed.data.newEndTime,
        _id: String(routine._id),
      },
      existing as never[],
    );
    if (conflicts.length > 0)
      return res.status(409).json({
        success: false,
        error: { code: "SCHEDULE_CONFLICT", conflicts },
      });

    const doc = await ClassTimeChangeRequest.create({
      routineEntryId: parsed.data.routineEntryId,
      sessionId: routine.sessionId,
      departmentId: routine.departmentId,
      classGroupId: routine.classGroupId,
      requestedByRole: parsed.data.requestedByRole,
      requesterTeacherId: parsed.data.requesterTeacherId ?? undefined,
      captainId: parsed.data.captainId ?? undefined,
      oldDay: routine.day,
      oldStartTime: routine.startTime,
      oldEndTime: routine.endTime,
      oldRoom: routine.room,
      newDay: parsed.data.newDay,
      newStartTime: parsed.data.newStartTime,
      newEndTime: parsed.data.newEndTime,
      newRoom: parsed.data.newRoom,
      reason: parsed.data.reason,
      status: "PENDING",
    });
    await audit({
      actorUserId: req.user!.id,
      role: req.user!.roles[0],
      action: "timechange.request",
      entity: "ClassTimeChangeRequest",
      entityId: String(doc._id),
    });
    res.status(201).json({ success: true, data: doc });
  },
);

timeChangesRouter.get(
  "/",
  requireAnyPermission("routine.read", "attendance.take"),
  async (req, res) => {
    if (!dbOk(res)) return;
    const match: Record<string, unknown> = {};
    if (req.query.sessionId) match.sessionId = String(req.query.sessionId);
    if (req.query.status) match.status = String(req.query.status);
    if (req.query.classGroupId)
      match.classGroupId = String(req.query.classGroupId);
    const items = await ClassTimeChangeRequest.find(match)
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    res.json({ success: true, data: items });
  },
);

const approveSchema = z.object({ approverTeacherId: z.string().min(1) });

// Second party approves → slot re-validated → old row INACTIVE + new ACTIVE row.
timeChangesRouter.post(
  "/:id/approve",
  requireAnyPermission("attendance.take", "routine.manage"),
  async (req: AuthedRequest, res) => {
    if (!dbOk(res)) return;
    const parsed = approveSchema.safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({ success: false, error: { code: "VALIDATION_ERROR" } });
    const sid = String(req.params.id);
    const doc = await ClassTimeChangeRequest.findById(sid);
    if (!doc)
      return res
        .status(404)
        .json({ success: false, error: { code: "NOT_FOUND" } });
    if (doc.status !== "PENDING")
      return res
        .status(409)
        .json({ success: false, error: { code: "NOT_PENDING" } });
    if (
      doc.requesterTeacherId &&
      String(doc.requesterTeacherId) === String(parsed.data.approverTeacherId)
    )
      return res
        .status(403)
        .json({ success: false, error: { code: "SELF_APPROVAL" } });

    const routine = await RoutineEntry.findById(doc.routineEntryId);
    if (!routine || routine.status !== "ACTIVE")
      return res
        .status(409)
        .json({ success: false, error: { code: "ROUTINE_GONE" } });

    const existing = await RoutineEntry.find({
      sessionId: doc.sessionId,
      status: "ACTIVE",
    }).lean();
    const conflicts = findConflicts(
      {
        teacherId: String(routine.teacherId),
        classGroupId: String(routine.classGroupId),
        room:
          (doc.newRoom as string | undefined) ??
          (routine.room as string | undefined),
        day: doc.newDay as string,
        startTime: doc.newStartTime as string,
        endTime: doc.newEndTime as string,
        _id: String(routine._id),
      },
      existing as never[],
    );
    if (conflicts.length > 0)
      return res.status(409).json({
        success: false,
        error: { code: "SCHEDULE_CONFLICT", conflicts },
      });

    routine.status = "INACTIVE";
    await routine.save();
    const fresh = await RoutineEntry.create({
      sessionId: routine.sessionId,
      departmentId: routine.departmentId,
      shift: routine.shift,
      classGroupId: routine.classGroupId,
      subjectId: routine.subjectId,
      teacherId: routine.teacherId,
      day: doc.newDay,
      startTime: doc.newStartTime,
      endTime: doc.newEndTime,
      room: doc.newRoom ?? routine.room,
      status: "ACTIVE",
    });
    doc.status = "APPLIED";
    doc.approverTeacherId = parsed.data.approverTeacherId as never;
    doc.appliedEntryId = fresh._id as never;
    await doc.save();
    await audit({
      actorUserId: req.user!.id,
      role: req.user!.roles[0],
      action: "timechange.applied",
      entity: "ClassTimeChangeRequest",
      entityId: String(doc._id),
      before: { old: `${doc.oldDay} ${doc.oldStartTime}-${doc.oldEndTime}` },
      after: { new: `${doc.newDay} ${doc.newStartTime}-${doc.newEndTime}` },
    });
    res.json({ success: true, data: { request: doc, entry: fresh } });
  },
);

timeChangesRouter.post(
  "/:id/reject",
  requireAnyPermission("attendance.take", "routine.manage"),
  async (req: AuthedRequest, res) => {
    if (!dbOk(res)) return;
    const doc = await ClassTimeChangeRequest.findById(String(req.params.id));
    if (!doc)
      return res
        .status(404)
        .json({ success: false, error: { code: "NOT_FOUND" } });
    if (doc.status !== "PENDING")
      return res
        .status(409)
        .json({ success: false, error: { code: "NOT_PENDING" } });
    doc.status = "REJECTED";
    await doc.save();
    await audit({
      actorUserId: req.user!.id,
      role: req.user!.roles[0],
      action: "timechange.rejected",
      entity: "ClassTimeChangeRequest",
      entityId: String(doc._id),
    });
    res.json({ success: true, data: doc });
  },
);
