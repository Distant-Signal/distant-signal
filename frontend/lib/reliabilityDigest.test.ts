import { describe, it, expect } from 'vitest';
import {
  computeDelayRepayRollup,
  computePunctualitySummary,
  isEligibleForPunctuality,
  mayHaveQualified,
} from './reliabilityDigest';
import type { DelayRepayEstimate, ReliabilityJourney, ReliabilityTrain } from './types';
import {
  DELAY_REPAY_ESTIMATE_DEFAULTS,
  RELIABILITY_JOURNEY_DEFAULTS,
  RELIABILITY_TRAIN_DEFAULTS,
} from '@/test/apiDefaults';

function train(overrides: Partial<ReliabilityTrain> = {}): ReliabilityTrain {
  return {
    ...RELIABILITY_TRAIN_DEFAULTS,
    journeyId: 1,
    legId: 10,
    serviceDate: '2026-09-10',
    delayMinutes: 3,
    ...overrides,
  };
}

function journey(overrides: Partial<ReliabilityJourney> = {}): ReliabilityJourney {
  return {
    ...RELIABILITY_JOURNEY_DEFAULTS,
    journeyId: 1,
    serviceDate: '2026-09-10',
    delayMinutes: 5,
    ...overrides,
  };
}

const band30: DelayRepayEstimate = {
  ...DELAY_REPAY_ESTIMATE_DEFAULTS,
  scheme: 'DR30',
  bandMinutes: 30,
  percentage: 50,
  disclaimer: 'e',
};

describe('isEligibleForPunctuality', () => {
  it('counts a recorded delay or a cancellation, nothing else', () => {
    expect(isEligibleForPunctuality(train())).toBe(true);
    expect(isEligibleForPunctuality(train({ delayMinutes: null, cancelled: true }))).toBe(true);
    expect(isEligibleForPunctuality(train({ delayMinutes: null }))).toBe(false);
  });
});

describe('computePunctualitySummary', () => {
  it('returns no figures, never NaN, with nothing eligible', () => {
    const summary = computePunctualitySummary([]);
    expect(summary).toEqual({
      eligibleCount: 0,
      onTimePct: null,
      avgDelayMinutes: null,
      cancelledCount: 0,
      replacedCount: 0,
      worstTrains: [],
    });
  });

  it('keeps cancellations out of the on-time and delay arithmetic', () => {
    const summary = computePunctualitySummary([
      train({ delayMinutes: 0 }),
      train({ legId: 11, delayMinutes: 10 }),
      train({ legId: 12, delayMinutes: 40, cancelled: true }),
    ]);
    expect(summary.eligibleCount).toBe(2);
    expect(summary.onTimePct).toBe(50);
    expect(summary.avgDelayMinutes).toBe(5);
    expect(summary.cancelledCount).toBe(1);
  });

  it('counts a booked train the railway replaced as a cancellation of its own', () => {
    const summary = computePunctualitySummary([
      train({ delayMinutes: 7 }),
      train({ legId: null, trainUid: 'BOOKED', delayMinutes: null, cancelled: true, replacedBecause: 'cancelled' }),
    ]);
    expect(summary.cancelledCount).toBe(1);
    expect(summary.replacedCount).toBe(1);
    expect(summary.eligibleCount).toBe(1);
  });

  it('lists the five latest trains, most delayed first, linking to their journeys', () => {
    const trains = [1, 2, 3, 4, 5, 6].map((n) =>
      train({ journeyId: n, legId: n * 10, delayMinutes: n * 5, serviceDate: `2026-09-0${n}` }),
    );
    trains.push(train({ journeyId: 9, legId: 90, delayMinutes: -2 }));
    const summary = computePunctualitySummary(trains);
    expect(summary.worstTrains.map((t) => t.delayMinutes)).toEqual([30, 25, 20, 15, 10]);
    expect(summary.worstTrains[0]?.journeyId).toBe(6);
  });
});

describe('computeDelayRepayRollup', () => {
  it('counts journeys, once each, and the bands observed', () => {
    const rollup = computeDelayRepayRollup([
      journey({ journeyId: 1, delayMinutes: 35, estimate: band30 }),
      journey({ journeyId: 2, delayMinutes: 40, estimate: band30, againstBookedPlan: true }),
      journey({ journeyId: 3, delayMinutes: 2 }),
    ]);
    expect(rollup.finishedCount).toBe(3);
    expect(rollup.qualifyingCount).toBe(2);
    expect(rollup.bandCounts).toEqual({ 'DR30-30': 2 });
    expect(rollup.qualifying.map((j) => j.journeyId)).toEqual([1, 2]);
    expect(rollup.ticketTypeWouldHelp).toBe(false);
  });

  it('treats a train that never got there as possibly qualifying', () => {
    const notReached = journey({ delayMinutes: null, outcome: 'notReached' });
    expect(mayHaveQualified(notReached)).toBe(true);
    expect(computeDelayRepayRollup([notReached]).qualifyingCount).toBe(1);
  });

  it('says a ticket type would help only for a 120-minute band with an unknown ticket', () => {
    const long: DelayRepayEstimate = {
      ...DELAY_REPAY_ESTIMATE_DEFAULTS,
      scheme: 'DR15',
      bandMinutes: 120,
      percentage: 100,
      disclaimer: 'e',
    };
    expect(
      computeDelayRepayRollup([journey({ estimate: { ...long, ticketKind: 'unknown' } })]).ticketTypeWouldHelp,
    ).toBe(true);
    expect(
      computeDelayRepayRollup([journey({ estimate: { ...long, ticketKind: 'single' } })]).ticketTypeWouldHelp,
    ).toBe(false);
  });
});
