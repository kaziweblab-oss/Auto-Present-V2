import { describe, expect, it, vi } from "vitest";
import { requireDepartmentScope, requirePermission } from "./rbac.js";

function ctx(user: unknown, params = {}, body = {}) {
  const req = { params, body, user } as never;
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as never;
  const next = vi.fn();
  return { req, res, next };
}

describe("rbac scope (Phase 2)", () => {
  it("SUPER_ADMIN/PRINCIPAL bypass department scope", () => {
    for (const roles of [["SUPER_ADMIN"], ["PRINCIPAL"]]) {
      const { req, res, next } = ctx({ roles, departmentScope: null });
      requireDepartmentScope()(req as never, res as never, next);
      expect(next).toHaveBeenCalled();
    }
  });
  it("CI without scope is blocked", () => {
    const { req, res, next } = ctx({
      roles: ["DEPARTMENT_HEAD_CI"],
      departmentScope: null,
    });
    requireDepartmentScope()(req as never, res as never, next);
    expect(next).not.toHaveBeenCalled();
    expect(
      (res as { status: ReturnType<typeof vi.fn> }).status,
    ).toHaveBeenCalledWith(403);
  });
  it("CI with mismatched department is blocked", () => {
    const { req, res, next } = ctx(
      { roles: ["DEPARTMENT_HEAD_CI"], departmentScope: "deptA" },
      { departmentId: "deptB" },
    );
    requireDepartmentScope()(req as never, res as never, next);
    expect(next).not.toHaveBeenCalled();
  });
  it("CI with matching department passes", () => {
    const { req, res, next } = ctx(
      { roles: ["DEPARTMENT_HEAD_CI"], departmentScope: "deptA" },
      { departmentId: "deptA" },
    );
    requireDepartmentScope()(req as never, res as never, next);
    expect(next).toHaveBeenCalled();
  });
  it("requirePermission denies without role", () => {
    const { req, res, next } = ctx({ roles: ["STUDENT"] });
    requirePermission("user.manage")(req as never, res as never, next);
    expect(next).not.toHaveBeenCalled();
  });
});
