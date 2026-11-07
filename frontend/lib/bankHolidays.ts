import { formatDate } from './dateFormat';
import type { BankHolidayDivision, NextSkip } from './types';

/** Whose bank holidays a regular journey skips (regular journeys design
 * §8.3): the api's `bankHolidayDivision` values, in the order the select
 * offers them. */
export const BANK_HOLIDAY_DIVISIONS: readonly { value: BankHolidayDivision; label: string }[] = [
  { value: 'england-and-wales', label: 'England and Wales' },
  { value: 'scotland', label: 'Scotland' },
  { value: 'northern-ireland', label: 'Northern Ireland' },
];

/** The division the api reads for someone who hasn't chosen one. */
export const DEFAULT_BANK_HOLIDAY_DIVISION: BankHolidayDivision = 'england-and-wales';

/** Where the choice is made: the Preferences page's "Bank holidays". */
export const BANK_HOLIDAYS_PREFERENCES_HREF = '/account/preferences#bank-holidays-heading';

/** "England and Wales", "Scotland" or "Northern Ireland"; England and
 * Wales for `null` (not chosen). */
export function divisionLabel(division: BankHolidayDivision | null): string {
  const chosen = division ?? DEFAULT_BANK_HOLIDAY_DIVISION;
  return BANK_HOLIDAY_DIVISIONS.find((option) => option.value === chosen)?.label ?? 'England and Wales';
}

/** Narrows a select's value to a division. */
export function asDivision(value: string | null): BankHolidayDivision | null {
  return BANK_HOLIDAY_DIVISIONS.find((option) => option.value === value)?.value ?? null;
}

/** Why the next date isn't sooner, for the list card: "31 May 2027 is a
 * bank holiday", or "18 Apr 2025 and 21 Apr 2025 are bank holidays".
 * Only the bank holidays: a date skipped by hand is the traveller's own
 * doing. `null` when none was passed over. */
export function bankHolidayNote(skips: readonly NextSkip[]): string | null {
  const dates = skips
    .filter((skip) => skip.reason === 'bank_holiday')
    .map((skip) => formatDate(`${skip.date}T12:00:00Z`));
  if (dates.length === 0) return null;
  if (dates.length === 1) return `${dates[0]} is a bank holiday`;
  const last = dates[dates.length - 1];
  return `${dates.slice(0, -1).join(', ')} and ${last} are bank holidays`;
}

/** `PUT /preferences/bank-holiday-division`. Throws on a failed request;
 * resolves with the response for the caller to check. */
export function saveBankHolidayDivision(division: BankHolidayDivision | null): Promise<Response> {
  return fetch('/api/preferences/bank-holiday-division', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ division }),
  });
}
