import type { ReliabilityJourney, ReliabilityTrain } from './types';

/** "Your reliability" on `/journeys`, from `GET /Journeys/reliability`
 * (2026-11-06): the trains the caller actually took, one per train leg of
 * each journey's current plan, and each finished journey's Delay Repay
 * estimate. The api already limits both to what is over and to what it
 * knows something about, and counts a booked train the railway replaced
 * (a cancellation, a missed connection) as a cancellation of its own. A
 * train the caller chose to leave, or missed themselves, isn't in it. */

/** A train in the punctuality figures: a recorded delay, or cancelled. */
export function isEligibleForPunctuality(train: ReliabilityTrain): boolean {
  return train.cancelled || train.delayMinutes !== null;
}

export interface WorstTrain {
  key: string;
  journeyId: number;
  trainUid: string | null;
  serviceDate: string;
  delayMinutes: number;
}

export interface PunctualitySummary {
  /** The trains the on-time and average figures are over (cancellations
   * excluded). */
  eligibleCount: number;
  onTimePct: number | null;
  avgDelayMinutes: number | null;
  cancelledCount: number;
  /** Of `cancelledCount`, the booked trains the railway replaced. */
  replacedCount: number;
  worstTrains: WorstTrain[];
}

/** The punctuality half. Cancellations are counted on their own, never
 * blended into the on-time and delay arithmetic ("delay rate and
 * cancellation rate are two independent axes"). "On time" is
 * `delayMinutes <= 0`, matching the badges on this page. Nothing eligible
 * gives `null`, never `NaN` dressed up as `0`. The most delayed list
 * holds only trains that were actually late. */
export function computePunctualitySummary(trains: ReliabilityTrain[]): PunctualitySummary {
  const eligible = trains.filter(isEligibleForPunctuality);
  const cancelled = eligible.filter((t) => t.cancelled);
  const forArithmetic = eligible.filter((t) => !t.cancelled && t.delayMinutes !== null);
  const delays = forArithmetic.map((t) => t.delayMinutes as number);

  const onTimePct =
    delays.length === 0 ? null : Math.round((delays.filter((d) => d <= 0).length / delays.length) * 100);
  const avgDelayMinutes = delays.length === 0 ? null : delays.reduce((sum, d) => sum + d, 0) / delays.length;

  const worstTrains: WorstTrain[] = forArithmetic
    .filter((t) => (t.delayMinutes as number) > 0)
    .sort((a, b) => {
      const delayDiff = (b.delayMinutes as number) - (a.delayMinutes as number);
      if (delayDiff !== 0) return delayDiff;
      return b.serviceDate.localeCompare(a.serviceDate);
    })
    .slice(0, 5)
    .map((t) => ({
      key: `${t.journeyId}-${t.legId ?? 'booked'}-${t.trainUid ?? ''}`,
      journeyId: t.journeyId,
      trainUid: t.trainUid,
      serviceDate: t.serviceDate,
      delayMinutes: t.delayMinutes as number,
    }));

  return {
    eligibleCount: forArithmetic.length,
    onTimePct,
    avgDelayMinutes,
    cancelledCount: cancelled.length,
    replacedCount: cancelled.filter((t) => t.replacedBecause !== null).length,
    worstTrains,
  };
}

/** Whether a journey may have qualified: an estimate in a band, or a
 * train that never got there (eligibility then depends on how the
 * traveller carried on, so the operator decides). */
export function mayHaveQualified(journey: ReliabilityJourney): boolean {
  return journey.estimate !== null || journey.outcome === 'notReached';
}

export interface DelayRepayRollup {
  /** Finished journeys with a known arrival (or a cancellation). */
  finishedCount: number;
  /** Of those, the ones that may have qualified. */
  qualifyingCount: number;
  /** `${scheme}-${bandMinutes}` (e.g. "DR15-30"): how many journeys in
   * each band actually observed. */
  bandCounts: Record<string, number>;
  /** Up to five qualifying journeys, newest first. */
  qualifying: ReliabilityJourney[];
  /** A qualifying 120-minute band whose ticket isn't known to be a single
   * or a return: the ticket type would say which applies. */
  ticketTypeWouldHelp: boolean;
}

/** The Delay Repay half: once per journey, as the api measures it (the
 * last train's delay, or the end-to-end delay against the booked plan
 * after the railway changed it). Deliberately no average percentage and
 * no money total: this app never stores ticket prices, so a percentage of
 * an unknown fare can't be added up into anything anyone can act on. */
export function computeDelayRepayRollup(journeys: ReliabilityJourney[]): DelayRepayRollup {
  const qualifying = journeys.filter(mayHaveQualified);
  const bandCounts: Record<string, number> = {};
  for (const { estimate } of qualifying) {
    if (estimate === null) continue;
    const key = `${estimate.scheme}-${estimate.bandMinutes}`;
    bandCounts[key] = (bandCounts[key] ?? 0) + 1;
  }
  return {
    finishedCount: journeys.length,
    qualifyingCount: qualifying.length,
    bandCounts,
    qualifying: qualifying.slice(0, 5),
    ticketTypeWouldHelp: qualifying.some(
      (j) => (j.estimate?.bandMinutes ?? 0) >= 120 && j.estimate?.ticketKind === 'unknown',
    ),
  };
}

/** Days after the journey most operators take a claim for (ds-api's
 * `delay_repay_rules::ClaimRule::window_days`, 28 for every scheme as of
 * 2026-11-09). Used only to stop marking old journeys, never shown as a
 * deadline. */
export const USUAL_CLAIM_WINDOW_DAYS = 28;

function dayNumber(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1) / 86_400_000;
}

/** The journeys that may qualify and finished recently enough that a claim
 * is usually still possible: what the Journeys page marks. */
export function recentPossibleClaims(journeys: ReliabilityJourney[], today: string): ReliabilityJourney[] {
  const now = dayNumber(today);
  return journeys.filter(
    (journey) => mayHaveQualified(journey) && now - dayNumber(journey.serviceDate) <= USUAL_CLAIM_WINDOW_DAYS,
  );
}
