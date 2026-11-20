import { describe, expect, it } from 'vitest';
import {
  breakRef,
  deletedCount,
  deletionRef,
  isLegacyId,
  isPublicBreakId,
  isPublicDeletionId,
  isPublicTemplateId,
  isPublicTimeAwayId,
  isPublicTokenId,
  isPublicTrackingId,
  isPublicWebhookId,
  isTriggerLeg,
  legRef,
  matchesBreakParam,
  optionalTemplateRef,
  publicRef,
  templateRef,
  timeAwayRef,
  tokenRef,
  trackingRef,
  webhookRef,
} from './publicId';
import {
  testBreakId,
  testDeletionId,
  testDeviceId,
  testLegId,
  testTemplateId,
  testTimeAwayId,
  testTokenId,
  testTrackingId,
  testWebhookId,
} from '@/test/apiDefaults';

describe('isPublicTrackingId', () => {
  it('takes t_ and 32 lowercase hex digits only', () => {
    expect(isPublicTrackingId(testTrackingId(42))).toBe(true);
    expect(isPublicTrackingId(testLegId(42))).toBe(false);
    expect(isPublicTrackingId(testDeviceId(42))).toBe(false);
    expect(isPublicTrackingId('t_' + 'A'.repeat(32))).toBe(false);
    expect(isPublicTrackingId('t_' + 'a'.repeat(31))).toBe(false);
    expect(isPublicTrackingId('42')).toBe(false);
    expect(isPublicTrackingId('')).toBe(false);
  });
});

describe('isLegacyId', () => {
  it('is all digits', () => {
    expect(isLegacyId('42')).toBe(true);
    expect(isLegacyId('4x2')).toBe(false);
    expect(isLegacyId('')).toBe(false);
    expect(isLegacyId(testTrackingId(42))).toBe(false);
  });
});

describe('publicRef', () => {
  it('sends the opaque id, and the numeric one only where the api returned none', () => {
    expect(publicRef(testLegId(5), 5)).toBe(testLegId(5));
    expect(publicRef('', 5)).toBe('5');
    expect(publicRef(null, 5)).toBe('5');
    expect(publicRef(undefined, 5)).toBe('5');
  });

  it('names legs and tracked trains by their opaque id', () => {
    expect(legRef({ id: 3, publicId: testLegId(3) })).toBe(testLegId(3));
    expect(legRef({ id: 3, publicId: '' })).toBe('3');
    expect(trackingRef({ id: 9, publicId: testTrackingId(9) })).toBe(testTrackingId(9));
    expect(trackingRef({ id: 9, publicId: '' })).toBe('9');
  });
});

describe('isTriggerLeg', () => {
  const leg = { id: 3, publicId: testLegId(3) };

  it('matches by the opaque id when the break has one', () => {
    expect(isTriggerLeg(leg, { triggerLegId: 99, triggerLegPublicId: testLegId(3) })).toBe(true);
    expect(isTriggerLeg(leg, { triggerLegId: 3, triggerLegPublicId: testLegId(4) })).toBe(false);
  });

  it('falls back to the numeric id for a break stored before the opaque ids', () => {
    expect(isTriggerLeg(leg, { triggerLegId: 3, triggerLegPublicId: '' })).toBe(true);
    expect(isTriggerLeg(leg, { triggerLegId: 3, triggerLegPublicId: null })).toBe(true);
    expect(isTriggerLeg(leg, { triggerLegId: 4, triggerLegPublicId: null })).toBe(false);
    expect(isTriggerLeg(leg, { triggerLegId: null, triggerLegPublicId: null })).toBe(false);
  });
});

describe('isPublicTemplateId and isPublicBreakId', () => {
  it('take their own prefix and 32 lowercase hex digits only', () => {
    expect(isPublicTemplateId(testTemplateId(42))).toBe(true);
    expect(isPublicTemplateId(testBreakId(42))).toBe(false);
    expect(isPublicTemplateId('r_' + 'A'.repeat(32))).toBe(false);
    expect(isPublicTemplateId('42')).toBe(false);
    expect(isPublicBreakId(testBreakId(42))).toBe(true);
    expect(isPublicBreakId(testTemplateId(42))).toBe(false);
    expect(isPublicBreakId('b_' + 'a'.repeat(31))).toBe(false);
    expect(isPublicBreakId('')).toBe(false);
  });
});

