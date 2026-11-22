import { describe, it, expect } from 'vitest';
import { mayStillBeWaiting } from './waitingForReport';

describe('mayStillBeWaiting', () => {
  const now = new Date('2026-11-22T12:00:00Z');

  it('waits before and just after the scheduled departure', () => {
    expect(mayStillBeWaiting({ serviceDate: '2026-11-22', pinScheduledDeparture: '2026-11-22T14:00:00Z' }, now)).toBe(
      true,
    );
    expect(mayStillBeWaiting({ serviceDate: '2026-11-22', pinScheduledDeparture: '2026-11-22T09:00:00Z' }, now)).toBe(
      true,
    );
  });

  it('stops waiting a wide margin after the departure', () => {
    expect(mayStillBeWaiting({ serviceDate: '2026-11-22', pinScheduledDeparture: '2026-11-21T23:00:00Z' }, now)).toBe(
      false,
    );
    expect(mayStillBeWaiting({ serviceDate: '2026-08-28', pinScheduledDeparture: '2026-08-28T08:00:00Z' }, now)).toBe(
      false,
    );
  });

  it('without a departure time, goes by the London service date: today and yesterday only', () => {
    expect(mayStillBeWaiting({ serviceDate: '2026-11-22' }, now)).toBe(true);
    expect(mayStillBeWaiting({ serviceDate: '2026-11-21' }, now)).toBe(true);
    expect(mayStillBeWaiting({ serviceDate: '2026-11-20' }, now)).toBe(false);
    expect(mayStillBeWaiting({ serviceDate: '2026-12-01', pinScheduledDeparture: null }, now)).toBe(true);
  });

  it('never claims waiting for a date it cannot read', () => {
    expect(mayStillBeWaiting({ serviceDate: 'nope', pinScheduledDeparture: null }, now)).toBe(false);
  });
});
