import { describe, expect, it } from 'vitest';
import {
  earlierTrainsBound,
  isUsualOption,
  laterTrainsBound,
  planOptionsFromQuery,
  queryOptionsFromPlan,
  regularJourneyCards,
  regularOccurrenceStarted,
  targetLabel,
  trainChoicesQuery,
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

describe('isUsualOption', () => {
  const option = (legs: [string, string][]): TripPlanItinerary => ({
    ...ITINERARY_DEFAULTS,
    changeCount: legs.length - 1,
    totalDurationMinutes: 40,
    legs: legs.map(([uid, departs]) =>
      plannedTrainLeg({
        trainUid: uid,
        serviceDate: '2026-11-10',
        originCrs: 'WOK',
        destinationCrs: 'WAT',
        scheduledDeparture: `${departs}:00`,
        scheduledArrival: '09:00:00',
      }),
    ),
  });
  const usual = usualItineraryFromPlan([option([['W12345', '07:48']])], () => undefined);

  it('matches the same trains at the same times, on any day', () => {
    expect(isUsualOption(option([['W12345', '07:48']]), usual)).toBe(true);
    const otherDay = { legs: usual.legs.map((leg) => ({ ...leg, serviceDate: '2026-12-01', trainUid: 'w12345' })) };
    expect(isUsualOption(option([['W12345', '07:48']]), otherDay)).toBe(true);
  });

  it('needs every train, in order, at its time', () => {
    expect(isUsualOption(option([['W12345', '07:49']]), usual)).toBe(false);
    expect(isUsualOption(option([['W99999', '07:48']]), usual)).toBe(false);
    expect(
      isUsualOption(
        option([
          ['W12345', '07:48'],
          ['W22222', '08:30'],
        ]),
        usual,
      ),
    ).toBe(false);
    expect(isUsualOption(option([['W12345', '07:48']]), null)).toBe(false);
    expect(isUsualOption(option([['W12345', '07:48']]), { legs: [] })).toBe(false);
  });
});

describe('laterTrainsBound and earlierTrainsBound', () => {
  const journey = (departs: string, arrives: string, dayOffset = 0) => ({
    departure: { time: `${departs}:00`, dayOffset },
    arrival: { time: `${arrives}:00`, dayOffset },
  });

  it('leave a minute after the last train shown, or arrive a minute before the first', () => {
    const shown = [journey('07:48', '08:20'), journey('08:48', '09:20')];
    expect(laterTrainsBound(shown)).toEqual({ kind: 'depart_after', time: '08:49', dayOffset: 0 });
    expect(earlierTrainsBound(shown)).toEqual({ kind: 'arrive_by', time: '08:19', dayOffset: 0 });
  });

  it('cross midnight on the service day, and stop at its ends', () => {
    expect(laterTrainsBound([journey('23:59', '00:30')])).toEqual({
      kind: 'depart_after',
      time: '00:00',
      dayOffset: 1,
    });
    expect(earlierTrainsBound([journey('23:50', '00:00', 1)])).toEqual({
      kind: 'arrive_by',
      time: '23:59',
      dayOffset: 0,
    });
    expect(earlierTrainsBound([journey('00:00', '00:00')])).toBeNull();
    expect(laterTrainsBound([journey('23:59', '23:59', 1)])).toBeNull();
    expect(laterTrainsBound([])).toBeNull();
    expect(earlierTrainsBound([])).toBeNull();
  });
});

describe('trainChoicesQuery', () => {
  const route = { originCrs: 'WOK', destinationCrs: 'WAT', date: '2099-01-05' };

  it('asks for five fastest trains on the date, with the plan options but not a preferred operator', () => {
    expect(
      trainChoicesQuery(
        route,
        { kind: 'arrive_by', time: '00:30', dayOffset: 1 },
        { maxChanges: 1, viaCrs: ['CLJ'], operatorMode: 'prefer', operators: ['SW'] },
      ),
    ).toEqual({
      ...route,
      waypointCrs: [],
      arriveBy: '00:30',
      dayOffset: 1,
      maxChanges: 1,
      viaCrs: ['CLJ'],
      results: 'fastest',
      count: 5,
    });
    expect(
      trainChoicesQuery(
        route,
        { kind: 'depart_after', time: '07:45', dayOffset: 0 },
        { operatorMode: 'only', operators: ['SW'] },
      ),
    ).toMatchObject({ departAfter: '07:45', operatorMode: 'only', operators: ['SW'], results: 'fastest', count: 5 });
  });

  it('keeps the options search for a route with stops to call at', () => {
    const query = trainChoicesQuery(
      route,
      { kind: 'depart_after', time: '07:45', dayOffset: 0 },
      { waypointCrs: ['GLD'] },
    );
    expect(query).toMatchObject({ waypointCrs: ['GLD'], results: 'options' });
    expect(query.count).toBeUndefined();
  });
});
