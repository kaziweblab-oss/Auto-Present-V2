import { describe, expect, it } from "vitest";
import { hasPermission } from "@auto-present-v2/shared";

describe("super admin boundaries (Phase 16)", () => {
  it("system powers are SUPER_ADMIN-only", () => {
    expect(hasPermission("SUPER_ADMIN", "user.manage")).toBe(true);
    expect(hasPermission("SUPER_ADMIN", "settings.manage")).toBe(true);
    expect(hasPermission("PRINCIPAL", "settings.manage")).toBe(false);
    expect(hasPermission("PRINCIPAL", "user.manage")).toBe(false);
  });
  it("audit is SUPER_ADMIN + PRINCIPAL", () => {
    expect(hasPermission("SUPER_ADMIN", "audit.read")).toBe(true);
    expect(hasPermission("PRINCIPAL", "audit.read")).toBe(true);
    expect(hasPermission("VICE_PRINCIPAL", "audit.read")).toBe(false);
    expect(hasPermission("TEACHER", "audit.read")).toBe(false);
  });
  it("SUPER_ADMIN does not casually override academics", () => {
    expect(hasPermission("SUPER_ADMIN", "session.activate")).toBe(false);
    expect(hasPermission("SUPER_ADMIN", "result.import")).toBe(false);
    expect(hasPermission("SUPER_ADMIN", "shift.merge")).toBe(false);
  });
});
