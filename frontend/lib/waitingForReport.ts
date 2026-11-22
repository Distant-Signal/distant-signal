import { londonCalendarDay, addCalendarDays } from './londonWallClock';

/** How long after its scheduled departure a train can still be "waiting
 * for its first movement report": a late or overnight train, or a feed
 * that is slow. Past this, nothing is waiting and the copy must not say it
 * is (DS-648). */
export const WAITING_MARGIN_HOURS = 12;

/** Whether "waiting for its first movement report" can still be true of a
 * matched train that has no live status: it has not long departed (or not
 * yet). From its scheduled departure plus `WAITING_MARGIN_HOURS`; with no
 * departure time, from the London service date, which stays valid through
 * the next day for a train that runs past midnight. An unparseable or
 * missing date says no, never a false "waiting". */
export function mayStillBeWaiting(
  train: { serviceDate: string; pinScheduledDeparture?: string | null | undefined },
  now: Date = new Date(),
): boolean {
  const departure = Date.parse(train.pinScheduledDeparture ?? '');
  if (!Number.isNaN(departure)) return now.getTime() < departure + WAITING_MARGIN_HOURS * 3_600_000;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(train.serviceDate)) return false;
  return train.serviceDate >= addCalendarDays(londonCalendarDay(now.toISOString()), -1);
}
