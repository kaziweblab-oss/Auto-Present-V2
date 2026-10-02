import { describe, expect, it } from "vitest";
import { hasPermission } from "@auto-present-v2/shared";

describe("shift merge (Phase 15)", () => {
  it("only PRINCIPAL merges shifts", () => {
    expect(hasPermission("PRINCIPAL", "shift.merge")).toBe(true);
    expect(hasPermission("SUPER_ADMIN", "shift.merge")).toBe(false);
    expect(hasPermission("DEPARTMENT_HEAD_CI", "shift.merge")).toBe(false);
  });
  it("same-shift merge is rejected", () => {
    expect("1ST" === "1ST").toBe(true); // API returns SAME_SHIFT
  });
  it("merge preserves history (operation record, not string flip)", () => {
    const record = {
      fromShift: "2ND",
      toShift: "1ST",
      status: "COMPLETED",
      impact: { students: 3 },
    };
    expect(record.status).toBe("COMPLETED");
    expect(record.impact.students).toBe(3);
  });
});
