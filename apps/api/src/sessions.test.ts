import { describe, expect, it } from "vitest";
import { z } from "zod";

const schema = z
  .object({
    name: z.string().regex(/^\d{4}-\d{2}$/),
    startDate: z.string().datetime({ offset: true }).optional(),
    endDate: z.string().datetime({ offset: true }).optional(),
  })
  .refine(
    (v) => {
      if (v.startDate && v.endDate)
        return new Date(v.startDate) < new Date(v.endDate);
      return true;
    },
    { message: "startDate must be before endDate" },
  );

describe("session validation (Phase 3)", () => {
  it("accepts 2025-26 style names", () => {
    expect(schema.safeParse({ name: "2025-26" }).success).toBe(true);
    expect(schema.safeParse({ name: "2025" }).success).toBe(false);
    expect(schema.safeParse({ name: "Semester 5" }).success).toBe(false);
  });
  it("rejects endDate before startDate", () => {
    const r = schema.safeParse({
      name: "2026-27",
      startDate: "2026-01-10T00:00:00.000Z",
      endDate: "2025-01-10T00:00:00.000Z",
    });
    expect(r.success).toBe(false);
  });
  it("allows open-ended sessions", () => {
    expect(schema.safeParse({ name: "2026-27" }).success).toBe(true);
  });
});
