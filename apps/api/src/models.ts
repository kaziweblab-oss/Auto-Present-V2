import mongoose from "mongoose";
import {
  ROLES,
  SESSION_STATES,
  STUDENT_SESSION_STATUS,
  SHIFTS,
} from "@auto-present-v2/shared";

// Phase 1 domain model. Each aggregate is its own collection —
// no giant Student table. History rows (StudentSession) are append-only.

const userSchema = new mongoose.Schema(
  {
    googleSubject: { type: String, required: true, unique: true },
    email: { type: String, required: true, lowercase: true, index: true },
    displayName: { type: String, required: true },
    avatarUrl: { type: String },
    roles: { type: [String], enum: ROLES, default: [] },
    // DEPARTMENT_HEAD_CI is scoped to one department.
    departmentScope: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
    },
    status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE" },
  },
  { timestamps: true },
);

const departmentSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    name: { type: String, required: true },
    headUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE" },
  },
  { timestamps: true },
);

const sessionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      match: /^\d{4}-\d{2}$/,
    },
    state: {
      type: String,
      enum: SESSION_STATES,
      default: "DRAFT",
      index: true,
    },
    startDate: { type: Date },
    endDate: { type: Date },
    dbKey: { type: String, default: "primary" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    activatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

const studentSchema = new mongoose.Schema(
  {
    roll: { type: String, required: true, index: true },
    registrationNumber: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    photo: { type: String },
    phone: { type: String },
    email: { type: String, lowercase: true },
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE", "DROPPED", "TRANSFERRED", "COMPLETED"],
      default: "ACTIVE",
    },
  },
  { timestamps: true },
);

const studentSessionSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
    },
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AcademicSession",
      required: true,
      index: true,
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      required: true,
      index: true,
    },
    classGroupId: { type: mongoose.Schema.Types.ObjectId, ref: "ClassGroup" },
    shift: { type: String, enum: SHIFTS, required: true },
    roll: { type: String, required: true },
    status: { type: String, enum: STUDENT_SESSION_STATUS, default: "ENROLLED" },
  },
  { timestamps: true },
);
// One enrollment row per student per session. History preserved — never delete.
studentSessionSchema.index({ studentId: 1, sessionId: 1 }, { unique: true });

const teacherSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      unique: true,
      sparse: true,
    },
    employeeId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    phone: { type: String },
    email: { type: String, lowercase: true },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      required: true,
      index: true,
    },
    designation: { type: String },
    status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE" },
  },
  { timestamps: true },
);

const teacherAssignmentSchema = new mongoose.Schema(
  {
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Teacher",
      required: true,
      index: true,
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      required: true,
    },
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AcademicSession",
      required: true,
    },
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: "Subject" },
    classGroupId: { type: mongoose.Schema.Types.ObjectId, ref: "ClassGroup" },
    status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE" },
  },
  { timestamps: true },
);
teacherAssignmentSchema.index({ teacherId: 1, sessionId: 1 });

const classGroupSchema = new mongoose.Schema(
  {
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      required: true,
      index: true,
    },
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AcademicSession",
      required: true,
    },
    shift: { type: String, enum: SHIFTS, required: true },
    name: { type: String, required: true },
    room: { type: String },
    capacity: { type: Number },
    classTeacherId: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher" },
    status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE" },
  },
  { timestamps: true },
);
classGroupSchema.index(
  { departmentId: 1, sessionId: 1, shift: 1, name: 1 },
  { unique: true },
);

const subjectSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    name: { type: String, required: true },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      required: true,
      index: true,
    },
    type: { type: String, enum: ["THEORY", "LAB"], default: "THEORY" },
    credit: { type: Number },
    status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE" },
  },
  { timestamps: true },
);

