import { describe, expect, it } from "vitest";
import { hasPermission } from "@auto-present-v2/shared";

describe("student dashboard scope (Phase 20)", () => {
  it("student reads own domains, writes nothing academic", () => {
    for (const p of [
      "attendance.read",
      "result.read",
      "notice.read",
      "routine.read",
    ] as const) {
      expect(hasPermission("STUDENT", p)).toBe(true);
    }
    for (const p of [
      "attendance.take",
      "student.create",
      "result.import",
      "notice.create",
    ] as const) {
      expect(hasPermission("STUDENT", p)).toBe(false);
    }
  });
});
