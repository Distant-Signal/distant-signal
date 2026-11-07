import { describe, expect, it } from 'vitest';
import { canToggle, dueDates, previewSentence, shortDateLabel, skipReasonLabel } from './upcomingDates';

describe('skip reasons', () => {
  it('names the reasons it knows, and reads any other as skipped', () => {
    expect(skipReasonLabel(null)).toBeNull();
    expect(skipReasonLabel('skipped')).toBe('Skipped');
    expect(skipReasonLabel('bank_holiday')).toBe('Bank holiday');
    // A reason a newer api sends before this page knows it.
    expect(skipReasonLabel('away')).toBe('Skipped');
    expect(skipReasonLabel('something_new')).toBe('Skipped');
  });

  it('lets only a running or a skipped date be switched', () => {
    expect(canToggle(null)).toBe(true);
    expect(canToggle('skipped')).toBe(true);
    expect(canToggle('bank_holiday')).toBe(false);
    expect(canToggle('paused')).toBe(false);
  });
});

describe('dates', () => {
  const upcoming = [
    { date: '2026-11-09', skipReason: null },
    { date: '2026-11-10', skipReason: 'skipped' as const },
    { date: '2026-11-11', skipReason: 'bank_holiday' as const },
    { date: '2026-11-12', skipReason: null },
  ];

  it('labels London dates on the clock-change days too', () => {
    expect(shortDateLabel('2026-11-09')).toBe('Mon 9 Nov');
    expect(shortDateLabel('2026-03-29')).toBe('Sun 29 Mar');
    expect(shortDateLabel('2026-10-25')).toBe('Sun 25 Oct');
  });

  it('lists the dates a journey is made for', () => {
    expect(dueDates(upcoming)).toEqual(['2026-11-09', '2026-11-12']);
  });

  it('reads a preview as one line', () => {
    expect(previewSentence(upcoming)).toBe('Mon 9 Nov, Tue 10 Nov (skipped), Wed 11 Nov (bank holiday) and Thu 12 Nov');
    expect(previewSentence(upcoming.slice(0, 1))).toBe('Mon 9 Nov');
    expect(previewSentence([])).toBe('');
  });
});
