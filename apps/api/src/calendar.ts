import { Router } from "express";
import { z } from "zod";
import { Holiday, SystemSetting, audit } from "./models.js";
import { dbOk } from "./db-guard.js";
import { dayName, eachDate, isClosedByWeekly } from "./calendar-logic.js";
import {
  hydrateScope,
  requireAuth,
  requirePermission,
  type AuthedRequest,
} from "./rbac.js";

export const calendarRouter = Router();
calendarRouter.use(requireAuth);
calendarRouter.use(hydrateScope);

const DEFAULT_WEEKLY = ["FRI", "SAT"];
const DAY_ENUM = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;

async function weeklyClosure(): Promise<string[]> {
  const row = (await SystemSetting.findOne({
    key: "calendar.weeklyClosure",
  }).lean()) as unknown as {
    value: string[];
  } | null;
  return Array.isArray(row?.value) ? row.value : DEFAULT_WEEKLY;
}

calendarRouter.get(
  "/config",
  requirePermission("holiday.read"),
  async (_req, res) => {
    if (!dbOk(res)) return;
    res.json({
      success: true,
      data: { weeklyClosure: await weeklyClosure(), defaults: DEFAULT_WEEKLY },
    });
  },
);

const configSchema = z.object({
  weeklyClosure: z.array(z.enum(DAY_ENUM)).max(7),
});

calendarRouter.put(
  "/config",
  requirePermission("holiday.manage"),
  async (req: AuthedRequest, res) => {
    if (!dbOk(res)) return;
    const parsed = configSchema.safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({ success: false, error: { code: "VALIDATION_ERROR" } });
    await SystemSetting.findOneAndUpdate(
      { key: "calendar.weeklyClosure" },
      { value: parsed.data.weeklyClosure, updatedBy: req.user!.id },
      { upsert: true },
    );
    await audit({
      actorUserId: req.user!.id,
      role: req.user!.roles[0],
      action: "calendar.config",
      entity: "SystemSetting",
      after: parsed.data,
    });
    res.json({
      success: true,
      data: { weeklyClosure: parsed.data.weeklyClosure },
    });
  },
);

const holidaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  title: z.string().min(2).max(200),
  reason: z.string().max(1000).optional(),
  type: z.enum([
    "WEEKLY_CLOSURE",
    "PUBLIC_HOLIDAY",
    "INSTITUTE_HOLIDAY",
    "EMERGENCY_CLOSURE",
    "EXAM_HOLIDAY",
    "OTHER",
  ]),
});

calendarRouter.post(
  "/holidays",
  requirePermission("holiday.manage"),
  async (req: AuthedRequest, res) => {
    if (!dbOk(res)) return;
    const parsed = holidaySchema.safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({ success: false, error: { code: "VALIDATION_ERROR" } });
    const doc = await Holiday.findOneAndUpdate(
      { date: parsed.data.date },
      { ...parsed.data, status: "ACTIVE", createdBy: req.user!.id },
      { upsert: true, new: true },
    );
    await audit({
      actorUserId: req.user!.id,
      role: req.user!.roles[0],
      action: "holiday.upsert",
      entity: "Holiday",
      entityId: String(doc._id),
    });
    res.status(201).json({ success: true, data: doc });
  },
);

calendarRouter.get(
  "/holidays",
  requirePermission("holiday.read"),
  async (req, res) => {
    if (!dbOk(res)) return;
    const match: Record<string, unknown> = {};
    if (req.query.from || req.query.to) {
      match.date = {
        ...(req.query.from ? { $gte: String(req.query.from) } : {}),
        ...(req.query.to ? { $lte: String(req.query.to) } : {}),
      };
    }
    if (req.query.type) match.type = String(req.query.type);
    if (req.query.status) match.status = String(req.query.status);
    res.json({
      success: true,
      data: await Holiday.find(match).sort({ date: 1 }).limit(500).lean(),
    });
  },
);

calendarRouter.delete(
  "/holidays/:id",
  requirePermission("holiday.manage"),
  async (req: AuthedRequest, res) => {
    if (!dbOk(res)) return;
    const doc = await Holiday.findByIdAndUpdate(
      String(req.params.id),
      { status: "CANCELLED" },
      { new: true },
    ).lean();
    if (!doc)
      return res
        .status(404)
        .json({ success: false, error: { code: "NOT_FOUND" } });
    await audit({
      actorUserId: req.user!.id,
      role: req.user!.roles[0],
      action: "holiday.cancel",
      entity: "Holiday",
      entityId: String(req.params.id),
    });
    res.json({ success: true, data: doc });
  },
);

// Academic calendar grid: open vs closed per date.
calendarRouter.get("/", requirePermission("holiday.read"), async (req, res) => {
  if (!dbOk(res)) return;
  const to = String(req.query.to ?? new Date().toISOString().slice(0, 10));
  const from = String(
    req.query.from ??
      new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10),
  );
  const weekly = await weeklyClosure();
  const holidays = await Holiday.find({
    date: { $gte: from, $lte: to },
    status: "ACTIVE",
  }).lean();
  const byDate = new Map(
    holidays.map((h) => [String((h as unknown as { date: string }).date), h]),
  );
  const days = eachDate(from, to).map((date) => {
    const h = byDate.get(date) as { title: string; type: string } | undefined;
    const weeklyClosed = isClosedByWeekly(date, weekly);
    return {
      date,
      day: dayName(date),
      open: !weeklyClosed && !h,
      weeklyClosed,
      holiday: h ?? null,
    };
  });
  res.json({ success: true, data: { from, to, weeklyClosure: weekly, days } });
});

// Class availability for a single date.
calendarRouter.get(
  "/check",
  requirePermission("holiday.read"),
  async (req, res) => {
    if (!dbOk(res)) return;
    const date = String(req.query.date ?? "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
      return res
        .status(400)
        .json({ success: false, error: { code: "DATE_REQUIRED" } });
    const weekly = await weeklyClosure();
    const h = (await Holiday.findOne({
      date,
      status: "ACTIVE",
    }).lean()) as unknown as {
      title: string;
      type: string;
    } | null;
    const weeklyClosed = isClosedByWeekly(date, weekly);
    res.json({
      success: true,
      data: {
        date,
        day: dayName(date),
        open: !weeklyClosed && !h,
        reason: h
          ? `${h.type}: ${h.title}`
          : weeklyClosed
            ? "WEEKLY_CLOSURE"
            : null,
      },
    });
  },
);
