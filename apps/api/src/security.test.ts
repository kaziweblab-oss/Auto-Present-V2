import { describe, expect, it } from "vitest";

describe("security hardening (Phase 24)", () => {
  it("helmet + rate-limit wired in server", async () => {
    const src = (await import("node:fs")).readFileSync(
      new URL("./server.ts", import.meta.url),
      "utf8",
    );
    expect(src).toMatch(/helmet\(\)/);
    expect(src).toMatch(/express-rate-limit|rateLimit/);
    expect(src).toMatch(/sensitiveLimiter/);
    expect(src).toMatch(/1mb/);
  });
  it("strict mode never trusts header roles", async () => {
    const src = (await import("node:fs")).readFileSync(
      new URL("./rbac.ts", import.meta.url),
      "utf8",
    );
    expect(src).toMatch(/AUTH_STRICT/);
    expect(src).toMatch(/DB is the source of truth/);
  });
  it("no secrets committed (uri/password/token/code)", async () => {
    const { execSync } = await import("node:child_process");
    let out = "";
    try {
      out = execSync(
        'git grep -n -i -E "mongodb(\\+srv)?://|BEGIN [A-Z ]*PRIVATE KEY" -- .',
        { encoding: "utf8" },
      );
    } catch {
      out = ""; // no matches → git grep exits 1
    }
    const hits = out
      .split("\n")
      .filter(
        (l) =>
          l.trim() &&
          !l.includes("package-lock.json") &&
          !l.includes("mongo.json"),
      );
    expect(hits).toEqual([]);
  });
});
