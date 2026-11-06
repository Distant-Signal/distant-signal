import { describe, expect, it } from 'vitest';
import { leaveByLabel, leaveByPhase, minutesUntilLabel } from './leaveBy';
import type { LeaveBy } from './types';

const LEAVE_BY: LeaveBy = { at: '2026-11-09T08:20:00Z', departure: '2026-11-09T08:42:00Z', basis: 'booked' };

describe('leaveByPhase', () => {
  it('counts down, then is due until the train leaves', () => {
    expect(leaveByPhase(LEAVE_BY, new Date('2026-11-09T08:08:00Z'))).toEqual({ kind: 'before', minutes: 12 });
    expect(leaveByPhase(LEAVE_BY, new Date('2026-11-09T08:19:30Z'))).toEqual({ kind: 'before', minutes: 1 });
    expect(leaveByPhase(LEAVE_BY, new Date('2026-11-09T08:20:00Z'))).toEqual({ kind: 'now' });
    expect(leaveByPhase(LEAVE_BY, new Date('2026-11-09T08:41:59Z'))).toEqual({ kind: 'now' });
    expect(leaveByPhase(LEAVE_BY, new Date('2026-11-09T08:42:00Z'))).toEqual({ kind: 'gone' });
  });
});

describe('minutesUntilLabel', () => {
  it('says minutes, then hours and minutes', () => {
    expect(minutesUntilLabel(12)).toBe('in 12 min');
    expect(minutesUntilLabel(60)).toBe('in 1 h');
    expect(minutesUntilLabel(65)).toBe('in 1 h 5 min');
  });
});

describe('leaveByLabel', () => {
  it('words the booked, late and suggested cases in London time', () => {
    expect(leaveByLabel(LEAVE_BY)).toBe('Leave by 08:20');
    expect(leaveByLabel(LEAVE_BY, 0)).toBe('Leave by 08:20');
    expect(leaveByLabel(LEAVE_BY, 6)).toBe('Leave by 08:20 · train expected 6 min late');
    expect(
      leaveByLabel({ at: '2026-11-09T08:35:00Z', departure: '2026-11-09T08:57:00Z', basis: 'suggestion' }, 6),
    ).toBe('Leave by 08:35 for the 08:57');
    // British Summer Time.
    expect(leaveByLabel({ ...LEAVE_BY, at: '2026-07-01T07:20:00Z' })).toBe('Leave by 08:20');
  });
});
