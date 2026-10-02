import { Router } from "express";
import { z } from "zod";
import {
  AcademicSession,
  ClassCaptain,
  Department,
  Student,
  StudentSession,
  Teacher,
  TeacherAssignment,
  User,
  audit,
} from "./models.js";
import { dbOk } from "./db-guard.js";
import {
  hydrateScope,
  requireAnyPermission,
  requireAuth,
  requireDepartmentScope,
  requirePermission,
  type AuthedRequest,
} from "./rbac.js";

export const teachersRouter = Router();
teachersRouter.use(requireAuth);
teachersRouter.use(hydrateScope);

const createTeacherSchema = z.object({
  employeeId: z.string().min(1).max(30),
  name: z.string().min(2).max(100),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional(),
  departmentId: z.string().min(1),
  designation: z.string().max(60).optional(),
  userId: z.string().min(1).optional(),
});

async function teacherInScope(
  teacherId: string,
  scope: string | null | undefined,
) {
  if (!scope) return false;
  const t = (await Teacher.findById(teacherId).lean()) as unknown as {
    departmentId: unknown;
  } | null;
  return !!t && String(t.departmentId) === String(scope);
}

// POST /teachers — PRINCIPAL or scoped CI.
teachersRouter.post(
  "/",
  requirePermission("teacher.manage"),
  requireDepartmentScope({ body: "departmentId" }),
  async (req: AuthedRequest, res) => {
    if (!dbOk(res)) return;
    const parsed = createTeacherSchema.safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({ success: false, error: { code: "VALIDATION_ERROR" } });
    const dept = await Department.findById(parsed.data.departmentId).lean();
    if (!dept)
      return res
        .status(400)
        .json({ success: false, error: { code: "DEPT_NOT_FOUND" } });
    try {
      const t = await Teacher.create({
        employeeId: parsed.data.employeeId,
        name: parsed.data.name,
        phone: parsed.data.phone,
        email: parsed.data.email,
        departmentId: parsed.data.departmentId,
        designation: parsed.data.designation,
        userId: parsed.data.userId ?? undefined,
      });
      await audit({
        actorUserId: req.user!.id,
        role: req.user!.roles[0],
        action: "teacher.create",
        entity: "Teacher",
        entityId: String(t._id),
      });
      res.status(201).json({ success: true, data: t });
    } catch {
      res
        .status(409)
        .json({ success: false, error: { code: "TEACHER_EXISTS" } });
    }
  },
);

// GET /teachers — CI forced to own scope.
teachersRouter.get(
  "/",
  requirePermission("teacher.read"),
  async (req: AuthedRequest, res) => {
    if (!dbOk(res)) return;
    const roles = req.user?.roles ?? [];
    const isPrivileged =
      roles.includes("SUPER_ADMIN") || roles.includes("PRINCIPAL");
    const scope = req.user?.departmentScope ?? null;
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
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 20)));
    const q = String(req.query.q ?? "").trim();
    const match: Record<string, unknown> = {};
    if (departmentId) match.departmentId = departmentId;
    if (req.query.status) match.status = String(req.query.status);
    if (q)
      match.$or = [
        { name: new RegExp(q, "i") },
        { employeeId: new RegExp(q, "i") },
      ];
    const [items, total] = await Promise.all([
      Teacher.find(match)
        .populate("departmentId")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Teacher.countDocuments(match),
    ]);
    res.json({ success: true, data: { items, total, page, limit } });
  },
);

teachersRouter.get(
  "/:id",
  requirePermission("teacher.read"),
  async (req: AuthedRequest, res) => {
    if (!dbOk(res)) return;
    const sid = String(req.params.id);
    const teacher = await Teacher.findById(sid).populate("departmentId").lean();
    if (!teacher)
      return res
        .status(404)
        .json({ success: false, error: { code: "TEACHER_NOT_FOUND" } });
    const roles = req.user?.roles ?? [];
    if (
      roles.includes("DEPARTMENT_HEAD_CI") &&
      !roles.includes("PRINCIPAL") &&
      !(await teacherInScope(sid, req.user?.departmentScope))
    )
      return res
        .status(403)
        .json({ success: false, error: { code: "SCOPE_MISMATCH" } });
    const assignments = await TeacherAssignment.find({ teacherId: sid })
      .populate("sessionId departmentId")
      .lean();
    res.json({ success: true, data: { teacher, assignments } });
  },
);

const updateTeacherSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  phone: z.string().max(20).optional(),
  designation: z.string().max(60).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

teachersRouter.patch(
  "/:id",
  requirePermission("teacher.manage"),
  async (req: AuthedRequest, res) => {
    if (!dbOk(res)) return;
    const parsed = updateTeacherSchema.safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({ success: false, error: { code: "VALIDATION_ERROR" } });
    const sid = String(req.params.id);
    const roles = req.user?.roles ?? [];
    if (
      roles.includes("DEPARTMENT_HEAD_CI") &&
      !roles.includes("PRINCIPAL") &&
      !(await teacherInScope(sid, req.user?.departmentScope))
    )
      return res
        .status(403)
        .json({ success: false, error: { code: "SCOPE_MISMATCH" } });
    const teacher = await Teacher.findByIdAndUpdate(sid, parsed.data, {
      new: true,
    }).lean();
    if (!teacher)
      return res
        .status(404)
        .json({ success: false, error: { code: "TEACHER_NOT_FOUND" } });
    await audit({
      actorUserId: req.user!.id,
      role: req.user!.roles[0],
      action: "teacher.update",
      entity: "Teacher",
      entityId: sid,
      after: parsed.data,
    });
    res.json({ success: true, data: teacher });
  },
);

const assignSchema = z.object({
  sessionId: z.string().min(1),
  departmentId: z.string().min(1),
  subjectId: z.string().min(1).optional(),
  classGroupId: z.string().min(1).optional(),
});

// Assign teacher to session/dept (optionally subject/class).
teachersRouter.post(
  "/:id/assignments",
  requirePermission("teacher.manage"),
  requireDepartmentScope({ body: "departmentId" }),
  async (req: AuthedRequest, res) => {
    if (!dbOk(res)) return;
    const parsed = assignSchema.safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({ success: false, error: { code: "VALIDATION_ERROR" } });
    const sid = String(req.params.id);
    const teacher = await Teacher.findById(sid).lean();
    if (!teacher)
      return res
        .status(404)
        .json({ success: false, error: { code: "TEACHER_NOT_FOUND" } });
    const sess = await AcademicSession.findById(parsed.data.sessionId).lean();
    if (!sess)
      return res
        .status(400)
        .json({ success: false, error: { code: "SESSION_NOT_FOUND" } });
    const a = await TeacherAssignment.create({
      teacherId: sid,
      ...parsed.data,
    });
    await audit({
      actorUserId: req.user!.id,
      role: req.user!.roles[0],
      action: "teacher.assign",
      entity: "TeacherAssignment",
      entityId: String(a._id),
    });
    res.status(201).json({ success: true, data: a });
  },
);

teachersRouter.delete(
  "/:id/assignments/:aid",
  requirePermission("teacher.manage"),
  async (req: AuthedRequest, res) => {
    if (!dbOk(res)) return;
    const a = await TeacherAssignment.findByIdAndUpdate(
      String(req.params.aid),
      { status: "INACTIVE" },
      { new: true },
    ).lean();
    if (!a)
      return res
        .status(404)
        .json({ success: false, error: { code: "ASSIGNMENT_NOT_FOUND" } });
    await audit({
      actorUserId: req.user!.id,
      role: req.user!.roles[0],
      action: "teacher.unassign",
      entity: "TeacherAssignment",
      entityId: String(req.params.aid),
    });
    res.json({ success: true, data: a });
  },
);

const headSchema = z.object({ userId: z.string().min(1) });

