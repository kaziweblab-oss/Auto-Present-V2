import { describe, expect, it } from "vitest";
import { findConflicts, overlaps } from "./conflicts.js";

describe("schedule conflicts (Phase 6)", () => {
  it("detects overlap, ignores touching edges", () => {
    expect(overlaps("10:00", "11:00", "10:30", "11:30")).toBe(true);
    expect(overlaps("10:00", "11:00", "11:00", "12:00")).toBe(false);
  });
  it("blocks teacher double-booking", () => {
    const c = findConflicts(
      {
        teacherId: "T1",
        classGroupId: "C2",
        day: "SUN",
        startTime: "10:00",
        endTime: "11:00",
      },
      [
        {
          teacherId: "T1",
          classGroupId: "C1",
          day: "SUN",
          startTime: "10:30",
          endTime: "11:30",
          status: "ACTIVE",
        },
      ],
    );
    expect(c.some((x) => x.type === "TEACHER")).toBe(true);
  });
  it("blocks class overlap and room clash", () => {
    const c = findConflicts(
      {
        teacherId: "T2",
        classGroupId: "C1",
        room: "R1",
        day: "MON",
        startTime: "10:00",
        endTime: "11:00",
      },
      [
        {
          teacherId: "T9",
          classGroupId: "C1",
          day: "MON",
          startTime: "10:15",
          endTime: "10:45",
          status: "ACTIVE",
        },
        {
          teacherId: "T8",
          classGroupId: "C8",
          room: "R1",
          day: "MON",
          startTime: "10:15",
          endTime: "10:45",
          status: "ACTIVE",
        },
      ],
    );
    expect(c.some((x) => x.type === "CLASS")).toBe(true);
    expect(c.some((x) => x.type === "ROOM")).toBe(true);
  });
  it("ignores different days and inactive rows", () => {
    const c = findConflicts(
      {
        teacherId: "T1",
        classGroupId: "C1",
        day: "TUE",
        startTime: "10:00",
        endTime: "11:00",
      },
      [
        {
          teacherId: "T1",
          classGroupId: "C1",
          day: "MON",
          startTime: "10:00",
          endTime: "11:00",
          status: "ACTIVE",
        },
        {
          teacherId: "T1",
          classGroupId: "C1",
          day: "TUE",
          startTime: "10:00",
          endTime: "11:00",
          status: "INACTIVE",
        },
      ],
    );
    expect(c).toHaveLength(0);
  });
});
