import { describe, it, expect } from 'vitest';
import { splitJourneyTrains } from './journeyTrains';
import { ID_SHAPES } from '@/test/zeroNumericIds';
import { testPublicId, testTrackingId } from '@/test/apiDefaults';
import type { JourneyListItem, TrackedTrainListItem } from './types';
import { JOURNEY_LIST_ITEM_DEFAULTS, TRACKED_TRAIN_LIST_ITEM_DEFAULTS } from '@/test/apiDefaults';

function train(id: number, journeyIds: number[]): TrackedTrainListItem {
  return {
    ...TRACKED_TRAIN_LIST_ITEM_DEFAULTS,
    id,
    serviceDate: '2026-09-22',
    pinOriginCrs: 'KGX',
    pinDestinationCrs: 'YRK',
    pinOriginName: null,
    pinDestinationName: null,
    pinScheduledDeparture: null,
    resolutionStatus: 'resolved',
    trainUid: null,
    status: null,
    delayMinutes: null,
    trackedAt: '2026-09-21T12:00:00Z',
    customName: null,
    sharedGroupCount: 0,
    publicId: testTrackingId(id),
    journeyIds,
    journeyPublicIds: journeyIds.map(testPublicId),
  };
}

function journey(id: number, trainSubscriptionId: number | null = null): JourneyListItem {
  return {
    ...JOURNEY_LIST_ITEM_DEFAULTS,
    id,
    publicId: testPublicId(id),
    customName: null,
    createdAt: '2026-09-21T12:00:00Z',
    legId: id * 10,
    legPublicId: `l_${id}`,
    originCrs: 'KGX',
    destinationCrs: 'EDB',
    serviceDate: '2026-09-22',
    firstServiceDate: '2026-09-22',
    originName: null,
    destinationName: null,
    matchMode: 'manual',
    trainSubscriptionId,
    resolutionStatus: null,
    status: null,
    delayMinutes: null,
  };
}

describe.each(ID_SHAPES)('splitJourneyTrains (%s)', (_name, shape) => {
  const ownedBy = (trains: TrackedTrainListItem[], journeys: JourneyListItem[] | null) =>
    splitJourneyTrains(shape(trains), journeys === null ? null : shape(journeys));
  const ref = (id: number) => testTrackingId(id);

  it("folds every leg's train into its journey, whichever leg is current", () => {
    const split = ownedBy([train(1, [100]), train(2, [100]), train(3, [100]), train(4, [])], [journey(100, 1)]);
    expect(split.standalone.map((t) => t.publicId)).toEqual([ref(4)]);
    expect(split.trainRefsByJourney.get(testPublicId(100))).toEqual([ref(1), ref(2), ref(3)]);
  });

  it('puts a train in two journeys under one of them only, the first listed in journeyIds', () => {
    const split = ownedBy([train(1, [100, 200])], [journey(200), journey(100)]);
    expect(split.standalone).toEqual([]);
    expect(split.trainRefsByJourney.get(testPublicId(100))).toEqual([ref(1)]);
    expect(split.trainRefsByJourney.has(testPublicId(200))).toBe(false);
  });

  it('keeps a train standalone when its journey is not listed', () => {
    const split = ownedBy([train(1, [300])], [journey(100)]);
    expect(split.standalone.map((t) => t.publicId)).toEqual([ref(1)]);
  });

  it('folds nothing when the journeys fetch failed', () => {
    const split = ownedBy([train(1, [100])], null);
    expect(split.standalone.map((t) => t.publicId)).toEqual([ref(1)]);
    expect(split.trainRefsByJourney.size).toBe(0);
  });
});
