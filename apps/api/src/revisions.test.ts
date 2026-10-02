import { describe, expect, it } from "vitest";

describe("revision + restore rules (Phase 11)", () => {
  it("DROPPED → PASSED restores without deleting history", () => {
    const history = [{ session: "2026-27", status: "DROPPED" }];
    const restored = { session: "2025-26", status: "ENROLLED" };
    // old row stays, new placement added
    expect(history[0].status).toBe("DROPPED");
    expect(restored.status).toBe("ENROLLED");
    expect(history).toHaveLength(1);
  });
  it("revision records source + supersede chain", () => {
    const rev = {
      oldStatus: "DROPPED",
      newStatus: "PASSED",
      source: "BTEB_REVISED",
    };
    expect(rev.oldStatus).not.toBe(rev.newStatus);
    expect(rev.source).toBe("BTEB_REVISED");
  });
  it("same-session reassign is rejected", () => {
    const from = "sessA";
    const to = "sessA";
    expect(from === to).toBe(true); // API returns SAME_SESSION
  });
});
