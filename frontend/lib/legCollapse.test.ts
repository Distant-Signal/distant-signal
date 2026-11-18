import { describe, expect, it } from 'vitest';
import {
  collapsedLegsLabel,
  groupCollapsibleLegs,
  isInertTransfer,
  isInertWalkLeg,
  journeyCollapsedLabel,
  transferRunLabel,
} from './legCollapse';
import { testLegId } from '@/test/apiDefaults';
import { trainLeg, untrackedLeg } from '@/test/journeyFixtures';
import { TUBE_LEG, WALK_TO_TRAM } from '@/test/transitPlanFixtures';
import type { JourneyLegDetail, TripPlanLeg } from './types';

const walk = (id: number, overrides: Partial<JourneyLegDetail> = {}) =>
  untrackedLeg(id, 'Euston', 'Kings Cross', '2026-09-17T08:00:00Z', '2026-09-17T08:06:00Z', {
    transitMode: 'walk',
    lineName: null,
    ...overrides,
  });

describe('groupCollapsibleLegs', () => {
  const isWalk = (leg: string) => leg.startsWith('w');

  it('is empty for no legs', () => {
    expect(groupCollapsibleLegs([], isWalk)).toEqual([]);
  });

  it('folds a run between two trains into one group', () => {
    expect(groupCollapsibleLegs(['t1', 'w1', 'w2', 't2'], isWalk)).toEqual([
      { kind: 'leg', leg: 't1', index: 0 },
      { kind: 'collapsed', legs: ['w1', 'w2'], startIndex: 1 },
      { kind: 'leg', leg: 't2', index: 3 },
    ]);
  });

  it('folds a leading and a trailing run', () => {
    expect(groupCollapsibleLegs(['w1', 't1', 'w2'], isWalk)).toEqual([
      { kind: 'collapsed', legs: ['w1'], startIndex: 0 },
      { kind: 'leg', leg: 't1', index: 1 },
      { kind: 'collapsed', legs: ['w2'], startIndex: 2 },
    ]);
  });

  it('keeps runs apart when a leg to show lies between them', () => {
    const groups = groupCollapsibleLegs(['t1', 'w1', 'x', 'w2', 't2'], (leg) => isWalk(leg));
    expect(groups.map((group) => group.kind)).toEqual(['leg', 'collapsed', 'leg', 'collapsed', 'leg']);
  });

  it('never folds a list of nothing but collapsible legs', () => {
    expect(groupCollapsibleLegs(['w1', 'w2'], isWalk)).toEqual([
      { kind: 'leg', leg: 'w1', index: 0 },
      { kind: 'leg', leg: 'w2', index: 1 },
    ]);
  });

  it('passes each leg its position', () => {
    const seen: number[] = [];
    groupCollapsibleLegs(['a', 'b'], (_leg, index) => {
      seen.push(index);
      return false;
    });
    expect(seen).toEqual([0, 1]);
  });
});

describe('isInertWalkLeg', () => {
  it('folds a plain walk and a plain transfer', () => {
    expect(isInertWalkLeg(walk(1))).toBe(true);
    expect(isInertWalkLeg(walk(1, { transitMode: 'transfer' }))).toBe(true);
  });

  it('keeps train legs, open window legs and every ride', () => {
    expect(
      isInertWalkLeg(
        trainLeg(1, ['KGX', 'Kings Cross'], ['YRK', 'York'], '2026-09-17T07:00:00Z', '2026-09-17T09:00:00Z'),
      ),
    ).toBe(false);
    expect(isInertWalkLeg(walk(1, { kind: 'train', trackedTrainState: null }))).toBe(false);
    for (const mode of ['tube', 'bus', 'tram', 'dlr', 'ferry', 'taxi', 'cycle', 'rail', 'other'] as const) {
      expect(isInertWalkLeg(walk(1, { transitMode: mode }))).toBe(false);
    }
  });

  it('keeps a walk with a ticket, a claim, a timetable or underway', () => {
    expect(isInertWalkLeg(walk(1, { ticket: {} as JourneyLegDetail['ticket'] }))).toBe(false);
    expect(isInertWalkLeg(walk(1, { delayRepay: {} as JourneyLegDetail['delayRepay'] }))).toBe(false);
    expect(isInertWalkLeg(walk(1, { timetable: {} as NonNullable<JourneyLegDetail['timetable']> }))).toBe(false);
    expect(isInertWalkLeg(walk(1, { untrackedStatus: 'inProgress' }))).toBe(false);
    expect(isInertWalkLeg(walk(1, { untrackedStatus: 'done' }))).toBe(true);
  });

  it("keeps the open break's trigger leg, by opaque or numeric id", () => {
    expect(isInertWalkLeg(walk(4), { triggerLegId: 4, triggerLegPublicId: testLegId(4) })).toBe(false);
    expect(isInertWalkLeg(walk(4), { triggerLegId: 4, triggerLegPublicId: null })).toBe(false);
    expect(isInertWalkLeg(walk(4), { triggerLegId: 9, triggerLegPublicId: testLegId(9) })).toBe(true);
  });
});

describe('collapsedLegsLabel', () => {
  it('says the mode, the place and the minutes', () => {
    expect(collapsedLegsLabel({ modes: ['walk'], to: 'Victoria', minutes: 6 })).toBe('Walk to Victoria, 6 min');
    expect(collapsedLegsLabel({ modes: ['transfer'], to: 'Victoria', minutes: 5 })).toBe('Transfer to Victoria, 5 min');
    expect(collapsedLegsLabel({ modes: ['walk', 'transfer'], to: null, minutes: null })).toBe('Walk and transfer');
  });
});

describe('journeyCollapsedLabel', () => {
  it('adds a run up and names where it ends', () => {
    const first = walk(1, { destinationName: 'Euston Square', plannedArrival: '2026-09-17T08:04:00Z' });
    const second = walk(2, {
      originName: 'Euston Square',
      destinationName: 'Kings Cross',
      plannedDeparture: '2026-09-17T08:04:00Z',
      plannedArrival: '2026-09-17T08:10:00Z',
    });
    expect(journeyCollapsedLabel([first, second])).toBe('Walk to Kings Cross, 10 min');
  });

  it('leaves the minutes out when a leg has no times', () => {
    expect(journeyCollapsedLabel([walk(1, { plannedArrival: null })])).toBe('Walk to Kings Cross');
  });
});

describe('isInertTransfer and transferRunLabel', () => {
  const change: TripPlanLeg = {
    kind: 'transfer',
    mode: 'TRANSFER',
    originCrs: 'EUS',
    destinationCrs: 'EUS',
    minutes: 4,
  };
  const names = new Map([['EUS', 'London Euston']]);

  it('folds walks and plain transfers only', () => {
    expect(isInertTransfer(WALK_TO_TRAM)).toBe(true);
    expect(isInertTransfer(change)).toBe(true);
    expect(isInertTransfer(TUBE_LEG)).toBe(false);
    expect(isInertTransfer({ ...WALK_TO_TRAM, access: {} as never })).toBe(false);
  });

  it('labels a run with its total and the station it reaches', () => {
    expect(transferRunLabel([change], names)).toBe('Transfer to London Euston, 4 min');
    expect(transferRunLabel([WALK_TO_TRAM], names)).toBe('Walk to Piccadilly tram stop, 6 min');
    expect(transferRunLabel([{ ...WALK_TO_TRAM, destinationCrs: 'EUS' }, change], names)).toBe(
      'Walk and transfer to London Euston, 10 min',
    );
  });
});
