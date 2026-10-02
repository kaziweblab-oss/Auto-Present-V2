import { describe, expect, it } from "vitest";
import { canTransition } from "./session-flow.js";

describe("session lifecycle (Phase 1)", () => {
  it("DRAFT -> ACTIVE | ARCHIVED only", () => {
    expect(canTransition("DRAFT", "ACTIVE")).toBe(true);
    expect(canTransition("DRAFT", "ARCHIVED")).toBe(true);
    expect(canTransition("DRAFT", "CLOSED")).toBe(false);
  });
  it("ACTIVE -> CLOSED only", () => {
    expect(canTransition("ACTIVE", "CLOSED")).toBe(true);
    expect(canTransition("ACTIVE", "ARCHIVED")).toBe(false);
  });
  it("CLOSED -> ARCHIVED | ACTIVE", () => {
    expect(canTransition("CLOSED", "ARCHIVED")).toBe(true);
    expect(canTransition("CLOSED", "ACTIVE")).toBe(true);
    expect(canTransition("CLOSED", "DRAFT")).toBe(false);
  });
  it("ARCHIVED terminal", () => {
    expect(canTransition("ARCHIVED", "ACTIVE")).toBe(false);
  });
});
