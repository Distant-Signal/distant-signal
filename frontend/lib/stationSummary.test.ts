import { describe, it, expect } from 'vitest';
import {
  factSentences,
  parseStepFreeCategory,
  stationDescription,
  stationFacts,
  summariseTimetable,
  timetableSentences,
  type TimetableSummary,
} from './stationSummary';
import type { TrainSearchPage, TrainSearchResult } from './types';

function row(overrides: Partial<TrainSearchResult> = {}): TrainSearchResult {
  return {
    uid: 'A1',
    scheduled: '06:41',
    stationCrs: 'ACH',
    originCrs: 'KYL',
    originName: 'Kyle of Lochalsh',
    destinationCrs: 'INV',
    destinationName: 'Inverness',
    destinationArrival: '08:31',
    destinationArrivalDayOffset: 0,
    publicDeparture: '06:41',
    publicDestinationArrival: '08:31',
    workingDeparture: '06:42',
    workingDestinationArrival: '08:31',
    operator: 'SR',
    identity: '2H80',
    serviceDate: '2026-11-12',
    live: null,
    serviceMode: 'train',
    liveTracking: true,
    dayOffset: 0,
    workingDayOffset: 0,
    ...overrides,
  };
}

function page(results: TrainSearchResult[], nextCursor: string | null = null): TrainSearchPage {
  return {
    results,
    nextCursor,
    serviceDate: '2026-11-12',
    window: { from: { time: '00:00', dayOffset: 0 }, to: null, arrivalFrom: null, arrivalTo: null },
    acrossMidnight: false,
    serviceDates: ['2026-11-12'],
    provisional: false,
    provisionalFrom: '2026-11-20',
  };
}

const NAMES: Record<string, string> = { SR: 'ScotRail', SE: 'Southeastern', TL: 'Thameslink' };
const nameOf = (code: string) => NAMES[code];

describe('summariseTimetable', () => {
  it('is null when no passenger train departs', () => {
    expect(summariseTimetable(page([]), 'ACH')).toBeNull();
    expect(
      summariseTimetable(
        page([row({ serviceMode: 'replacementBus' }), row({ publicDeparture: null }), row({ scheduled: null })]),
        'ACH',
      ),
    ).toBeNull();
  });

  it('counts departures, train companies and where trains go, leaving the station itself out', () => {
    const summary = summariseTimetable(
      page([
        row({ scheduled: '06:41' }),
        row({
          scheduled: '10:36',
          destinationCrs: 'KYL',
          destinationName: 'Kyle of Lochalsh',
          originCrs: 'INV',
          originName: 'Inverness',
        }),
        row({ scheduled: '12:39', destinationCrs: 'ACH', destinationName: 'Achnashellach', originCrs: 'ACH' }),
      ]),
      'ach',
    );
    expect(summary?.trainCount).toBe(3);
    expect(summary?.truncated).toBe(false);
    expect(summary?.first.time).toBe('06:41');
    expect(summary?.last?.time).toBe('12:39');
    expect(summary?.operators).toEqual([{ code: 'SR', count: 3 }]);
    expect(summary?.destinations.map((place) => place.crs)).toEqual(['INV', 'KYL']);
    expect(summary?.origins.map((place) => place.crs)).toEqual(['INV', 'KYL']);
    expect(summary?.departures).toHaveLength(3);
  });

  it('knows no last train, and lists no departures, when the read stopped short', () => {
    const summary = summariseTimetable(page([row(), row({ scheduled: '07:00' })], 'cursor'), 'ACH');
    expect(summary?.truncated).toBe(true);
    expect(summary?.last).toBeNull();
    expect(summary?.departures).toBeNull();
  });

  it('lists no departures for a busy day', () => {
    const rows = Array.from({ length: 13 }, (_, index) => row({ uid: `U${index}` }));
    expect(summariseTimetable(page(rows), 'ACH')?.departures).toBeNull();
  });

  it('ranks places by trains, then by name', () => {
    const summary = summariseTimetable(
      page([
        row({ destinationCrs: 'BBB', destinationName: 'Bee' }),
        row({ destinationCrs: 'AAA', destinationName: 'Aye' }),
        row({ destinationCrs: 'CCC', destinationName: 'Sea' }),
        row({ destinationCrs: 'CCC', destinationName: 'Sea' }),
      ]),
      'ACH',
    );
    expect(summary?.destinations.map((place) => place.name)).toEqual(['Sea', 'Aye', 'Bee']);
  });
});