// Assign CI to a department (PRINCIPAL/SUPER_ADMIN via department.manage).
teachersRouter.post(
  "/departments/:id/head",
  requirePermission("department.manage"),
  async (req: AuthedRequest, res) => {
    if (!dbOk(res)) return;
    const parsed = headSchema.safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({ success: false, error: { code: "VALIDATION_ERROR" } });
    const deptId = String(req.params.id);
    const dept = await Department.findById(deptId);
    if (!dept)
      return res
        .status(404)
        .json({ success: false, error: { code: "DEPT_NOT_FOUND" } });
    const user = await User.findByIdAndUpdate(
      parsed.data.userId,
      {
        $addToSet: { roles: "DEPARTMENT_HEAD_CI" },
        $set: { departmentScope: deptId },
      },
      { new: true },
    ).lean();
    if (!user)
      return res
        .status(404)
        .json({ success: false, error: { code: "USER_NOT_FOUND" } });
    dept.headUserId = parsed.data.userId as never;
    await dept.save();
    await audit({
      actorUserId: req.user!.id,
      role: req.user!.roles[0],
      action: "department.head.assign",
      entity: "Department",
      entityId: deptId,
      after: { userId: parsed.data.userId },
    });
    res.json({ success: true, data: { department: dept, user } });
  },
);

const captainSchema = z.object({
  studentId: z.string().min(1),
  sessionId: z.string().min(1),
  departmentId: z.string().min(1),
  classGroupId: z.string().min(1).optional(),
  validTo: z.string().datetime({ offset: true }).optional(),
});

// Assign class captain (CI scoped). One ACTIVE captain per class+session.
teachersRouter.post(
  "/captains",
  requirePermission("class.manage"),
  requireDepartmentScope({ body: "departmentId" }),
  async (req: AuthedRequest, res) => {
    if (!dbOk(res)) return;
    const parsed = captainSchema.safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({ success: false, error: { code: "VALIDATION_ERROR" } });
    const student = await Student.findById(parsed.data.studentId).lean();
    if (!student)
      return res
        .status(404)
        .json({ success: false, error: { code: "STUDENT_NOT_FOUND" } });
    const enrolled = await StudentSession.findOne({
      studentId: parsed.data.studentId,
      sessionId: parsed.data.sessionId,
      departmentId: parsed.data.departmentId,
    }).lean();
    if (!enrolled)
      return res
        .status(409)
        .json({ success: false, error: { code: "STUDENT_NOT_ENROLLED" } });
    const filter: Record<string, unknown> = {
      sessionId: parsed.data.sessionId,
      status: "ACTIVE",
    };
    if (parsed.data.classGroupId)
      filter.classGroupId = parsed.data.classGroupId;
    await ClassCaptain.updateMany(filter, { $set: { status: "INACTIVE" } });
    const cap = await ClassCaptain.create({
      ...parsed.data,
      validTo: parsed.data.validTo ? new Date(parsed.data.validTo) : undefined,
      appointedBy: req.user!.id,
      status: "ACTIVE",
    });
    await audit({
      actorUserId: req.user!.id,
      role: req.user!.roles[0],
      action: "captain.assign",
      entity: "ClassCaptain",
      entityId: String(cap._id),
    });
    res.status(201).json({ success: true, data: cap });
  },
);

teachersRouter.get(
  "/captains",
  requireAnyPermission("student.read", "teacher.read"),
  async (req, res) => {
    if (!dbOk(res)) return;
    const match: Record<string, unknown> = {};
    if (req.query.sessionId) match.sessionId = String(req.query.sessionId);
    if (req.query.departmentId)
      match.departmentId = String(req.query.departmentId);
    if (req.query.classGroupId)
      match.classGroupId = String(req.query.classGroupId);
    if (req.query.status) match.status = String(req.query.status);
    const items = await ClassCaptain.find(match)
      .populate("studentId sessionId departmentId")
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    res.json({ success: true, data: items });
  },
);

teachersRouter.delete(
  "/captains/:id",
  requirePermission("class.manage"),
  async (req: AuthedRequest, res) => {
    if (!dbOk(res)) return;
    const cap = await ClassCaptain.findByIdAndUpdate(
      String(req.params.id),
      { status: "INACTIVE" },
      { new: true },
    ).lean();
    if (!cap)
      return res
        .status(404)
        .json({ success: false, error: { code: "CAPTAIN_NOT_FOUND" } });
    await audit({
      actorUserId: req.user!.id,
      role: req.user!.roles[0],
      action: "captain.remove",
      entity: "ClassCaptain",
      entityId: String(req.params.id),
    });
    res.json({ success: true, data: cap });
  },
);
