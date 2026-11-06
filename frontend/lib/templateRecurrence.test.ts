import { describe, it, expect } from 'vitest';
import { nextRunLabel, recurrenceSummary } from './templateRecurrence';

describe('recurrenceSummary', () => {
  it('names the common patterns', () => {
    expect(recurrenceSummary(127)).toBe('Every day');
    expect(recurrenceSummary(31)).toBe('Weekdays');
    expect(recurrenceSummary(96)).toBe('Weekends');
  });

  it('lists any other days in week order', () => {
    expect(recurrenceSummary(1 | 4 | 16)).toBe('Mon, Wed, Fri');
    expect(recurrenceSummary(64)).toBe('Sun');
  });

  it('says a template with no days does not recur', () => {
    expect(recurrenceSummary(null)).toBe('Not recurring');
    expect(recurrenceSummary(0)).toBe('Not recurring');
  });
});

describe('nextRunLabel', () => {
  // 23:30 in London on Fri 6 Nov 2026 (GMT).
  const now = new Date('2026-11-06T23:30:00Z');

  it('says today and tomorrow by London date', () => {
    expect(nextRunLabel('2026-11-06', now)).toBe('today');
    expect(nextRunLabel('2026-11-07', now)).toBe('tomorrow');
  });

  it('gives a later date with its weekday', () => {
    expect(nextRunLabel('2026-11-09', now)).toBe('Mon 9 Nov');
  });
});
