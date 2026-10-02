// Pure schedule-conflict helpers (unit-tested, no DB).
export function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function overlaps(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return (
    toMinutes(aStart) < toMinutes(bEnd) && toMinutes(bStart) < toMinutes(aEnd)
  );
}

export type Slot = {
  teacherId: string;
  classGroupId: string;
  room?: string;
  day: string;
  startTime: string;
  endTime: string;
  status?: string;
  _id?: string;
};

export function findConflicts(
  candidate: Slot,
  existing: Slot[],
): { type: "TEACHER" | "CLASS" | "ROOM"; with: string }[] {
  const out: { type: "TEACHER" | "CLASS" | "ROOM"; with: string }[] = [];
  for (const e of existing) {
    if (e.status && e.status !== "ACTIVE") continue;
    if (e._id && candidate._id && String(e._id) === String(candidate._id))
      continue;
    if (e.day !== candidate.day) continue;
    if (
      !overlaps(candidate.startTime, candidate.endTime, e.startTime, e.endTime)
    )
      continue;
    if (String(e.teacherId) === String(candidate.teacherId))
      out.push({ type: "TEACHER", with: String(e._id ?? "") });
    if (String(e.classGroupId) === String(candidate.classGroupId))
      out.push({ type: "CLASS", with: String(e._id ?? "") });
    if (candidate.room && e.room && e.room === candidate.room)
      out.push({ type: "ROOM", with: String(e._id ?? "") });
  }
  return out;
}
