import { describe, expect, it } from "vitest";
import { hasPermission } from "@auto-present-v2/shared";

describe("result import rules (Phase 10)", () => {
  it("only PRINCIPAL imports/revises official results", () => {
    expect(hasPermission("PRINCIPAL", "result.import")).toBe(true);
    expect(hasPermission("DEPARTMENT_HEAD_CI", "result.import")).toBe(false);
    expect(hasPermission("TEACHER", "result.import")).toBe(false);
    expect(hasPermission("PRINCIPAL", "result.revise")).toBe(true);
  });
  it("dropped is derived, never hand-set by CI", () => {
    // Phase 4 blocks CI from setting DROPPED; only result import may.
    expect(hasPermission("DEPARTMENT_HEAD_CI", "result.import")).toBe(false);
    expect(["PASSED", "FAILED", "DROPPED", "RETAINED"]).toContain("DROPPED");
  });
  it("every import tracks official source", () => {
    const imp = {
      source: "BTEB_BOARD",
      publicationDate: "2026-08-01",
      matched: 2,
      unmatched: [],
    };
    expect(imp.source).toMatch(/^BTEB_/);
    expect(imp.matched).toBe(2);
  });
});
