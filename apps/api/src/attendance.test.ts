import { describe, expect, it } from "vitest";
import { windowFor } from "./attendance-time.js";

describe("attendance windows (Phase 7)", () => {
  // Class 10:00-11:00 → PRESENT 10:00-10:30, LATE 10:30-11:00, CLOSED after.
  it("10:00 class halves correctly", () => {
    expect(windowFor("10:00", "11:00", 9 * 60 + 59)).toBe("NOT_OPEN");
    expect(windowFor("10:00", "11:00", 10 * 60)).toBe("PRESENT");
    expect(windowFor("10:00", "11:00", 10 * 60 + 30)).toBe("PRESENT");
    expect(windowFor("10:00", "11:00", 10 * 60 + 31)).toBe("LATE");
    expect(windowFor("10:00", "11:00", 11 * 60)).toBe("LATE");
    expect(windowFor("10:00", "11:00", 11 * 60 + 1)).toBe("CLOSED");
  });
  it("odd durations split at midpoint", () => {
    // 09:00-10:30 (90 min) → mid 09:45
    expect(windowFor("09:00", "10:30", 9 * 60 + 45)).toBe("PRESENT");
    expect(windowFor("09:00", "10:30", 9 * 60 + 46)).toBe("LATE");
  });
});