describe('templateRef and optionalTemplateRef', () => {
  it('prefers the r_ id and falls back to the numeric one, never "undefined"', () => {
    expect(templateRef({ id: 7, publicId: testTemplateId(7) })).toBe(testTemplateId(7));
    expect(templateRef({ id: 7, publicId: '' })).toBe('7');
    expect(templateRef({ id: 7 })).toBe('7');
    expect(optionalTemplateRef(testTemplateId(7), 7)).toBe(testTemplateId(7));
    expect(optionalTemplateRef(undefined, 7)).toBe('7');
    expect(optionalTemplateRef(null, 7)).toBe('7');
    expect(optionalTemplateRef(null, null)).toBeNull();
    expect(optionalTemplateRef(testTemplateId(7), null)).toBe(testTemplateId(7));
  });
});

describe('breakRef', () => {
  it('prefers the b_ id, then a real numeric id, never 0', () => {
    expect(breakRef({ id: 5, publicId: testBreakId(5) })).toBe(testBreakId(5));
    expect(breakRef({ id: 0, publicId: testBreakId(5) })).toBe(testBreakId(5));
    expect(breakRef({ id: 5, publicId: '' })).toBe('5');
    expect(breakRef({ id: 5 })).toBe('5');
    expect(breakRef({ id: 0, publicId: '' })).toBeNull();
    expect(breakRef({ id: 0 })).toBeNull();
  });
});

describe('the x_, k_, w_ and a_ guards', () => {
  const guards = [
    ['x_', isPublicDeletionId, testDeletionId],
    ['k_', isPublicTokenId, testTokenId],
    ['w_', isPublicWebhookId, testWebhookId],
    ['a_', isPublicTimeAwayId, testTimeAwayId],
  ] as const;

  it.each(guards)('%s accepts its own shape only', (prefix, guard, make) => {
    expect(guard(make(42))).toBe(true);
    expect(guard('7')).toBe(false);
    expect(guard('')).toBe(false);
    expect(guard(`${prefix}${'a'.repeat(31)}`)).toBe(false);
    expect(guard(`${prefix}${'A'.repeat(32)}`)).toBe(false);
    for (const [other, , makeOther] of guards) {
      if (other !== prefix) expect(guard(makeOther(42))).toBe(false);
    }
  });
});

describe('deletionRef, tokenRef, webhookRef and timeAwayRef', () => {
  it.each([
    ['deletionRef', deletionRef, testDeletionId],
    ['tokenRef', tokenRef, testTokenId],
    ['webhookRef', webhookRef, testWebhookId],
    ['timeAwayRef', timeAwayRef, testTimeAwayId],
  ] as const)('%s is the opaque id, the numeric one only where there is none', (_name, ref, make) => {
    expect(ref({ id: 7, publicId: make(7) })).toBe(make(7));
    expect(ref({ id: 0, publicId: make(7) })).toBe(make(7));
    expect(ref({ id: 7, publicId: '' })).toBe('7');
    expect(ref({ id: 7, publicId: null })).toBe('7');
    expect(ref({ id: 7 })).toBe('7');
  });
});

describe('deletedCount', () => {
  it('reads the count, even a zero beside ids', () => {
    expect(deletedCount({ deletedJourneyCount: 3, deletedJourneyIds: [1] })).toBe(3);
    expect(deletedCount({ deletedJourneyCount: 0, deletedJourneyIds: [1, 2] })).toBe(0);
  });
  it('falls back to the ids of an older api, and to none', () => {
    expect(deletedCount({ deletedJourneyIds: [0, 0] })).toBe(2);
    expect(deletedCount({ deletedJourneyCount: null, deletedJourneyIds: [4] })).toBe(1);
    expect(deletedCount({})).toBe(0);
  });
});

describe('matchesBreakParam', () => {
  const open = { id: 5, publicId: testBreakId(5) };
  it('matches the b_ id and the numeric id of a push queued earlier', () => {
    expect(matchesBreakParam(testBreakId(5), open)).toBe(true);
    expect(matchesBreakParam('5', open)).toBe(true);
    expect(matchesBreakParam('6', open)).toBe(false);
    expect(matchesBreakParam(testBreakId(6), open)).toBe(false);
  });
  it('matches a numeric id when the api has no b_ id', () => {
    expect(matchesBreakParam('5', { id: 5, publicId: '' })).toBe(true);
  });
  it('never matches 0, an absent or an empty param', () => {
    expect(matchesBreakParam('0', { id: 0, publicId: '' })).toBe(false);
    expect(matchesBreakParam('0', { id: 0, publicId: testBreakId(5) })).toBe(false);
    expect(matchesBreakParam(undefined, open)).toBe(false);
    expect(matchesBreakParam('', { id: 0, publicId: '' })).toBe(false);
    expect(matchesBreakParam(['5'], open)).toBe(false);
  });
});
