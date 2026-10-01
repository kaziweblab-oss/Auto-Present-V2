export const ROLES = ['SUPER_ADMIN','PRINCIPAL','VICE_PRINCIPAL','CI','TEACHER','STUDENT'] as const;
export type Role = (typeof ROLES)[number];

// Captain is a class responsibility assigned to a student, NOT a global role.
export const SESSION_STATES = ['DRAFT','ACTIVE','CLOSED','ARCHIVED'] as const;
export type SessionState = (typeof SESSION_STATES)[number];

export const STUDENT_STATES = ['ACTIVE','INACTIVE','DROPPED','TRANSFERRED','COMPLETED','ARCHIVED'] as const;

// sessionDbKey: abstraction for future multi-DB split (one free cluster per session).
// For now every session maps to the single primary MongoDB.
export function sessionDbKey(sessionName: string): string {
  return `primary:${sessionName}`;
}

export const PERMISSIONS = {
  'session.create': ['SUPER_ADMIN','PRINCIPAL'],
  'session.activate': ['PRINCIPAL'],
  'session.close': ['PRINCIPAL'],
  'session.read': ['SUPER_ADMIN','PRINCIPAL','VICE_PRINCIPAL','CI','TEACHER'],
  'user.manage': ['SUPER_ADMIN'],
  'role.assign': ['SUPER_ADMIN'],
  'audit.read': ['SUPER_ADMIN','PRINCIPAL'],
  'student.manage': ['CI'],
  'routine.manage': ['CI'],
  'attendance.take': ['TEACHER'],
  'notice.publish:institute': ['PRINCIPAL'],
  'notice.publish:dept': ['CI'],
  'notice.publish:class': ['TEACHER'],
} as const satisfies Record<string, readonly Role[]>;
export type Permission = keyof typeof PERMISSIONS;

export function hasPermission(role: Role, perm: Permission): boolean {
  return (PERMISSIONS[perm] as readonly string[]).includes(role);
}
