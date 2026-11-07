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

/** A regular journey's pattern (R2): the fields `recurrenceSummary` needs
 * beyond its days. */
export interface TemplatePattern {
  daysOfWeek: number | null;
  /** `weekly`, `dates`, or a kind this page doesn't know yet. */
  recurrenceKind: string;
  intervalWeeks: number;
  extraDates: readonly string[];
}

/** "every other week", "every 3 weeks", or nothing for every week. */
function intervalWords(intervalWeeks: number): string | null {
  if (intervalWeeks <= 1) return null;
  if (intervalWeeks === 2) return 'every other week';
  return `every ${intervalWeeks} weeks`;
}

/** How a regular journey's pattern reads on its card: "Mon, Wed, every
 * other week", "Weekdays, and 2 more dates", "On 3 dates", or for a kind
 * this page doesn't know, "On set dates" (its next dates say which). */
export function patternSummary(pattern: TemplatePattern): string {
  const extra = pattern.extraDates.length;
  if (pattern.recurrenceKind === 'dates') {
    return extra === 1 ? 'On 1 date' : `On ${extra} dates`;
  }
  if (pattern.recurrenceKind !== 'weekly') return 'On set dates';
  if (pattern.daysOfWeek === null || pattern.daysOfWeek === 0) {
    if (extra === 0) return 'Not recurring';
    return extra === 1 ? 'On 1 date' : `On ${extra} dates`;
  }
  const parts = [recurrenceSummary(pattern.daysOfWeek)];
  const interval = intervalWords(pattern.intervalWeeks);
  if (interval) parts.push(interval);
  if (extra > 0) parts.push(extra === 1 ? 'and 1 more date' : `and ${extra} more dates`);
  return parts.join(', ');
}

/** Whether a regular journey runs on its own (its days, or dates of its
 * own), so it has next dates, "Skip next" and "Pause". A saved route with
 * neither only runs when you add a date. */
export function runsByItself(pattern: TemplatePattern): boolean {
  if (pattern.recurrenceKind !== 'weekly') return true;
  return (pattern.daysOfWeek !== null && pattern.daysOfWeek !== 0) || pattern.extraDates.length > 0;
}

/** "Mondays" to "Sundays" for an ISO weekday, 1 Monday to 7 Sunday (a
 * day override's `weekday`, R3; not `daysOfWeek`'s bits). */
export function weekdayPlural(weekday: number): string {
  return (
    ['Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays', 'Sundays'][weekday - 1] ?? 'Sundays'
  );
}

/** The ISO weekday (1 Monday to 7 Sunday) of a `TEMPLATE_DAYS` key. */
export function isoWeekdayOfKey(key: string): number {
  return TEMPLATE_DAYS.findIndex((day) => day.key === key) + 1;
}

/** The ISO weekday of a London date (`YYYY-MM-DD`). */
export function isoWeekdayOf(date: string): number {
  // Midday UTC is the same calendar day in London all year.
  return ((new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7) + 1;
}

/** The first date on or after `from` (`YYYY-MM-DD`) that falls on ISO
 * weekday `weekday`. */
export function nextDateOnWeekday(from: string, weekday: number): string {
  const ahead = (weekday - isoWeekdayOf(from) + 7) % 7;
  const day = new Date(`${from}T12:00:00Z`);
  day.setUTCDate(day.getUTCDate() + ahead);
  return day.toISOString().slice(0, 10);
}
