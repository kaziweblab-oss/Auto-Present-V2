// Auto Present V2 — Phase 2 role catalog (shared domain constants).
// Single source of truth for roles, permissions, session lifecycle.

export const ROLES = [
  "SUPER_ADMIN",
  "PRINCIPAL",
  "VICE_PRINCIPAL",
  "DEPARTMENT_HEAD_CI",
  "TEACHER",
  "STUDENT",
] as const;
export type Role = (typeof ROLES)[number];

/** Legacy alias from early prototype. Normalize on read, never store. */
export const LEGACY_CI = "CI" as const;

export function normalizeRole(raw: string): Role | null {
  if (raw === LEGACY_CI) return "DEPARTMENT_HEAD_CI";
  return (ROLES as readonly string[]).includes(raw) ? (raw as Role) : null;
}

export const SESSION_STATES = [
  "DRAFT",
  "ACTIVE",
  "CLOSED",
  "ARCHIVED",
] as const;
export type SessionState = (typeof SESSION_STATES)[number];

/** DRAFT -> ACTIVE | ARCHIVED; ACTIVE -> CLOSED; CLOSED -> ARCHIVED | ACTIVE; ARCHIVED terminal. */
export const SESSION_NEXT: Record<SessionState, SessionState[]> = {
  DRAFT: ["ACTIVE", "ARCHIVED"],
  ACTIVE: ["CLOSED"],
  CLOSED: ["ARCHIVED", "ACTIVE"],
  ARCHIVED: [],
};

export function canTransition(from: SessionState, to: SessionState): boolean {
  return SESSION_NEXT[from].includes(to);
}

/** Session name format: 2025-26 */
export const SESSION_NAME_RE = /^\d{4}-\d{2}$/;

/** Per-session enrollment. History rows are never deleted. */
export const STUDENT_SESSION_STATUS = [
  "ENROLLED",
  "COMPLETED",
  "DROPPED",
  "TRANSFERRED",
  "RETAINED",
] as const;
export type StudentSessionStatus = (typeof STUDENT_SESSION_STATUS)[number];

export const SHIFTS = ["1ST", "2ND"] as const;
export type Shift = (typeof SHIFTS)[number];

/**
 * Phase 2 permission catalog.
 * Least privilege: SUPER_ADMIN = system only (no academic override).
 * PRINCIPAL = top academic authority. VICE_PRINCIPAL = read-only ops.
 * DEPARTMENT_HEAD_CI = department-scoped. TEACHER/STUDENT = scoped self/class.
 */
export const PERMISSIONS = {
  // sessions
  "session.create": ["PRINCIPAL"],
  "session.activate": ["PRINCIPAL"],
  "session.close": ["PRINCIPAL"],
  "session.read": [
    "SUPER_ADMIN",
    "PRINCIPAL",
    "VICE_PRINCIPAL",
    "DEPARTMENT_HEAD_CI",
    "TEACHER",
    "STUDENT",
  ],
  // system
  "user.manage": ["SUPER_ADMIN"],
  "role.assign": ["SUPER_ADMIN"],
  "audit.read": ["SUPER_ADMIN", "PRINCIPAL"],
  "settings.manage": ["SUPER_ADMIN"],
  // departments
  "department.manage": ["SUPER_ADMIN", "PRINCIPAL"],
  "department.read": [
    "SUPER_ADMIN",
    "PRINCIPAL",
    "VICE_PRINCIPAL",
    "DEPARTMENT_HEAD_CI",
    "TEACHER",
    "STUDENT",
  ],
  // students
  "student.create": ["DEPARTMENT_HEAD_CI"],
  "student.read": [
    "SUPER_ADMIN",
    "PRINCIPAL",
    "VICE_PRINCIPAL",
    "DEPARTMENT_HEAD_CI",
    "TEACHER",
  ],
  "student.update": ["DEPARTMENT_HEAD_CI"],
  // teachers / classes
  "teacher.manage": ["PRINCIPAL", "DEPARTMENT_HEAD_CI"],
  "teacher.read": [
    "SUPER_ADMIN",
    "PRINCIPAL",
    "VICE_PRINCIPAL",
    "DEPARTMENT_HEAD_CI",
  ],
  "class.manage": ["DEPARTMENT_HEAD_CI"],
  "subject.manage": ["DEPARTMENT_HEAD_CI"],
  // routine + attendance (enforced Phase 6-7, cataloged here)
  "routine.manage": ["DEPARTMENT_HEAD_CI"],
  "routine.read": [
    "PRINCIPAL",
    "VICE_PRINCIPAL",
    "DEPARTMENT_HEAD_CI",
    "TEACHER",
    "STUDENT",
  ],
  "attendance.take": ["TEACHER"],
  "attendance.read": [
    "PRINCIPAL",
    "VICE_PRINCIPAL",
    "DEPARTMENT_HEAD_CI",
    "TEACHER",
    "STUDENT",
  ],
  // replacement (enforced Phase 8)
  "replacement.request": ["TEACHER"],
  "replacement.respond": ["TEACHER"],
  "replacement.configure": ["PRINCIPAL"],
  // results / transfers (enforced Phase 10-12, cataloged here)
  "result.import": ["PRINCIPAL"],
  "result.revise": ["PRINCIPAL"],
  "result.read": [
    "PRINCIPAL",
    "VICE_PRINCIPAL",
    "DEPARTMENT_HEAD_CI",
    "TEACHER",
    "STUDENT",
  ],
  "transfer.import": ["PRINCIPAL", "DEPARTMENT_HEAD_CI"],
  "transfer.approve": ["PRINCIPAL"],
  "transfer.read": [
    "PRINCIPAL",
    "VICE_PRINCIPAL",
    "DEPARTMENT_HEAD_CI",
    "STUDENT",
  ],
  // notices / shifts / holidays (enforced Phase 13-15, cataloged here)
  "notice.create": ["PRINCIPAL", "DEPARTMENT_HEAD_CI", "TEACHER"],
  "notice.publish": ["PRINCIPAL", "DEPARTMENT_HEAD_CI"],
  "notice.read": [
    "PRINCIPAL",
    "VICE_PRINCIPAL",
    "DEPARTMENT_HEAD_CI",
    "TEACHER",
    "STUDENT",
  ],
  "shift.manage": ["PRINCIPAL"],
  "shift.merge": ["PRINCIPAL"],
  "shift.read": [
    "PRINCIPAL",
    "VICE_PRINCIPAL",
    "DEPARTMENT_HEAD_CI",
    "TEACHER",
    "STUDENT",
  ],
  "holiday.manage": ["PRINCIPAL", "SUPER_ADMIN"],
  "holiday.read": [
    "PRINCIPAL",
    "VICE_PRINCIPAL",
    "DEPARTMENT_HEAD_CI",
    "TEACHER",
    "STUDENT",
  ],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function hasPermission(role: string, perm: Permission): boolean {
  const normalized = normalizeRole(role);
  if (!normalized) return false;
  return (PERMISSIONS[perm] as readonly string[]).includes(normalized);
}

export function permissionsFor(role: Role): Permission[] {
  return (Object.keys(PERMISSIONS) as Permission[]).filter((p) =>
    (PERMISSIONS[p] as readonly string[]).includes(role),
  );
}

export function sessionDbKey(sessionName: string): string {
  return `primary:${sessionName}`;
}
