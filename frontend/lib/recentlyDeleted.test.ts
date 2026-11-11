import { describe, expect, it } from 'vitest';
import { deletedLine, restoreNotes } from './recentlyDeleted';
import type { RecentlyDeletedJourney } from './types';

const item: RecentlyDeletedJourney = {
  id: 1,
  journeyId: 42,
  client: 'web',
  deletedAt: '2026-11-09T09:00:00Z',
  expiresAt: '2026-11-16T09:00:00Z',
  summary: { customName: null, legs: [] },
};

describe('deletedLine', () => {
  it('says how long ago the visitor deleted it', () => {
    expect(deletedLine(item, new Date('2026-11-11T10:00:00Z'))).toBe('Deleted 2 days ago.');
    expect(deletedLine(item, new Date('2026-11-09T12:00:00Z'))).toBe('Deleted 3 hr ago.');
  });

  it('says a connected app deleted it', () => {
    expect(deletedLine({ ...item, client: 'ds-mcp' }, new Date('2026-11-10T09:00:00Z'))).toBe(
      'Deleted by a connected app 1 day ago.',
    );
  });
});

describe('restoreNotes', () => {
  it('says nothing of legs that came back as they were', () => {
    expect(
      restoreNotes([
        { leg: 1, outcome: 'tracked' },
        { leg: 2, outcome: 'untracked' },
      ]),
    ).toEqual([]);
  });

  it('names each leg that needs a train picked, and why', () => {
    expect(
      restoreNotes([
        { leg: 1, outcome: 'without_train', reason: 'train_gone' },
        { leg: 2, outcome: 'without_train', reason: 'train_changed' },
        { leg: 3, outcome: 'without_train', reason: 'too_far_ahead' },
        { leg: 4, outcome: 'without_train', reason: 'no_train' },
      ]),
    ).toEqual([
      "Leg 1's train is no longer available, so pick a train for it.",
      "Leg 2's train no longer stops at those stations, so pick another.",
      "Leg 3's train is too far ahead to track yet, so pick it nearer the day.",
      'Leg 4 has no train yet, so pick one.',
    ]);
  });

  it('names each leg left out', () => {
    expect(
      restoreNotes([
        { leg: 2, outcome: 'left_out', reason: 'too_old' },
        { leg: 3, outcome: 'left_out', reason: 'incomplete' },
      ]),
    ).toEqual([
      'Leg 2 was more than a week ago, so it was left out.',
      "Leg 3 couldn't be saved again, so it was left out.",
    ]);
  });
});
