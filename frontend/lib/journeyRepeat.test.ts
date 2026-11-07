import { describe, expect, it } from 'vitest';
import { canPlanAgain, repeatPath, unsupportedText } from './journeyRepeat';
import { JOURNEY_LEG_DEFAULTS } from '@/test/apiDefaults';
import type { JourneyLegDetail } from './types';

function leg(overrides: Partial<JourneyLegDetail> = {}): JourneyLegDetail {
  return {
    ...JOURNEY_LEG_DEFAULTS,
    id: 1,
    kind: 'train',
    originCrs: 'WOK',
    originName: null,
    destinationCrs: 'WAT',
    destinationName: null,
    serviceDate: '2026-11-07',
    trackedTrainState: { trainUid: 'W12345' } as JourneyLegDetail['trackedTrainState'],
    ...overrides,
  };
}

describe('canPlanAgain', () => {
  it('plans GB trains again, but not an Irish train or a transit ride', () => {
    expect(canPlanAgain({ legs: [leg()] })).toBe(true);
    expect(
      canPlanAgain({
        legs: [leg({ trackedTrainState: { trainUid: 'IE:A120' } as JourneyLegDetail['trackedTrainState'] })],
      }),
    ).toBe(false);
    expect(canPlanAgain({ legs: [leg(), leg({ kind: 'untracked', transitNetwork: 'metrolink' })] })).toBe(false);
    // A train leg with no train picked yet has nothing to repeat.
    expect(canPlanAgain({ legs: [leg({ trackedTrainState: null })] })).toBe(false);
    expect(canPlanAgain({ legs: [leg({ kind: 'untracked', trackedTrainState: null }), leg()] })).toBe(true);
  });
});

describe('repeatPath', () => {
  it('asks for the booked plan, or the current one to move, with a date and a valid time', () => {
    expect(repeatPath(7, 'repeat')).toBe('/api/Journeys/7/repeat');
    expect(repeatPath(7, 'move', '2026-11-08', '08:20')).toBe(
      '/api/Journeys/7/repeat?basis=current&date=2026-11-08&time=08%3A20',
    );
    expect(repeatPath(7, 'repeat', null, '8:2')).toBe('/api/Journeys/7/repeat');
  });
});

describe('unsupportedText', () => {
  it('says why in plain words', () => {
    expect(unsupportedText('irish')).toBe("We can't plan trains in Ireland again yet.");
    expect(unsupportedText('incomplete')).toBe("We can't plan this journey again.");
  });
});
