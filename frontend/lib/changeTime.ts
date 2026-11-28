import type { ChangeTimeUpdate } from './api-types';

/** The extra minutes the Preferences page offers, in order. The api takes
 * any whole number from 0 to 30; these are the ones worth choosing. */
export const CHANGE_EXTRA_MINUTE_CHOICES: readonly number[] = [0, 5, 10, 15];

/** One choice's words: "None", "5 minutes", or "1 minute". */
export function changeExtraLabel(minutes: number): string {
  if (minutes === 0) return 'None';
  return minutes === 1 ? '1 minute' : `${minutes} minutes`;
}

/** `PUT /preferences/change-time`. Throws on a failed request; resolves
 * with the response for the caller to check. */
export function saveChangeExtraMinutes(extraMinutes: number): Promise<Response> {
  const body: ChangeTimeUpdate = { extraMinutes };
  return fetch('/api/preferences/change-time', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
