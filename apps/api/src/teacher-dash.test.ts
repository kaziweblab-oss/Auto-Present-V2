import { describe, expect, it } from "vitest";
import { hasPermission } from "@auto-present-v2/shared";

describe("teacher dashboard scope (Phase 19)", () => {
  it("teacher sees own workflow, not others", () => {
    expect(hasPermission("TEACHER", "attendance.take")).toBe(true);
    expect(hasPermission("TEACHER", "replacement.request")).toBe(true);
    expect(hasPermission("TEACHER", "replacement.respond")).toBe(true);
    expect(hasPermission("TEACHER", "student.create")).toBe(false);
    expect(hasPermission("TEACHER", "user.manage")).toBe(false);
  });
});
