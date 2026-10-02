// Replacement policy helpers (pure, unit-tested). Server time authoritative.
export const DEFAULTS = {
  minLeadMinutes: 60,
  responseWindowMinutes: 30,
  maxManualDays: 7,
};

export function classStart(date: string, startTime: string): Date {
  return new Date(`${date}T${startTime}:00`);
}

export function minutesUntil(
  date: string,
  startTime: string,
  now = new Date(),
): number {
  return (classStart(date, startTime).getTime() - now.getTime()) / 60000;
}

export function leadOk(
  date: string,
  startTime: string,
  minLead: number,
  now = new Date(),
): boolean {
  return minutesUntil(date, startTime, now) >= minLead;
}

export function manualWithinDays(
  date: string,
  maxDays: number,
  now = new Date(),
): boolean {
  const day = new Date(`${date}T00:00:00`);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const diff = (day.getTime() - today.getTime()) / 86400000;
  return diff >= 0 && diff <= maxDays;
}

export function responseDeadline(now = new Date(), windowMin: number): Date {
  return new Date(now.getTime() + windowMin * 60000);
}

export function isExpired(
  status: string,
  expiresAt: Date,
  now = new Date(),
): boolean {
  return status === "PENDING" && now > expiresAt;
}
