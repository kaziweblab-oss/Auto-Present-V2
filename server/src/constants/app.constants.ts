// Enums for role
export enum ROLES {
  ADMIN = "ADMIN",
  CR = "CR",
  STUDENT = "STUDENT",
}
// Enums for shift
export enum SHIFTS {
  FIRST = "1ST",
  SECOND = "2ND",
}

// Enums for user class status
export enum CLASS_STATUS {
  PRESENT = "PRESENT",
  ABSENT = "ABSENT",
}

// Enum for audit action
export enum AUDIT_ACTIONS {
  CREATE_SESSION = "CREATE_SESSION",
  TOGGLE_ATTENDANCE = "TOGGLE_ATTENDANCE",
  ASSIGN_CR = "ASSIGN_CR",
}

// Class Session status
export enum CLASS_SESSIONS_STATUS {
  OPEN = "OPEN",
  CLOSED = "CLOSED",
}

// Enum Defination
export type RoleType = ROLES;
export type ShiftType = SHIFTS;
export type ClassStatusType = CLASS_STATUS;
export type AuditActionsType = AUDIT_ACTIONS;
export type ClassSessionStatusType = CLASS_SESSIONS_STATUS;