describe('timetableSentences', () => {
  function summary(overrides: Partial<TimetableSummary> = {}): TimetableSummary {
    const first = {
      time: '05:14',
      dayOffset: 0,
      destinationCrs: 'CST',
      destinationName: 'London Cannon Street',
      operator: 'SE',
    };
    return {
      date: '2026-11-12',
      trainCount: 200,
      truncated: false,
      first,
      last: { ...first, time: '23:59' },
      operators: [
        { code: 'SE', count: 143 },
        { code: 'TL', count: 57 },
      ],
      destinations: [],
      origins: [],
      departures: null,
      ...overrides,
    };
  }

  it('gives the span of the day and each train company its share', () => {
    expect(timetableSentences('Abbey Wood', summary(), nameOf)).toEqual([
      '200 trains are timetabled to leave Abbey Wood today, the first at 05:14 and the last at 23:59.',
      'Southeastern runs 143 of them and Thameslink 57.',
    ]);
  });

  it('says "more than" and "include" for a read that stopped short, with no last train', () => {
    const sentences = timetableSentences('Abbey Wood', summary({ truncated: true, last: null }), nameOf);
    expect(sentences[0]).toBe("Today's timetable lists more than 200 departures from Abbey Wood, the first at 05:14.");
    expect(sentences[1]).toBe('Train companies calling here include Southeastern and Thameslink.');
  });

  it('words a single train and a single train company differently', () => {
    const one = summary({ trainCount: 1, operators: [{ code: 'SR', count: 1 }], departures: [] });
    expect(timetableSentences('Achnashellach', one, nameOf)).toEqual([
      'Only one train is timetabled to leave Achnashellach today, at 05:14.',
      'It is run by ScotRail.',
    ]);
    const several = summary({ trainCount: 8, operators: [{ code: 'SR', count: 8 }], departures: [] });
    expect(timetableSentences('Achnashellach', several, nameOf)[1]).toBe('All of them are run by ScotRail.');
  });

  it('leaves out a train company it cannot name, and a train company sentence when none is named', () => {
    const unnamed = summary({ operators: [{ code: 'ZZ', count: 200 }] });
    expect(timetableSentences('Abbey Wood', unnamed, nameOf)).toHaveLength(1);
  });

  it('counts the train companies beyond the three it names', () => {
    const many = summary({
      operators: [
        { code: 'SE', count: 100 },
        { code: 'TL', count: 50 },
        { code: 'SR', count: 30 },
        { code: 'XX', count: 15 },
        { code: 'YY', count: 5 },
      ],
    });
    expect(timetableSentences('Abbey Wood', many, nameOf)[1]).toBe(
      'Southeastern runs 100 of them, Thameslink 50 and ScotRail 30, and 2 other train companies run the rest.',
    );
  });

  it('says a departure after midnight is after midnight', () => {
    const late = summary({ last: { ...summary().first, time: '00:20', dayOffset: 1 } });
    expect(timetableSentences('Abbey Wood', late, nameOf)[0]).toContain('the last at 00:20 after midnight');
  });
});

describe('parseStepFreeCategory', () => {
  it('reads the code and the description, writing "platform(s)" out', () => {
    expect(parseStepFreeCategory('A, Compliant step-free access to all platform(s)')).toEqual({
      code: 'A',
      description: 'compliant step-free access to all platforms',
    });
  });

  it('reads a bare or two-character code', () => {
    expect(parseStepFreeCategory('B2')).toEqual({ code: 'B2', description: null });
    expect(parseStepFreeCategory('B2, (refer to quick reference guide)')?.code).toBe('B2');
  });

  it('gives nothing for text with no leading code', () => {
    expect(parseStepFreeCategory('step free')).toBeNull();
    expect(parseStepFreeCategory('')).toBeNull();
  });
});

