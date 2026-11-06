import { describe, it, expect } from 'vitest';
import { planDayPhrase, showsSuggestion } from './regularPlan';

describe('planDayPhrase', () => {
  it('says today, tomorrow or the date', () => {
    expect(planDayPhrase('2026-11-10', '2026-11-10')).toBe('today');
    expect(planDayPhrase('2026-11-11', '2026-11-10')).toBe('tomorrow');
    expect(planDayPhrase('2026-11-12', '2026-11-10')).toBe('on 12 Nov 2026');
  });
});

describe('showsSuggestion', () => {
  it('only for a suggestion not yet taken', () => {
    const choice = { departure: '', arrival: '', changeCount: 0, legs: [] };
    const base = { plannedAt: null, reason: 'usual' as const, alternatives: [], acceptedIndex: null };
    expect(showsSuggestion({ ...base, status: 'suggested', choice })).toBe(true);
    expect(showsSuggestion({ ...base, status: 'committed', choice })).toBe(false);
    expect(showsSuggestion({ ...base, status: 'suggested', choice: null })).toBe(false);
    expect(showsSuggestion(null)).toBe(false);
  });
});
