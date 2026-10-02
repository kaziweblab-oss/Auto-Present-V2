import { describe, expect, it } from "vitest";
import { dayName, isClosedByWeekly } from "./calendar-logic.js";
import { hasPermission } from "@auto-present-v2/shared";

describe("holiday + calendar (Phase 14)", () => {
  it("Friday/Saturday closed by default config", () => {
    expect(dayName("2026-10-02")).toBe("FRI");
    expect(dayName("2026-10-03")).toBe("SAT");
    expect(isClosedByWeekly("2026-10-02", ["FRI", "SAT"])).toBe(true);
    expect(isClosedByWeekly("2026-10-04", ["FRI", "SAT"])).toBe(false);
  });
  it("weekly closure is configurable, not hardcoded", () => {
    expect(isClosedByWeekly("2026-10-02", ["SUN"])).toBe(false);
    expect(isClosedByWeekly("2026-10-04", ["SUN"])).toBe(true);
  });
  it("holiday.manage is Principal/Super Admin", () => {
    expect(hasPermission("PRINCIPAL", "holiday.manage")).toBe(true);
    expect(hasPermission("SUPER_ADMIN", "holiday.manage")).toBe(true);
    expect(hasPermission("TEACHER", "holiday.manage")).toBe(false);
    expect(hasPermission("STUDENT", "holiday.read")).toBe(true);
  });
});
