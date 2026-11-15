import { describe, expect, it } from 'vitest';
import {
  changesLabel,
  sharedJourneyPreviewCard,
  sharedJourneyPreviewImage,
  sharedJourneySummary,
  sharedJourneySummarySentences,
} from './sharedJourneyPreview';
import type { JourneyLegDetail, JourneyStop, TrackedTrainState } from './types';
import { JOURNEY_LEG_DEFAULTS, TRACKED_TRAIN_STATE_DEFAULTS } from '@/test/apiDefaults';

function stop(crs: string, overrides: Partial<JourneyStop> = {}): JourneyStop {
  return { crs, name: crs, passingPoint: false, ...overrides } as JourneyStop;
}

function trainLeg(overrides: Partial<JourneyLegDetail> = {}, state: Partial<TrackedTrainState> = {}): JourneyLegDetail {
  return {
    kind: 'train',
    ...JOURNEY_LEG_DEFAULTS,
    id: 1,
    originCrs: 'KGX',
    originName: 'London Kings Cross',
    destinationCrs: 'YRK',
    destinationName: 'York',
    serviceDate: '2026-09-22',
    trackedTrainState: {
      ...TRACKED_TRAIN_STATE_DEFAULTS,
      operatorName: 'LNER',
      operatorCode: 'GR',
      journeyStops: [
        stop('KGX', { publicDeparture: '2026-09-22T15:00:00Z', scheduledDeparture: '2026-09-22T15:00:00Z' }),
        stop('YRK', { publicArrival: '2026-09-22T17:00:00Z' }),
      ],
      ...state,
    },
    ...overrides,
  } as JourneyLegDetail;
}

describe('sharedJourneySummary', () => {
  it('is null with no legs', () => {
    expect(sharedJourneySummary([])).toBeNull();
    expect(sharedJourneyPreviewCard([])).toBeNull();
  });

  it('names the route, date, London departure time, legs and operator of a direct journey', () => {
    expect(sharedJourneySummary([trainLeg()])).toEqual({
      route: 'London Kings Cross (KGX) to York (YRK)',
      date: '22 Sep 2026',
      // 15:00Z in September is 16:00 in London.
      departure: '16:00',
      legs: '1 leg',
      changes: 'Direct',
      operators: ['LNER'],
    });
  });

  it('runs from the first leg origin to the last leg destination and counts changes', () => {
    const summary = sharedJourneySummary([
      trainLeg(),
      trainLeg({ id: 2, originCrs: 'YRK', originName: 'York', destinationCrs: 'EDB', destinationName: 'Edinburgh' }),
      trainLeg(
        { id: 3, originCrs: 'EDB', originName: 'Edinburgh', destinationCrs: 'GLC', destinationName: 'Glasgow' },
        { operatorName: 'ScotRail' },
      ),
    ]);
    expect(summary).toMatchObject({
      route: 'London Kings Cross (KGX) to Glasgow (GLC)',
      legs: '3 legs',
      changes: '2 changes',
      operators: ['LNER', 'ScotRail'],
    });
  });

  it('lists each operator once', () => {
    expect(sharedJourneySummary([trainLeg(), trainLeg({ id: 2 })])?.operators).toEqual(['LNER']);
  });

  it('leaves out the departure while no stop is timetabled, and the operator while unknown', () => {
    const summary = sharedJourneySummary([trainLeg({ trackedTrainState: null })]);
    expect(summary?.departure).toBeNull();
    expect(summary?.operators).toEqual([]);
  });

  it('ignores a passing point at the origin when finding the departure', () => {
    const summary = sharedJourneySummary([
      trainLeg(
        {},
        {
          journeyStops: [
            stop('KGX', { passingPoint: true, scheduledDeparture: '2026-09-22T10:00:00Z' }),
            stop('KGX', { publicDeparture: '2026-09-22T15:30:00Z' }),
          ],
        },
      ),
    ]);
    expect(summary?.departure).toBe('16:30');
  });

  it('uses the planned departure of an untracked first leg', () => {
    const summary = sharedJourneySummary([
      {
        ...JOURNEY_LEG_DEFAULTS,
        kind: 'untracked',
        id: 1,
        originCrs: null,
        originName: 'Heathrow Terminal 5',
        destinationCrs: null,
        destinationName: 'Paddington',
        serviceDate: '2026-09-22',
        trackedTrainState: null,
        plannedDeparture: '2026-09-22T08:05:00Z',
      },
    ]);
    expect(summary).toMatchObject({ route: 'Heathrow Terminal 5 to Paddington', departure: '09:05' });
  });
});

describe('changesLabel', () => {
  it.each([
    [1, 'Direct'],
    [2, '1 change'],
    [4, '3 changes'],
  ])('%i legs is %s', (legs, label) => {
    expect(changesLabel(legs)).toBe(label);
  });
});

describe('sharedJourneySummarySentences', () => {
  it('reads as sentences, skipping what is unknown', () => {
    const full = sharedJourneySummary([trainLeg(), trainLeg({ id: 2 }, { operatorName: 'Avanti West Coast' })])!;
    expect(sharedJourneySummarySentences(full)).toBe(
      'Departs 16:00. 2 legs, 1 change. Operated by LNER and Avanti West Coast.',
    );
    expect(sharedJourneySummarySentences({ ...full, departure: null, operators: [] })).toBe('2 legs, 1 change.');
  });
});

describe('sharedJourneyPreviewCard', () => {
  it('is a neutral band with the route, departure, operator chips and legs', () => {
    expect(sharedJourneyPreviewCard([trainLeg()])).toEqual({
      band: { tone: 'informational', label: 'Shared journey', aside: '22 Sep 2026' },
      title: 'London Kings Cross (KGX) to York (YRK)',
      lead: 'Departs 16:00',
      chips: { names: ['LNER'], more: 0 },
      rows: ['1 leg, direct'],
    });
  });

  it('carries no live status, owner name or ids', () => {
    const card = sharedJourneyPreviewCard([
      trainLeg({}, { delayMinutes: 47, status: 'en_route', lastReportedLocation: 'Peterborough', customName: 'Mum' }),
    ]);
    expect(JSON.stringify(card)).not.toMatch(/47|Peterborough|Mum|late|delay/i);
  });
});

describe('sharedJourneyPreviewImage', () => {
  it('lists the card route with a digest of the card, encoding the token', () => {
    const card = sharedJourneyPreviewCard([trainLeg()])!;
    const image = sharedJourneyPreviewImage('abc-_123', card, 'alt');
    expect(image).toMatchObject({ width: 1200, height: 630, type: 'image/png', alt: 'alt' });
    expect(image.url).toMatch(/^\/journeys\/shared\/abc-_123\/card\.png\?v=[0-9a-f]{8}$/);
    const other = sharedJourneyPreviewImage('abc-_123', { ...card, lead: 'Departs 17:00' }, 'alt');
    expect(other.url).not.toBe(image.url);
  });
});
