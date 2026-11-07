import { describe, it, expect } from 'vitest';
import {
  isoWeekdayOf,
  isoWeekdayOfKey,
  nextDateOnWeekday,
  nextRunLabel,
  patternSummary,
  recurrenceSummary,
  runsByItself,
  weekdayPlural,
} from './templateRecurrence';

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

describe('patternSummary', () => {
  const weekly = { daysOfWeek: 5, recurrenceKind: 'weekly', intervalWeeks: 1, extraDates: [] as string[] };

  it('adds the interval and the extra dates to the days', () => {
    expect(patternSummary(weekly)).toBe('Mon, Wed');
    expect(patternSummary({ ...weekly, intervalWeeks: 2 })).toBe('Mon, Wed, every other week');
    expect(patternSummary({ ...weekly, intervalWeeks: 4 })).toBe('Mon, Wed, every 4 weeks');
    expect(patternSummary({ ...weekly, daysOfWeek: 31, extraDates: ['2026-11-14'] })).toBe('Weekdays, and 1 more date');
    expect(patternSummary({ ...weekly, intervalWeeks: 3, extraDates: ['a', 'b'] })).toBe(
      'Mon, Wed, every 3 weeks, and 2 more dates',
    );
  });

  it('counts a list of dates, and reads a kind it does not know as set dates', () => {
    expect(patternSummary({ ...weekly, recurrenceKind: 'dates', extraDates: ['a', 'b', 'c'] })).toBe('On 3 dates');
    expect(patternSummary({ ...weekly, daysOfWeek: null, extraDates: ['a'] })).toBe('On 1 date');
    expect(patternSummary({ ...weekly, daysOfWeek: null })).toBe('Not recurring');
    expect(patternSummary({ ...weekly, recurrenceKind: 'cycle' })).toBe('On set dates');
  });

  it('says which run by themselves', () => {
    expect(runsByItself(weekly)).toBe(true);
    expect(runsByItself({ ...weekly, daysOfWeek: null })).toBe(false);
    expect(runsByItself({ ...weekly, daysOfWeek: null, extraDates: ['a'] })).toBe(true);
    expect(runsByItself({ ...weekly, daysOfWeek: null, recurrenceKind: 'dates', extraDates: ['a'] })).toBe(true);
  });
});

describe('ISO weekdays (a different time on some days)', () => {
  it('names and numbers them Monday 1 to Sunday 7', () => {
    expect([1, 5, 7].map(weekdayPlural)).toEqual(['Mondays', 'Fridays', 'Sundays']);
    expect(['mon', 'fri', 'sun'].map(isoWeekdayOfKey)).toEqual([1, 5, 7]);
    // Fri 13 Nov 2026, Sun 25 Oct 2026 (the clock change), Mon 29 Mar 2027.
    expect(['2026-11-13', '2026-10-25', '2027-03-29'].map(isoWeekdayOf)).toEqual([5, 7, 1]);
  });

  it('finds the next date on a weekday, today included', () => {
    expect(nextDateOnWeekday('2026-11-10', 5)).toBe('2026-11-13');
    expect(nextDateOnWeekday('2026-11-13', 5)).toBe('2026-11-13');
    expect(nextDateOnWeekday('2026-11-14', 5)).toBe('2026-11-20');
    // Across the October clock change and a year end.
    expect(nextDateOnWeekday('2026-10-24', 7)).toBe('2026-10-25');
    expect(nextDateOnWeekday('2026-12-30', 1)).toBe('2027-01-04');
  });
});
