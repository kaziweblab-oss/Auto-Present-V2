import { describe, expect, it } from "vitest";
import {
  hasPermission,
  normalizeRole,
  permissionsFor,
} from "@auto-present-v2/shared";

describe("role/permission system (Phase 2)", () => {
  it("has all 6 final roles, CI renamed", () => {
    expect(normalizeRole("CI")).toBe("DEPARTMENT_HEAD_CI");
    expect(normalizeRole("TEACHER")).toBe("TEACHER");
    expect(normalizeRole("Guardian")).toBeNull();
    expect(normalizeRole("Accountant")).toBeNull();
  });
  it("only PRINCIPAL creates/activates sessions", () => {
    expect(hasPermission("PRINCIPAL", "session.create")).toBe(true);
    expect(hasPermission("PRINCIPAL", "session.activate")).toBe(true);
    expect(hasPermission("SUPER_ADMIN", "session.activate")).toBe(false);
    expect(hasPermission("SUPER_ADMIN", "session.create")).toBe(false);
    expect(hasPermission("DEPARTMENT_HEAD_CI", "session.activate")).toBe(false);
    expect(hasPermission("VICE_PRINCIPAL", "session.activate")).toBe(false);
  });
  it("SUPER_ADMIN is system-only, no academic override", () => {
    expect(hasPermission("SUPER_ADMIN", "user.manage")).toBe(true);
    expect(hasPermission("SUPER_ADMIN", "role.assign")).toBe(true);
    expect(hasPermission("SUPER_ADMIN", "settings.manage")).toBe(true);
    expect(hasPermission("SUPER_ADMIN", "student.create")).toBe(false);
    expect(hasPermission("SUPER_ADMIN", "attendance.take")).toBe(false);
    expect(hasPermission("SUPER_ADMIN", "result.import")).toBe(false);
    expect(hasPermission("SUPER_ADMIN", "shift.merge")).toBe(false);
  });
  it("VICE_PRINCIPAL is read-heavy, no academic writes", () => {
    expect(hasPermission("VICE_PRINCIPAL", "session.read")).toBe(true);
    expect(hasPermission("VICE_PRINCIPAL", "student.read")).toBe(true);
    expect(hasPermission("VICE_PRINCIPAL", "result.read")).toBe(true);
    expect(hasPermission("VICE_PRINCIPAL", "session.create")).toBe(false);
    expect(hasPermission("VICE_PRINCIPAL", "student.create")).toBe(false);
    expect(hasPermission("VICE_PRINCIPAL", "user.manage")).toBe(false);
  });
  it("CI-scoped perms use DEPARTMENT_HEAD_CI", () => {
    expect(hasPermission("DEPARTMENT_HEAD_CI", "student.create")).toBe(true);
    expect(hasPermission("DEPARTMENT_HEAD_CI", "student.update")).toBe(true);
    expect(hasPermission("DEPARTMENT_HEAD_CI", "routine.manage")).toBe(true);
    expect(hasPermission("TEACHER", "student.create")).toBe(false);
    expect(hasPermission("CI", "student.create")).toBe(true); // legacy alias
  });
  it("teacher takes attendance, student reads own", () => {
    expect(hasPermission("TEACHER", "attendance.take")).toBe(true);
    expect(hasPermission("STUDENT", "attendance.take")).toBe(false);
    expect(hasPermission("STUDENT", "attendance.read")).toBe(true);
    expect(hasPermission("STUDENT", "notice.read")).toBe(true);
    expect(hasPermission("STUDENT", "user.manage")).toBe(false);
  });
  it("permissionsFor covers each role without overlap errors", () => {
    expect(permissionsFor("SUPER_ADMIN")).toContain("user.manage");
    expect(permissionsFor("PRINCIPAL")).toContain("session.activate");
    expect(permissionsFor("VICE_PRINCIPAL")).not.toContain("session.activate");
    expect(permissionsFor("STUDENT")).not.toContain("teacher.manage");
  });
});
