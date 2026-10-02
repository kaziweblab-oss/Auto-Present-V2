import { describe, expect, it } from "vitest";
import { toCsv } from "./admin.js";

describe("audit reporting (Phase 21)", () => {
  it("exports stable CSV with header + escaping", () => {
    const csv = toCsv([
      {
        createdAt: "2026-10-02",
        actorUserId: "U1",
        role: "PRINCIPAL",
        action: "session.activate",
        entity: "Session",
        entityId: "S1",
      },
      {
        createdAt: "2026-10-02",
        actorUserId: "U2",
        role: "TEACHER",
        action: 'note "quoted", comma',
        entity: "Notice",
        entityId: "N1",
      },
    ]);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("createdAt,actorUserId,role,action,entity,entityId");
    expect(lines[1]).toContain("session.activate");
    expect(lines[2]).toContain('""quoted""');
  });
  it("audit log stays append-only (no edit/delete routes)", async () => {
    const src = (await import("node:fs")).readFileSync(
      new URL("./admin.ts", import.meta.url),
      "utf8",
    );
    expect(src).not.toMatch(/\.findByIdAndUpdate\([\s\S]*?AuditLog/);
    expect(src).not.toMatch(/deleteOne|deleteMany|findByIdAndDelete/);
  });
});