// Routine entry (§16): one row per class period. History kept via status,
// never silently overwritten (time changes go through Phase 9 workflow).
const routineEntrySchema = new mongoose.Schema(
  {
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AcademicSession",
      required: true,
      index: true,
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      required: true,
      index: true,
    },
    shift: { type: String, enum: SHIFTS, required: true },
    classGroupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ClassGroup",
      required: true,
      index: true,
    },
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
      required: true,
    },
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Teacher",
      required: true,
      index: true,
    },
    day: {
      type: String,
      enum: ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"],
      required: true,
      index: true,
    },
    startTime: {
      type: String,
      required: true,
      match: /^([01]\d|2[0-3]):[0-5]\d$/,
    },
    endTime: {
      type: String,
      required: true,
      match: /^([01]\d|2[0-3]):[0-5]\d$/,
    },
    room: { type: String },
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE", "CANCELLED"],
      default: "ACTIVE",
    },
  },
  { timestamps: true },
);
routineEntrySchema.index({ sessionId: 1, teacherId: 1, day: 1 });
routineEntrySchema.index({ sessionId: 1, classGroupId: 1, day: 1 });

// Class session (§14): one row per taught period per date.
// Attendance window derived server-side from startTime/endTime.
const classSessionSchema = new mongoose.Schema(
  {
    routineEntryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RoutineEntry",
      required: true,
      index: true,
    },
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AcademicSession",
      required: true,
      index: true,
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      required: true,
    },
    classGroupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ClassGroup",
      required: true,
    },
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
      required: true,
    },
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Teacher",
      required: true,
    },
    date: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
      index: true,
    },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    status: {
      type: String,
      enum: ["OPEN", "CLOSED", "CANCELLED"],
      default: "OPEN",
    },
  },
  { timestamps: true },
);
classSessionSchema.index({ routineEntryId: 1, date: 1 }, { unique: true });

const attendanceRecordSchema = new mongoose.Schema(
  {
    classSessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ClassSession",
      required: true,
      index: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["PRESENT", "LATE", "ABSENT", "EXCUSED"],
      required: true,
    },
    markedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);
attendanceRecordSchema.index(
  { classSessionId: 1, studentId: 1 },
  { unique: true },
);

const auditSchema = new mongoose.Schema(
  {
    actorUserId: { type: String, index: true },
    role: { type: String, index: true },
    action: { type: String, required: true, index: true },
    entity: { type: String, index: true },
    entityId: { type: String },
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: "AcademicSession" },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Department" },
    before: { type: mongoose.Schema.Types.Mixed },
    after: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true },
);

// Class Captain (§17): limited operational role, NOT a global Role.
// Connected to session + department + class/group + student + validity.
const captainSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
    },
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AcademicSession",
      required: true,
      index: true,
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      required: true,
      index: true,
    },
    classGroupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ClassGroup",
      index: true,
    },
    validFrom: { type: Date, default: () => new Date() },
    validTo: { type: Date },
    status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE" },
    appointedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);
captainSchema.index({ sessionId: 1, classGroupId: 1, status: 1 });

// Teacher replacement (§18-21): audited request lifecycle, never left PENDING.
const replacementSchema = new mongoose.Schema(
  {
    requesterTeacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Teacher",
      required: true,
      index: true,
    },
    requestedTeacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Teacher",
      required: true,
      index: true,
    },
    routineEntryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RoutineEntry",
    },
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AcademicSession",
      required: true,
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      required: true,
    },
    classGroupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ClassGroup",
      required: true,
    },
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
      required: true,
    },
    date: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
      index: true,
    },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    reason: { type: String, required: true, maxlength: 500 },
    expiresAt: { type: Date, required: true, index: true },
    status: {
      type: String,
      enum: [
        "PENDING",
        "ACCEPTED",
        "REJECTED",
        "EXPIRED",
        "CANCELLED",
        "COMPLETED",
      ],
      default: "PENDING",
      index: true,
    },
    decidedAt: { type: Date },
  },
  { timestamps: true },
);

