import { formatWeekdayShortDate, londonDayKey } from './dateFormat';

/** A journey template's days, Mon = bit 0 (value 1) to Sun = bit 6 (value
 * 64): the api's `daysOfWeek` bitmask, the notifier sweep's own
 * `weekday_bit` convention. */
export const TEMPLATE_DAYS: { key: string; label: string; bit: number }[] = [
  { key: 'mon', label: 'Mon', bit: 1 },
  { key: 'tue', label: 'Tue', bit: 2 },
  { key: 'wed', label: 'Wed', bit: 4 },
  { key: 'thu', label: 'Thu', bit: 8 },
  { key: 'fri', label: 'Fri', bit: 16 },
  { key: 'sat', label: 'Sat', bit: 32 },
  { key: 'sun', label: 'Sun', bit: 64 },
];

const EVERY_DAY = 127;
const WEEKDAYS = 31;
const WEEKENDS = 96;

/** How a template's `daysOfWeek` reads on its card: "Every day",
 * "Weekdays", "Weekends", else its days ("Mon, Wed, Fri"), or "Not
 * recurring" for `null`. */
export function recurrenceSummary(daysOfWeek: number | null): string {
  if (daysOfWeek === null || daysOfWeek === 0) return 'Not recurring';
  if (daysOfWeek === EVERY_DAY) return 'Every day';
  if (daysOfWeek === WEEKDAYS) return 'Weekdays';
  if (daysOfWeek === WEEKENDS) return 'Weekends';
  return TEMPLATE_DAYS.filter((day) => (daysOfWeek & day.bit) !== 0)
    .map((day) => day.label)
    .join(', ');
}

/** "today", "tomorrow" or "Mon 9 Nov" for a template's `nextRunOn`
 * (a London date, `YYYY-MM-DD`), against `now`. */
export function nextRunLabel(nextRunOn: string, now: Date = new Date()): string {
  const today = londonDayKey(now);
  if (nextRunOn === today) return 'today';
  const tomorrow = londonDayKey(new Date(now.getTime() + 24 * 60 * 60 * 1000));
  if (nextRunOn === tomorrow) return 'tomorrow';
  // Midday UTC is the same calendar day in London all year.
  return formatWeekdayShortDate(`${nextRunOn}T12:00:00Z`);
}
