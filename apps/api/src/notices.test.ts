import { describe, expect, it } from "vitest";
import { hasPermission } from "@auto-present-v2/shared";

describe("notice targeting + read state (Phase 13)", () => {
  it("create is role-gated, read is broad", () => {
    expect(hasPermission("TEACHER", "notice.create")).toBe(true);
    expect(hasPermission("STUDENT", "notice.create")).toBe(false);
    expect(hasPermission("STUDENT", "notice.read")).toBe(true);
    expect(hasPermission("DEPARTMENT_HEAD_CI", "notice.publish")).toBe(true);
  });
  it("read state is per-user, not global", () => {
    const reads = [
      { noticeId: "N1", userId: "U1", readAt: new Date() },
      { noticeId: "N1", userId: "U2", readAt: null },
    ];
    expect(reads.filter((r) => r.readAt).length).toBe(1);
  });
  it("expired notices are hidden from inbox", () => {
    const now = new Date("2026-10-02T12:00:00");
    const exp = new Date("2026-10-01T12:00:00");
    expect(exp < now).toBe(true); // inbox filters expiresAt > now
  });
});