// Key-value institute settings (replacement limits now, more in Phase 16).
const settingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    value: { type: mongoose.Schema.Types.Mixed, required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

// Class time-change (§22): requested slot must be free; original routine
// row is kept (INACTIVE) and a new ACTIVE row is created on APPLIED.
const timeChangeSchema = new mongoose.Schema(
  {
    routineEntryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RoutineEntry",
      required: true,
      index: true,
    },
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AcademicSession",
      required: true,
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      required: true,
    },
    classGroupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ClassGroup",
      required: true,
    },
    requestedByRole: {
      type: String,
      enum: ["TEACHER", "CAPTAIN"],
      required: true,
    },
    requesterTeacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Teacher",
    },
    captainId: { type: mongoose.Schema.Types.ObjectId, ref: "ClassCaptain" },
    oldDay: { type: String, required: true },
    oldStartTime: { type: String, required: true },
    oldEndTime: { type: String, required: true },
    oldRoom: { type: String },
    newDay: {
      type: String,
      enum: ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"],
      required: true,
    },
    newStartTime: { type: String, required: true },
    newEndTime: { type: String, required: true },
    newRoom: { type: String },
    reason: { type: String, required: true, maxlength: 500 },
    status: {
      type: String,
      enum: [
        "PENDING",
        "APPROVED",
        "REJECTED",
        "CANCELLED",
        "APPLIED",
        "EXPIRED",
      ],
      default: "PENDING",
      index: true,
    },
    approverTeacherId: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher" },
    appliedEntryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RoutineEntry",
    },
  },
  { timestamps: true },
);

// Official BTEB results (§25-26): import is auditable, source tracked,
// DROPPED derived from official status — never hand-edited.
const resultImportSchema = new mongoose.Schema(
  {
    source: {
      type: String,
      enum: ["BTEB_BOARD", "BTEB_REVISED"],
      default: "BTEB_BOARD",
    },
    publicationDate: { type: Date, required: true },
    fileName: { type: String },
    importedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    totalRows: { type: Number, default: 0 },
    matched: { type: Number, default: 0 },
    unmatched: { type: [String], default: [] },
    status: {
      type: String,
      enum: ["PENDING", "COMPLETED", "FAILED"],
      default: "COMPLETED",
    },
  },
  { timestamps: true },
);

const resultSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
    },
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AcademicSession",
      required: true,
      index: true,
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      required: true,
    },
    importId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ResultImport",
      required: true,
    },
    overallStatus: {
      type: String,
      enum: [
        "PASSED",
        "FAILED",
        "DROPPED",
        "RETAINED",
        "REVISED",
        "TRANSFERRED",
        "COMPLETED",
      ],
      required: true,
      index: true,
    },
    gpa: { type: Number, min: 0, max: 4 },
    publishedAt: { type: Date },
  },
  { timestamps: true },
);
resultSchema.index({ studentId: 1, sessionId: 1 }, { unique: true });

const resultSubjectSchema = new mongoose.Schema(
  {
    resultId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Result",
      required: true,
      index: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AcademicSession",
      required: true,
    },
    subjectCode: { type: String, required: true, uppercase: true, trim: true },
    grade: { type: String },
    status: { type: String, enum: ["PASSED", "FAILED"], default: "PASSED" },
  },
  { timestamps: true },
);

// Dropped history preserved; restore handled in Phase 11.
const droppedHistorySchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
    },
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AcademicSession",
      required: true,
    },
    resultId: { type: mongoose.Schema.Types.ObjectId, ref: "Result" },
    importId: { type: mongoose.Schema.Types.ObjectId, ref: "ResultImport" },
    status: { type: String, enum: ["DROPPED", "RESTORED"], default: "DROPPED" },
    note: { type: String },
  },
  { timestamps: true },
);

// Board-challenge revision (§27): old status superseded, never deleted.
const resultRevisionSchema = new mongoose.Schema(
  {
    resultId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Result",
      required: true,
      index: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
    },
    fromSessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AcademicSession",
      required: true,
    },
    toSessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AcademicSession",
    },
    oldStatus: { type: String, required: true },
    newStatus: { type: String, required: true },
    importId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ResultImport",
      required: true,
    },
    note: { type: String },
  },
  { timestamps: true },
);

