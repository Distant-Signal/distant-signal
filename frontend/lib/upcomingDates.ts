import { formatDate, formatWeekdayShortDate } from './dateFormat';
import type { UpcomingDate } from './types';

/** A regular journey's next dates (`upcomingDates`, `POST
 * /JourneyTemplates/preview-dates`): the api decides them with the same
 * rule the evening mint uses, so the page never keeps its own copy. */

/** A skip reason as the api sends it (`NextSkipReason` today). The api
 * may add reasons (time away, a pause) before this page knows them, so any
 * string is accepted and an unknown one reads as plain "Skipped". */
export type SkipReason = string;

/** "Skipped", "Bank holiday", or "Skipped" for a reason this page doesn't
 * know yet. `null` (the date runs) has no label. */
export function skipReasonLabel(reason: SkipReason | null): string | null {
  if (reason === null) return null;
  if (reason === 'bank_holiday') return 'Bank holiday';
  return 'Skipped';
}

/** Whether the strip can switch a date on or off: a date that runs can be
 * skipped, and a date the user skipped can be put back. A bank holiday,
 * or a reason this page doesn't know, is decided elsewhere. */
export function canToggle(reason: SkipReason | null): boolean {
  return reason === null || reason === 'skipped';
}

/** "Mon 9 Nov" for a London date (`YYYY-MM-DD`). Midday UTC is the same
 * calendar day in London all year. */
export function shortDateLabel(date: string): string {
  return formatWeekdayShortDate(`${date}T12:00:00Z`);
}

/** "9 Nov 2026" for a London date (`YYYY-MM-DD`). */
export function longDateLabel(date: string): string {
  return formatDate(`${date}T12:00:00Z`);
}

/** The dates of `upcoming` a journey is made for, in order. */
export function dueDates(upcoming: readonly UpcomingDate[]): string[] {
  return upcoming.filter((day) => day.skipReason === null).map((day) => day.date);
}

/** "Mon 9 Nov, Tue 10 Nov (bank holiday) and Wed 11 Nov": a preview's
 * dates in one line. */
export function previewSentence(upcoming: readonly UpcomingDate[]): string {
  const parts = upcoming.map((day) => {
    const label = skipReasonLabel(day.skipReason);
    return label ? `${shortDateLabel(day.date)} (${label.toLowerCase()})` : shortDateLabel(day.date);
  });
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}
