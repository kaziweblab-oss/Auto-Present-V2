import type { SessionState } from '@auto-present-v2/shared';

// Pure session lifecycle rules (unit-tested). Only one ACTIVE session at a time:
// activating a session moves the currently ACTIVE one to CLOSED (history preserved).
export const NEXT: Record<SessionState, SessionState[]> = {
  DRAFT: ['ACTIVE', 'ARCHIVED'],
  ACTIVE: ['CLOSED'],
  CLOSED: ['ARCHIVED', 'ACTIVE'],
  ARCHIVED: [],
};

export function canTransition(from: SessionState, to: SessionState): boolean {
  return NEXT[from].includes(to);
}