// Official transfer (§29-30): PDF/text → extract → validate → preview → approve → process.
const transferImportSchema = new mongoose.Schema(
  {
    fileName: { type: String },
    noticeRef: { type: String },
    noticeDate: { type: Date },
    sourceInstitute: { type: String },
    destinationInstitute: { type: String },
    sourceSessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AcademicSession",
    },
    destinationSessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AcademicSession",
    },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    totalRows: { type: Number, default: 0 },
    matched: { type: Number, default: 0 },
    unmatched: { type: [String], default: [] },
    status: {
      type: String,
      enum: ["PENDING", "VALIDATED", "APPROVED", "REJECTED", "COMPLETED"],
      default: "PENDING",
    },
  },
  { timestamps: true },
);

const transferSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      index: true,
    },
    importId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TransferImport",
      required: true,
      index: true,
    },
    sourceInstitute: { type: String },
    destinationInstitute: { type: String },
    sourceSessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AcademicSession",
    },
    destinationSessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AcademicSession",
    },
    roll: { type: String, required: true },
    registrationNumber: { type: String },
    status: {
      type: String,
      enum: ["PENDING", "VALIDATED", "APPROVED", "REJECTED", "COMPLETED"],
      default: "PENDING",
      index: true,
    },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

// Notice (§31-32): targeted publish + per-user read/ack (never global).
const noticeSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, maxlength: 200 },
    body: { type: String, required: true, maxlength: 10000 },
    attachment: { type: String },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    senderRole: { type: String },
    targetType: {
      type: String,
      enum: [
        "ALL",
        "ROLE",
        "DEPARTMENT",
        "SESSION",
        "CLASS",
        "STUDENT",
        "CAPTAIN",
        "SHIFT",
      ],
      required: true,
      index: true,
    },
    targetRole: { type: String },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Department" },
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: "AcademicSession" },
    classGroupId: { type: mongoose.Schema.Types.ObjectId, ref: "ClassGroup" },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student" },
    shift: { type: String, enum: ["1ST", "2ND"] },
    publishAt: { type: Date, default: () => new Date() },
    expiresAt: { type: Date },
    priority: {
      type: String,
      enum: ["NORMAL", "IMPORTANT", "URGENT"],
      default: "NORMAL",
    },
    status: {
      type: String,
      enum: ["PUBLISHED", "EXPIRED"],
      default: "PUBLISHED",
      index: true,
    },
    ackRequired: { type: Boolean, default: false },
  },
  { timestamps: true },
);

const noticeReadSchema = new mongoose.Schema(
  {
    noticeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Notice",
      required: true,
      index: true,
    },
    userId: { type: String, required: true, index: true },
    readAt: { type: Date, default: () => new Date() },
    acknowledgedAt: { type: Date },
  },
  { timestamps: true },
);
noticeReadSchema.index({ noticeId: 1, userId: 1 }, { unique: true });

