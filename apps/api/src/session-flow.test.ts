import { describe, expect, it } from 'vitest';
import { canTransition } from './session-flow.js';

describe('session lifecycle', () => {
  it('allows DRAFT -> ACTIVE and DRAFT -> ARCHIVED', () => {
    expect(canTransition('DRAFT', 'ACTIVE')).toBe(true);
    expect(canTransition('DRAFT', 'ARCHIVED')).toBe(true);
    expect(canTransition('DRAFT', 'CLOSED')).toBe(false);
  });
  it('allows ACTIVE -> CLOSED only', () => {
    expect(canTransition('ACTIVE', 'CLOSED')).toBe(true);
    expect(canTransition('ACTIVE', 'ARCHIVED')).toBe(false);
    expect(canTransition('ACTIVE', 'DRAFT')).toBe(false);
  });
  it('allows CLOSED -> ARCHIVED or back to ACTIVE', () => {
    expect(canTransition('CLOSED', 'ARCHIVED')).toBe(true);
    expect(canTransition('CLOSED', 'ACTIVE')).toBe(true);
    expect(canTransition('CLOSED', 'DRAFT')).toBe(false);
  });
  it('ARCHIVED is terminal', () => {
    expect(canTransition('ARCHIVED', 'ACTIVE')).toBe(false);
    expect(canTransition('ARCHIVED', 'CLOSED')).toBe(false);
  });
});
