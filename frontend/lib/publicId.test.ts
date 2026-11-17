import { describe, expect, it } from 'vitest';
import { isLegacyId, isPublicTrackingId, isTriggerLeg, legRef, publicRef, trackingRef } from './publicId';
import { testDeviceId, testLegId, testTrackingId } from '@/test/apiDefaults';

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
