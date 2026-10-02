import { Router } from "express";
import { z } from "zod";
import {
  AcademicSession,
  Department,
  Student,
  StudentSession,
  audit,
} from "./models.js";
import { dbOk } from "./db-guard.js";
import {
  hydrateScope,
  requireAuth,
  requireDepartmentScope,
  requirePermission,
  type AuthedRequest,
} from "./rbac.js";

export const studentsRouter = Router();
studentsRouter.use(requireAuth);
studentsRouter.use(hydrateScope);

const createSchema = z.object({
  roll: z.string().min(1).max(20),
  registrationNumber: z.string().min(1).max(40),
  name: z.string().min(2).max(100),
  photo: z.string().max(2000).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional(),
  departmentId: z.string().min(1),
  sessionId: z.string().min(1),
  shift: z.enum(["1ST", "2ND"]),
  classGroupId: z.string().min(1).optional(),
});

const updateSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  photo: z.string().max(2000).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional(),
});

const enrollSchema = z.object({
  sessionId: z.string().min(1),
  departmentId: z.string().min(1),
  shift: z.enum(["1ST", "2ND"]),
  roll: z.string().min(1).max(20),
  classGroupId: z.string().min(1).optional(),
});

// CI may only touch students enrolled in their scoped department.
async function ciCanAccess(
  studentId: string,
  scope: string | null | undefined,
): Promise<boolean> {
  if (!scope) return false;
  const row = await StudentSession.findOne({
    studentId,
    departmentId: scope,
  }).lean();
  return !!row;
}

// POST /students — create student + first enrollment (CI scoped).
studentsRouter.post(
  "/",
  requirePermission("student.create"),
  requireDepartmentScope({ body: "departmentId" }),
  async (req: AuthedRequest, res) => {
    if (!dbOk(res)) return;
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({ success: false, error: { code: "VALIDATION_ERROR" } });
    const [dept, sess] = await Promise.all([
      Department.findById(parsed.data.departmentId).lean(),
      AcademicSession.findById(parsed.data.sessionId).lean(),
    ]);
    if (!dept)
      return res
        .status(400)
        .json({ success: false, error: { code: "DEPT_NOT_FOUND" } });
    if (!sess)
      return res
        .status(400)
        .json({ success: false, error: { code: "SESSION_NOT_FOUND" } });

    let student = await Student.findOne({
      registrationNumber: parsed.data.registrationNumber,
    });
    if (!student) {
      try {
        student = await Student.create({
          roll: parsed.data.roll,
          registrationNumber: parsed.data.registrationNumber,
          name: parsed.data.name,
          photo: parsed.data.photo,
          phone: parsed.data.phone,
          email: parsed.data.email,
        });
      } catch {
        return res
          .status(409)
          .json({ success: false, error: { code: "STUDENT_EXISTS" } });
      }
    }
    try {
      const enrollment = await StudentSession.create({
        studentId: student._id,
        sessionId: parsed.data.sessionId,
        departmentId: parsed.data.departmentId,
        shift: parsed.data.shift,
        roll: parsed.data.roll,
        classGroupId: parsed.data.classGroupId ?? undefined,
        status: "ENROLLED",
      });
      await audit({
        actorUserId: req.user!.id,
        role: req.user!.roles[0],
        action: "student.create",
        entity: "Student",
        entityId: String(student._id),
        after: { enrollment: String(enrollment._id) },
      });
      res.status(201).json({ success: true, data: { student, enrollment } });
    } catch {
      res
        .status(409)
        .json({ success: false, error: { code: "ALREADY_ENROLLED" } });
    }
  },
);

// GET /students — session student list with filters + pagination.
studentsRouter.get(
  "/",
  requirePermission("student.read"),
  async (req: AuthedRequest, res) => {
    if (!dbOk(res)) return;
    const roles = req.user?.roles ?? [];
    const isPrivileged =
      roles.includes("SUPER_ADMIN") || roles.includes("PRINCIPAL");
    const scope = req.user?.departmentScope ?? null;

    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 20)));
    const q = String(req.query.q ?? "").trim();
    const sessionId = req.query.sessionId
      ? String(req.query.sessionId)
      : undefined;
    let departmentId = req.query.departmentId
      ? String(req.query.departmentId)
      : undefined;
    if (!isPrivileged && roles.includes("DEPARTMENT_HEAD_CI")) {
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

    const match: Record<string, unknown> = {};
    if (sessionId) match.sessionId = sessionId;
    if (departmentId) match.departmentId = departmentId;
    if (req.query.shift) match.shift = String(req.query.shift);
    if (req.query.status) match.status = String(req.query.status);

    if (q) {
      const students = await Student.find({
        $or: [
          { roll: new RegExp(q, "i") },
          { name: new RegExp(q, "i") },
          { registrationNumber: new RegExp(q, "i") },
        ],
      })
        .select("_id")
        .limit(200)
        .lean();
      match.studentId = { $in: students.map((s) => s._id) };
    }

    const [items, total] = await Promise.all([
      StudentSession.find(match)
        .populate("studentId sessionId departmentId")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      StudentSession.countDocuments(match),
    ]);
    res.json({ success: true, data: { items, total, page, limit } });
  },
);

