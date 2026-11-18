import { describe, it, expect } from 'vitest';
import { mergeSharedTrains } from './sharedTrains';
import type { SharedGroupTrain } from './types';
import { GROUP_TRAIN_DEFAULTS, testTrackingId } from '@/test/apiDefaults';
import { ID_SHAPES } from '@/test/zeroNumericIds';

function sharedTrain(overrides: Partial<SharedGroupTrain> = {}): SharedGroupTrain {
  return {
    ...GROUP_TRAIN_DEFAULTS,
    groupId: 'group-1',
    groupName: 'Family',
    trainSubscriptionId: 1,
    pinOriginCrs: 'WAT',
    pinDestinationCrs: 'WOK',
    pinOriginName: null,
    pinDestinationName: null,
    pinScheduledDeparture: '2026-08-31T18:32:00Z',
    serviceDate: '2026-08-31',
    resolutionStatus: 'resolved',
    trainUid: 'C21373',
    status: 'en_route',
    delayMinutes: null,
    customName: null,
    addedBy: null,
    addedByMemberId: 'member-2',
    addedByIsMe: false,
    addedByName: 'Sam',
    addedByTag: null,
    ...overrides,
    trainSubscriptionPublicId: testTrackingId(overrides.trainSubscriptionId ?? 1),
  };
}

describe.each(ID_SHAPES)('mergeSharedTrains (%s)', (_name, shape) => {
  const merge = (rows: SharedGroupTrain[], own: ReadonlySet<string> = new Set()) => mergeSharedTrains(shape(rows), own);
  const refs = (merged: ReturnType<typeof mergeSharedTrains>) =>
    merged.map((row) => row.train.trainSubscriptionPublicId);

  it('keeps one row per train, in the order the API returned them', () => {
    const merged = merge([sharedTrain({ trainSubscriptionId: 7 }), sharedTrain({ trainSubscriptionId: 3 })]);
    expect(refs(merged)).toEqual([testTrackingId(7), testTrackingId(3)]);
    expect(merged.map((row) => row.groupNames)).toEqual([['Family'], ['Family']]);
  });

  it('a train shared into two of the caller’s groups collapses into one row carrying both group names', () => {
    const merged = merge([
      sharedTrain({ trainSubscriptionId: 7, groupId: 'g1', groupName: 'Family' }),
      sharedTrain({ trainSubscriptionId: 7, groupId: 'g2', groupName: 'Commuters' }),
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.groupNames).toEqual(['Family', 'Commuters']);
  });

  it('two different groups that happen to share a name are tagged once, not twice', () => {
    const merged = merge([
      sharedTrain({ trainSubscriptionId: 7, groupId: 'g1', groupName: 'Family' }),
      sharedTrain({ trainSubscriptionId: 7, groupId: 'g2', groupName: 'Family' }),
    ]);
    expect(merged[0]!.groupNames).toEqual(['Family']);
  });

  it('drops any row for a train the caller already tracks themselves (belt-and-braces against the backend filter)', () => {
    const merged = merge(
      [sharedTrain({ trainSubscriptionId: 7 }), sharedTrain({ trainSubscriptionId: 8 })],
      new Set([testTrackingId(7)]),
    );
    expect(refs(merged)).toEqual([testTrackingId(8)]);
  });

  it('no shared trains at all is an empty list, not a throw', () => {
    expect(merge([])).toEqual([]);
  });

  it('keeps the first row’s train fields verbatim (they describe the same subscription)', () => {
    const merged = merge([
      sharedTrain({ trainSubscriptionId: 7, customName: 'School run', groupName: 'Family' }),
      sharedTrain({ trainSubscriptionId: 7, customName: 'School run', groupName: 'Commuters' }),
    ]);
    expect(merged[0]!.train.customName).toBe('School run');
    expect(merged[0]!.train.addedByName).toBe('Sam');
  });
});
