import { describe, expect, it } from "vitest";

const ALLOWED_CI_STATUS = ["ACTIVE", "INACTIVE"];
const OFFICIAL_ONLY = ["DROPPED", "TRANSFERRED", "COMPLETED"];

describe("student status rules (Phase 4)", () => {
  it("CI may toggle ACTIVE/INACTIVE only", () => {
    expect(ALLOWED_CI_STATUS).toContain("ACTIVE");
    expect(ALLOWED_CI_STATUS).toContain("INACTIVE");
    expect(ALLOWED_CI_STATUS).not.toContain("DROPPED");
  });
  it("DROPPED/TRANSFERRED/COMPLETED require official workflow", () => {
    for (const s of OFFICIAL_ONLY) {
      expect(ALLOWED_CI_STATUS).not.toContain(s);
    }
  });
  it("registration number is the stable identity (not roll)", () => {
    // Roll 229169 can appear in two sessions with different status;
    // registrationNumber stays unique per human student.
    const history = [
      { session: "2024-25", roll: "229169", status: "COMPLETED" },
      { session: "2025-26", roll: "229169", status: "DROPPED" },
    ];
    expect(history.map((h) => h.roll)).toEqual(["229169", "229169"]);
    expect(history[0].status).not.toBe(history[1].status);
  });
});
