import { describe, expect, it } from "vitest";
import { StudentSession } from "./models.js";

describe("student/session model (Phase 1 schema validation)", () => {
  it("requires shift + enforces history fields", () => {
    const doc = new StudentSession({
      studentId: "000000000000000000000001",
      sessionId: "000000000000000000000002",
      departmentId: "000000000000000000000003",
      shift: "1ST",
      roll: "229169",
      status: "ENROLLED",
    });
    expect(doc.validateSync()).toBeUndefined();
  });
  it("rejects invalid shift", () => {
    const doc = new StudentSession({
      studentId: "000000000000000000000001",
      sessionId: "000000000000000000000002",
      departmentId: "000000000000000000000003",
      shift: "3RD",
      roll: "229169",
    });
    expect(doc.validateSync()).toBeDefined();
  });
});
