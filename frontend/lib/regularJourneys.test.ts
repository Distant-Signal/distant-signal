import { describe, expect, it } from 'vitest';
import {
  nextMatchingDate,
  planOptionsFromQuery,
  queryOptionsFromPlan,
  regularJourneyCards,
  regularOccurrenceStarted,
  targetLabel,
  usualItineraryFromPlan,
  usualTrainSummary,
} from './regularJourneys';
import type { JourneyTemplateListItem, TripPlanItinerary } from './types';
import { ITINERARY_DEFAULTS, plannedTrainLeg, TEMPLATE_TARGET_DEFAULTS } from '@/test/apiDefaults';

describe('targetLabel', () => {
  it('says leave after or arrive by, with the next day when it is', () => {
    expect(targetLabel({ kind: 'depart_after', time: '07:45:00', dayOffset: 0 })).toBe('leave after 07:45');
    expect(targetLabel({ kind: 'arrive_by', time: '00:30', dayOffset: 1 })).toBe('arrive by 00:30 the next day');
  });
});

describe('nextMatchingDate', () => {
  // Monday 9 Nov 2026.
  const monday = '2026-11-09';
  it('finds the next chosen day on or after the start', () => {
    expect(nextMatchingDate(31, null, null, monday)).toBe(monday);
    // Saturdays only.
    expect(nextMatchingDate(32, null, null, monday)).toBe('2026-11-14');
    // Weekdays, starting on a Saturday.
    expect(nextMatchingDate(31, '2026-11-14', null, monday)).toBe('2026-11-16');
  });

  it('is null past the end, or with no day chosen', () => {
    expect(nextMatchingDate(32, null, '2026-11-13', monday)).toBeNull();
    expect(nextMatchingDate(0, null, null, monday)).toBeNull();
  });
});

describe('usualItineraryFromPlan', () => {
  const itinerary: TripPlanItinerary = {
    ...ITINERARY_DEFAULTS,
    changeCount: 0,
    totalDurationMinutes: 40,
    legs: [
      plannedTrainLeg({
        trainUid: 'W12345',
        serviceDate: '2026-11-10',
        originCrs: 'WOK',
        destinationCrs: 'WAT',
        scheduledDeparture: '07:47:30',
        scheduledArrival: '08:20:00',
        publicDeparture: '07:48:00',
        publicDepartureDayOffset: 0,
        operator: 'SW',
      }),
    ],
  };

  it("keeps each train's UID, stations, operator code and public clock times", () => {
    const usual = usualItineraryFromPlan([itinerary], () => undefined);
    expect(usual.legs).toEqual([
      expect.objectContaining({
        kind: 'train',
        trainUid: 'W12345',
        serviceDate: '2026-11-10',
        atocCode: 'SW',
        originCrs: 'WOK',
        destinationCrs: 'WAT',
        departs: '07:48',
        departsDayOffset: 0,
        arrives: '08:20',
      }),
    ]);
    const names = new Map([
      ['WOK', 'Woking'],
      ['WAT', 'London Waterloo'],
    ]);
    expect(usualTrainSummary(usual, (code) => names.get(code))).toBe('07:48 Woking to London Waterloo');
  });
});

describe('plan options', () => {
  it('round-trips a search through its stored options', () => {
    const options = planOptionsFromQuery({
      originCrs: 'WOK',
      destinationCrs: 'WAT',
      waypointCrs: [],
      date: '2026-11-10',
      results: 'options',
      viaCrs: ['clj'],
      maxChanges: 1,
      operatorMode: 'avoid',
      operators: ['GW'],
    });
    expect(options).toEqual({ via: 'CLJ', maxChanges: 1, avoidOperator: 'GW' });
    expect(queryOptionsFromPlan(options)).toEqual({
      viaCrs: ['CLJ'],
      maxChanges: 1,
      operatorMode: 'avoid',
      operators: ['GW'],
    });
    expect(
      planOptionsFromQuery({
        originCrs: 'WOK',
        destinationCrs: 'WAT',
        waypointCrs: [],
        date: '2026-11-10',
        results: 'options',
      }),
    ).toBeNull();
  });
});

describe('regularJourneyCards', () => {
  const item = (id: number, pairedTemplateId: number | null): JourneyTemplateListItem => ({
    id,
    customName: null,
    createdAt: '2026-11-06T00:00:00Z',
    legCount: 1,
    firstOriginCrs: null,
    firstOriginName: null,
    lastDestinationCrs: null,
    lastDestinationName: null,
    active: true,
    daysOfWeek: 31,
    defaultMatchMode: 'manual',
    nextRunOn: null,
    hasOpenLegs: false,
    ...TEMPLATE_TARGET_DEFAULTS,
    startsOn: null,
    endsOn: null,
    pairedTemplateId,
  });

  it('puts a pair on one card, outbound first, where the first of them comes', () => {
    const cards = regularJourneyCards([item(9, null), item(8, 7), item(7, 8), item(6, 99)]);
    expect(cards.map((card) => card.map((t) => t.id))).toEqual([[9], [7, 8], [6]]);
  });
});

describe('regularOccurrenceStarted', () => {
  const now = new Date('2026-11-10T07:00:00Z');
  it('is true once a leg is past or its train is on its way', () => {
    const leg = { serviceDate: '2099-01-05', plannedDeparture: null, trackedTrainState: null };
    expect(regularOccurrenceStarted([leg], now)).toBe(false);
    expect(regularOccurrenceStarted([{ ...leg, serviceDate: '2000-01-01' }], now)).toBe(true);
    expect(regularOccurrenceStarted([{ ...leg, plannedDeparture: '2026-11-10T06:30:00Z' }], now)).toBe(true);
  });
});
