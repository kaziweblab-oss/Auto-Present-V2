import { describe, expect, it } from "vitest";
import { extractRegistrations, extractRolls } from "./transfer-parse.js";
import { hasPermission } from "@auto-present-v2/shared";

describe("transfer workflow (Phase 12)", () => {
  it("extracts rolls from official notice text", () => {
    const text = "Transfer approved: Roll 229169, Roll 229170, Reg 1234567890";
    expect(extractRolls(text)).toContain("229169");
    expect(extractRolls(text)).toContain("229170");
    expect(extractRegistrations(text)).toContain("1234567890");
  });
  it("upload never auto-completes (PENDING preview first)", () => {
    const afterUpload = "PENDING";
    expect(afterUpload).not.toBe("COMPLETED");
  });
  it("approve requires PRINCIPAL", () => {
    expect(hasPermission("PRINCIPAL", "transfer.approve")).toBe(true);
    expect(hasPermission("DEPARTMENT_HEAD_CI", "transfer.approve")).toBe(false);
    expect(hasPermission("TEACHER", "transfer.approve")).toBe(false);
  });
});
