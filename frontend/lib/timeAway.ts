import { formatDate } from './dateFormat';
import type { TimeAwayPeriod } from './types';

/** A traveller's time away (`/api/preferences/time-away`): dates none of
 * their regular journeys runs on. */

/** "10 Nov 2026", or "10 Nov 2026 to 14 Nov 2026". */
export function timeAwayDates(period: Pick<TimeAwayPeriod, 'startsOn' | 'endsOn'>): string {
  const first = formatDate(`${period.startsOn}T12:00:00Z`);
  if (period.startsOn === period.endsOn) return first;
  return `${first} to ${formatDate(`${period.endsOn}T12:00:00Z`)}`;
}

/** "Holiday: 10 Nov 2026 to 14 Nov 2026", or just the dates without a
 * name. */
export function timeAwayLabel(period: TimeAwayPeriod): string {
  const dates = timeAwayDates(period);
  return period.label ? `${period.label}: ${dates}` : dates;
}

/** "Removed 2 journeys already added for those dates.", or nothing when
 * none was. */
export function removedJourneysNote(count: number): string | null {
  if (count === 0) return null;
  return count === 1
    ? 'Removed 1 journey already added for those dates.'
    : `Removed ${count} journeys already added for those dates.`;
}
