// Pure calendar helpers (tested, no DB).
export const DAY_NAMES = [
  "SUN",
  "MON",
  "TUE",
  "WED",
  "THU",
  "FRI",
  "SAT",
] as const;

export function dayName(dateStr: string): string {
  return DAY_NAMES[new Date(`${dateStr}T12:00:00`).getDay()];
}

export function isClosedByWeekly(
  dateStr: string,
  weeklyClosure: string[],
): boolean {
  return weeklyClosure.includes(dayName(dateStr));
}

export function eachDate(from: string, to: string): string[] {
  const out: string[] = [];
  const d = new Date(`${from}T12:00:00`);
  const end = new Date(`${to}T12:00:00`);
  while (d <= end) {
    out.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return out.slice(0, 93); // cap ~3 months
}
