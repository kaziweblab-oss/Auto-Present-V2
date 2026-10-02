import { describe, expect, it } from "vitest";
import { hasPermission } from "@auto-present-v2/shared";

describe("vice principal scope (Phase 17)", () => {
  it("has institute-wide reads, no academic writes", () => {
    for (const p of [
      "session.read",
      "student.read",
      "teacher.read",
      "attendance.read",
      "result.read",
      "transfer.read",
      "notice.read",
      "holiday.read",
    ] as const) {
      expect(hasPermission("VICE_PRINCIPAL", p)).toBe(true);
    }
    for (const p of [
      "session.create",
      "session.activate",
      "student.create",
      "user.manage",
      "result.import",
      "transfer.approve",
      "shift.merge",
    ] as const) {
      expect(hasPermission("VICE_PRINCIPAL", p)).toBe(false);
    }
  });
});
