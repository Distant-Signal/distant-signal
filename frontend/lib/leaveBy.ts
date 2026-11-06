import { formatTime } from './dateFormat';
import type { LeaveBy } from './types';

/* A regular journey's leave-by (regular journeys design §5.4): the time to
 * leave for the station, the first timed leg's booked departure less the
 * traveller's own minutes to get there. The api works it out
 * (`leaveBy`); this file only words it and tells where it stands. */

/** Where a leave-by stands at `now`: still to come (with the whole minutes
 * left, rounded up), due, or over once the train it is for has left. */
export type LeaveByPhase = { kind: 'before'; minutes: number } | { kind: 'now' } | { kind: 'gone' };

export function leaveByPhase(leaveBy: LeaveBy, now: Date): LeaveByPhase {
  const at = Date.parse(leaveBy.at);
  const departure = Date.parse(leaveBy.departure);
  const time = now.getTime();
  if (time >= departure) return { kind: 'gone' };
  if (time >= at) return { kind: 'now' };
  return { kind: 'before', minutes: Math.ceil((at - time) / 60_000) };
}

/** "in 12 min", or "in 1 h 5 min" from an hour away. */
export function minutesUntilLabel(minutes: number): string {
  if (minutes < 60) return `in ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `in ${hours} h` : `in ${hours} h ${rest} min`;
}

/** The leave-by's line: "Leave by 08:20", with the first train's expected
 * lateness ("Leave by 08:20 · train expected 6 min late"; the leave-by
 * stays put, decision 5), or the suggestion it is for ("Leave by 08:35
 * for the 08:57"). */
export function leaveByLabel(leaveBy: LeaveBy, delayMinutes: number | null = null): string {
  const base = `Leave by ${formatTime(leaveBy.at)}`;
  if (leaveBy.basis === 'suggestion') return `${base} for the ${formatTime(leaveBy.departure)}`;
  if (delayMinutes !== null && delayMinutes > 0) return `${base} · train expected ${delayMinutes} min late`;
  return base;
}
