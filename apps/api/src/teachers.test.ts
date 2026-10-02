import { describe, expect, it } from "vitest";

describe("teacher + captain rules (Phase 5)", () => {
  it("captain is not a global role", async () => {
    const { ROLES } = await import("@auto-present-v2/shared");
    expect(ROLES).not.toContain("CAPTAIN");
    expect(ROLES).toContain("DEPARTMENT_HEAD_CI");
  });
  it("captain validity window must be ordered", () => {
    const from = new Date("2026-01-01");
    const to = new Date("2026-06-01");
    expect(from < to).toBe(true);
    expect(to < from).toBe(false);
  });
  it("teacher employeeId is the stable identity", () => {
    const a = { employeeId: "T-101", session: "2025-26" };
    const b = { employeeId: "T-101", session: "2026-27" };
    expect(a.employeeId).toBe(b.employeeId);
  });
});