// GET /students/:id — profile + full session history (never deleted).
studentsRouter.get(
  "/:id",
  requirePermission("student.read"),
  async (req: AuthedRequest, res) => {
    if (!dbOk(res)) return;
    const roles = req.user?.roles ?? [];
    const sid = String(req.params.id);
    const student = (await Student.findById(sid).lean()) as unknown as {
      _id: unknown;
    } | null;
    if (!student)
      return res
        .status(404)
        .json({ success: false, error: { code: "STUDENT_NOT_FOUND" } });
    if (
      roles.includes("DEPARTMENT_HEAD_CI") &&
      !roles.includes("PRINCIPAL") &&
      !(await ciCanAccess(String(student._id), req.user?.departmentScope))
    )
      return res
        .status(403)
        .json({ success: false, error: { code: "SCOPE_MISMATCH" } });
    const history = await StudentSession.find({ studentId: sid })
      .populate("sessionId departmentId classGroupId")
      .sort({ createdAt: 1 })
      .lean();
    res.json({ success: true, data: { student, history } });
  },
);

// PATCH /students/:id — basic profile edit (CI scoped).
studentsRouter.patch(
  "/:id",
  requirePermission("student.update"),
  async (req: AuthedRequest, res) => {
    if (!dbOk(res)) return;
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({ success: false, error: { code: "VALIDATION_ERROR" } });
    const roles = req.user?.roles ?? [];
    const sid = String(req.params.id);
    if (
      roles.includes("DEPARTMENT_HEAD_CI") &&
      !roles.includes("PRINCIPAL") &&
      !(await ciCanAccess(sid, req.user?.departmentScope))
    )
      return res
        .status(403)
        .json({ success: false, error: { code: "SCOPE_MISMATCH" } });
    const before = (await Student.findById(sid).lean()) as unknown as {
      name: string;
    } | null;
    if (!before)
      return res
        .status(404)
        .json({ success: false, error: { code: "STUDENT_NOT_FOUND" } });
    const student = await Student.findByIdAndUpdate(sid, parsed.data, {
      new: true,
    }).lean();
    await audit({
      actorUserId: req.user!.id,
      role: req.user!.roles[0],
      action: "student.update",
      entity: "Student",
      entityId: sid,
      before: { name: before.name },
      after: parsed.data,
    });
    res.json({ success: true, data: student });
  },
);

// POST /students/:id/enroll — place existing student into another session.
studentsRouter.post(
  "/:id/enroll",
  requirePermission("student.create"),
  requireDepartmentScope({ body: "departmentId" }),
  async (req: AuthedRequest, res) => {
    if (!dbOk(res)) return;
    const parsed = enrollSchema.safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({ success: false, error: { code: "VALIDATION_ERROR" } });
    const sid = String(req.params.id);
    const student = await Student.findById(sid);
    if (!student)
      return res
        .status(404)
        .json({ success: false, error: { code: "STUDENT_NOT_FOUND" } });
    try {
      const enrollment = await StudentSession.create({
        studentId: student._id,
        sessionId: parsed.data.sessionId,
        departmentId: parsed.data.departmentId,
        shift: parsed.data.shift,
        roll: parsed.data.roll,
        classGroupId: parsed.data.classGroupId ?? undefined,
        status: "ENROLLED",
      });
      await audit({
        actorUserId: req.user!.id,
        role: req.user!.roles[0],
        action: "student.enroll",
        entity: "StudentSession",
        entityId: String(enrollment._id),
      });
      res.status(201).json({ success: true, data: enrollment });
    } catch {
      res
        .status(409)
        .json({ success: false, error: { code: "ALREADY_ENROLLED" } });
    }
  },
);

const statusSchema = z.object({ status: z.enum(["ACTIVE", "INACTIVE"]) });

// CI may toggle ACTIVE/INACTIVE. DROPPED/TRANSFERRED/COMPLETED come only
// from official result/transfer workflows (Phase 10-12).
studentsRouter.patch(
  "/:id/status",
  requirePermission("student.update"),
  async (req: AuthedRequest, res) => {
    if (!dbOk(res)) return;
    const parsed = statusSchema.safeParse(req.body);
    if (!parsed.success) {
      const raw = (req.body as { status?: string })?.status;
      if (["DROPPED", "TRANSFERRED", "COMPLETED"].includes(String(raw)))
        return res
          .status(409)
          .json({ success: false, error: { code: "OFFICIAL_WORKFLOW_ONLY" } });
      return res
        .status(400)
        .json({ success: false, error: { code: "VALIDATION_ERROR" } });
    }
    const roles = req.user?.roles ?? [];
    const sid = String(req.params.id);
    if (
      roles.includes("DEPARTMENT_HEAD_CI") &&
      !roles.includes("PRINCIPAL") &&
      !(await ciCanAccess(sid, req.user?.departmentScope))
    )
      return res
        .status(403)
        .json({ success: false, error: { code: "SCOPE_MISMATCH" } });
    const student = await Student.findByIdAndUpdate(
      sid,
      { status: parsed.data.status },
      { new: true },
    ).lean();
    if (!student)
      return res
        .status(404)
        .json({ success: false, error: { code: "STUDENT_NOT_FOUND" } });
    await audit({
      actorUserId: req.user!.id,
      role: req.user!.roles[0],
      action: "student.status",
      entity: "Student",
      entityId: sid,
      after: parsed.data,
    });
    res.json({ success: true, data: student });
  },
);
