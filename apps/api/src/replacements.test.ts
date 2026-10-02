import { describe, expect, it } from "vitest";
import { isExpired, leadOk, manualWithinDays } from "./replacement-time.js";
import { hasPermission } from "@auto-present-v2/shared";

describe("replacement policy (Phase 8)", () => {
  it("60-min lead: 8:55 ok, 9:58 rejected for 10:00 class", () => {
    const now1 = new Date("2026-10-15T08:55:00");
    const now2 = new Date("2026-10-15T09:58:00");
    expect(leadOk("2026-10-15", "10:00", 60, now1)).toBe(true);
    expect(leadOk("2026-10-15", "10:00", 60, now2)).toBe(false);
  });
  it("manual requests bounded by max days", () => {
    const now = new Date("2026-10-10T12:00:00");
    expect(manualWithinDays("2026-10-15", 7, now)).toBe(true);
    expect(manualWithinDays("2026-10-20", 7, now)).toBe(false);
    expect(manualWithinDays("2026-10-09", 7, now)).toBe(false);
  });
  it("pending expires after deadline", () => {
    expect(
      isExpired(
        "PENDING",
        new Date("2026-10-15T08:30:00"),
        new Date("2026-10-15T08:31:00"),
      ),
    ).toBe(true);
    expect(
      isExpired(
        "ACCEPTED",
        new Date("2026-10-15T08:30:00"),
        new Date("2026-10-15T09:00:00"),
      ),
    ).toBe(false);
  });
  it("replacement perms are teacher/principal scoped", () => {
    expect(hasPermission("TEACHER", "replacement.request")).toBe(true);
    expect(hasPermission("TEACHER", "replacement.respond")).toBe(true);
    expect(hasPermission("STUDENT", "replacement.request")).toBe(false);
    expect(hasPermission("PRINCIPAL", "replacement.configure")).toBe(true);
    expect(hasPermission("TEACHER", "replacement.configure")).toBe(false);
  });
});
