import type { SessionState } from "@auto-present-v2/shared";
import { SESSION_NEXT } from "@auto-present-v2/shared";

// Pure session lifecycle rules (unit-tested, no DB).
export const NEXT = SESSION_NEXT;

export function canTransition(from: SessionState, to: SessionState): boolean {
  return NEXT[from].includes(to);
}