describe('stationFacts and factSentences', () => {
  it('reads only what is said to be there', () => {
    const facts = stationFacts({
      stationAccessibility: { stepFreeCategory: { category: 'A, Compliant step-free access to all platform(s)' } },
      platformFacilities: { numberOfPlatforms: 4 },
      lifts: { available: true },
      toiletsAndChanging: { toilets: { available: true, accessibleToiletsAvailable: true } },
      stationFacilities: { wifi: { available: false } },
      cycling: { cycleStorageAvailable: true },
      carParks: { parkingSpacesAvailable: false },
      transportLinks: { bus: { available: true }, airport: { available: false } },
    });
    expect(facts.platforms).toBe(4);
    expect(facts.stepFree?.code).toBe('A');
    expect(facts.facilities).toEqual(['lifts', 'accessible toilets', 'cycle storage', 'a bus link']);
    expect(factSentences('Abbey Wood', facts)).toEqual([
      'Abbey Wood has 4 platforms.',
      'Its step-free access category is A: compliant step-free access to all platforms.',
      'The station information lists lifts, accessible toilets, cycle storage and a bus link.',
    ]);
  });

  it('gives nothing for data with none of it, or of an unexpected shape', () => {
    const facts = stationFacts({
      stationAccessibility: 'x',
      platformFacilities: { numberOfPlatforms: 'many' },
      lifts: [],
    });
    expect(facts).toEqual({ stepFree: null, platforms: null, facilities: [] });
    expect(factSentences('X', facts)).toEqual([]);
  });

  it('says one platform in the singular', () => {
    expect(factSentences('X', { stepFree: null, platforms: 1, facilities: [] })).toEqual(['X has 1 platform.']);
  });
});

describe('stationDescription', () => {
  const heading = 'Abbey Wood (ABW)';
  const timetable: TimetableSummary = {
    date: '2026-11-12',
    trainCount: 3,
    truncated: false,
    first: { time: '05:14', dayOffset: 0, destinationCrs: 'CST', destinationName: 'X', operator: 'SE' },
    last: null,
    operators: [
      { code: 'SE', count: 2 },
      { code: 'TL', count: 1 },
    ],
    destinations: [{ crs: 'CST', name: 'London Cannon Street', count: 2 }],
    origins: [],
    departures: null,
  };

  it('keeps the generic line when the data has no facts', () => {
    expect(stationDescription(heading, null, null, nameOf)).toBe(
      'Disruption, accessibility and departures for Abbey Wood (ABW).',
    );
  });

  it('is one sentence naming the train companies, destinations and step-free category', () => {
    const description = stationDescription(
      heading,
      timetable,
      { stepFree: { code: 'A', description: null }, platforms: 4, facilities: [] },
      nameOf,
    );
    expect(description).toBe(
      'Abbey Wood (ABW): served by Southeastern and Thameslink; trains to London Cannon Street; step-free access category A; 4 platforms.',
    );
  });

  it('stays within 20 words and 160 characters, dropping the last facts first', () => {
    const long: TimetableSummary = {
      ...timetable,
      destinations: Array.from({ length: 3 }, (_, index) => ({
        crs: `A0${index}`,
        name: 'A very long destination name',
        count: 1,
      })),
    };
    const description = stationDescription(
      heading,
      long,
      { stepFree: { code: 'A', description: null }, platforms: 4, facilities: [] },
      nameOf,
    );
    expect(description.split(/\s+/).length).toBeLessThanOrEqual(20);
    expect(description.length).toBeLessThanOrEqual(160);
    expect(description).toContain('served by Southeastern and Thameslink');
    expect(description).not.toContain('platforms');
  });
});
