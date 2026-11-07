import { describe, expect, it } from 'vitest';
import { removedJourneysNote, timeAwayDates, timeAwayLabel } from './timeAway';

describe('time away', () => {
  it('names the dates, one day or several, with the name first', () => {
    expect(timeAwayDates({ startsOn: '2026-12-21', endsOn: '2026-12-21' })).toBe('21 Dec 2026');
    expect(timeAwayLabel({ id: 1, startsOn: '2026-12-21', endsOn: '2027-01-02', label: 'Christmas' })).toBe(
      'Christmas: 21 Dec 2026 to 2 Jan 2027',
    );
    expect(timeAwayLabel({ id: 1, startsOn: '2026-10-25', endsOn: '2026-10-25', label: null })).toBe('25 Oct 2026');
  });

  it('counts the journeys removed', () => {
    expect(removedJourneysNote(0)).toBeNull();
    expect(removedJourneysNote(1)).toBe('Removed 1 journey already added for those dates.');
    expect(removedJourneysNote(3)).toBe('Removed 3 journeys already added for those dates.');
  });
});
