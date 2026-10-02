// Server-authoritative attendance windows (§15). Never trust browser time.
export type Window = "NOT_OPEN" | "PRESENT" | "LATE" | "CLOSED";

export function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function windowFor(
  startTime: string,
  endTime: string,
  nowMin: number,
): Window {
  const s = toMinutes(startTime);
  const e = toMinutes(endTime);
  if (nowMin < s) return "NOT_OPEN";
  if (nowMin > e) return "CLOSED";
  const mid = s + (e - s) / 2;
  return nowMin <= mid ? "PRESENT" : "LATE";
}

export function minutesToTime(min: number): string {
  const h = String(Math.floor(min / 60)).padStart(2, "0");
  const m = String(min % 60).padStart(2, "0");
  return `${h}:${m}`;
}

export function nowMinutes(d = new Date()): number {
  return d.getHours() * 60 + d.getMinutes();
}

export function todayStr(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
