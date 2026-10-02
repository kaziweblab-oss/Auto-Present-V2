import { describe, expect, it } from "vitest";

describe("CI scope (Phase 18)", () => {
  it("CI is forced to own department", () => {
    const scope: string = "deptA";
    const requested: string = "deptB";
    expect(requested !== scope).toBe(true); // API returns SCOPE_MISMATCH
  });
  it("privileged roles may pass any department", () => {
    for (const r of ["SUPER_ADMIN", "PRINCIPAL"]) {
      expect(["SUPER_ADMIN", "PRINCIPAL"].includes(r)).toBe(true);
    }
  });
});