// Holiday/calendar (§24): weekly closure is config, not hardcoded.
const holidaySchema = new mongoose.Schema(
  {
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    title: { type: String, required: true, maxlength: 200 },
    reason: { type: String, maxlength: 1000 },
    type: {
      type: String,
      enum: [
        "WEEKLY_CLOSURE",
        "PUBLIC_HOLIDAY",
        "INSTITUTE_HOLIDAY",
        "EMERGENCY_CLOSURE",
        "EXAM_HOLIDAY",
        "OTHER",
      ],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["ACTIVE", "CANCELLED"],
      default: "ACTIVE",
      index: true,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);
holidaySchema.index({ date: 1 }, { unique: true });

export const User = mongoose.models.User ?? mongoose.model("User", userSchema);
export const Department =
  mongoose.models.Department ?? mongoose.model("Department", departmentSchema);
export const AcademicSession =
  mongoose.models.AcademicSession ??
  mongoose.model("AcademicSession", sessionSchema);
export const Student =
  mongoose.models.Student ?? mongoose.model("Student", studentSchema);
export const StudentSession =
  mongoose.models.StudentSession ??
  mongoose.model("StudentSession", studentSessionSchema);
export const Teacher =
  mongoose.models.Teacher ?? mongoose.model("Teacher", teacherSchema);
export const TeacherAssignment =
  mongoose.models.TeacherAssignment ??
  mongoose.model("TeacherAssignment", teacherAssignmentSchema);
export const ClassGroup =
  mongoose.models.ClassGroup ?? mongoose.model("ClassGroup", classGroupSchema);
export const Subject =
  mongoose.models.Subject ?? mongoose.model("Subject", subjectSchema);
export const AuditLog =
  mongoose.models.AuditLog ?? mongoose.model("AuditLog", auditSchema);
export const ClassCaptain =
  mongoose.models.ClassCaptain ?? mongoose.model("ClassCaptain", captainSchema);
export const RoutineEntry =
  mongoose.models.RoutineEntry ??
  mongoose.model("RoutineEntry", routineEntrySchema);
export const ClassSession =
  mongoose.models.ClassSession ??
  mongoose.model("ClassSession", classSessionSchema);
export const AttendanceRecord =
  mongoose.models.AttendanceRecord ??
  mongoose.model("AttendanceRecord", attendanceRecordSchema);
export const ReplacementRequest =
  mongoose.models.ReplacementRequest ??
  mongoose.model("ReplacementRequest", replacementSchema);
export const SystemSetting =
  mongoose.models.SystemSetting ??
  mongoose.model("SystemSetting", settingSchema);
export const ClassTimeChangeRequest =
  mongoose.models.ClassTimeChangeRequest ??
  mongoose.model("ClassTimeChangeRequest", timeChangeSchema);
export const ResultImport =
  mongoose.models.ResultImport ??
  mongoose.model("ResultImport", resultImportSchema);
export const Result =
  mongoose.models.Result ?? mongoose.model("Result", resultSchema);
export const ResultSubject =
  mongoose.models.ResultSubject ??
  mongoose.model("ResultSubject", resultSubjectSchema);
export const DroppedHistory =
  mongoose.models.DroppedHistory ??
  mongoose.model("DroppedHistory", droppedHistorySchema);
export const ResultRevision =
  mongoose.models.ResultRevision ??
  mongoose.model("ResultRevision", resultRevisionSchema);
export const TransferImport =
  mongoose.models.TransferImport ??
  mongoose.model("TransferImport", transferImportSchema);
export const Transfer =
  mongoose.models.Transfer ?? mongoose.model("Transfer", transferSchema);
export const Notice =
  mongoose.models.Notice ?? mongoose.model("Notice", noticeSchema);
export const NoticeRead =
  mongoose.models.NoticeRead ?? mongoose.model("NoticeRead", noticeReadSchema);
export const Holiday =
  mongoose.models.Holiday ?? mongoose.model("Holiday", holidaySchema);

// Shift merge (§23): proper operation with impact preview + history,
// never a bare shift-string update.
const shiftMergeSchema = new mongoose.Schema(
  {
    fromShift: { type: String, enum: ["1ST", "2ND"], required: true },
    toShift: { type: String, enum: ["1ST", "2ND"], required: true },
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: "AcademicSession" },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Department" },
    reason: { type: String, required: true, maxlength: 500 },
    status: {
      type: String,
      enum: ["COMPLETED", "CANCELLED"],
      default: "COMPLETED",
    },
    impact: { type: mongoose.Schema.Types.Mixed },
    mergedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

export const ShiftMerge =
  mongoose.models.ShiftMerge ?? mongoose.model("ShiftMerge", shiftMergeSchema);

export async function audit(entry: {
  actorUserId?: string;
  role?: string;
  action: string;
  entity?: string;
  entityId?: string;
  sessionId?: string;
  departmentId?: string;
  before?: unknown;
  after?: unknown;
}) {
  await AuditLog.create(entry);
}
