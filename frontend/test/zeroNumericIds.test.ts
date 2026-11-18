import { describe, expect, it } from 'vitest';
import { zeroNumericIds } from './zeroNumericIds';

describe('zeroNumericIds', () => {
  it('zeroes a numeric id and an array of them where an opaque sibling exists, deeply', () => {
    const shaped = zeroNumericIds({
      id: 4,
      publicId: 'j_1',
      legs: [{ id: 9, publicId: 'l_1', trainSubscriptionId: 7, trainSubscriptionPublicId: 't_1' }],
      journeyIds: [1, 2],
      journeyPublicIds: ['j_1', 'j_2'],
      openBreakId: 3,
      openBreakPublicId: 'b_1',
    });
    expect(shaped).toEqual({
      id: 0,
      publicId: 'j_1',
      legs: [{ id: 0, publicId: 'l_1', trainSubscriptionId: 0, trainSubscriptionPublicId: 't_1' }],
      journeyIds: [0, 0],
      journeyPublicIds: ['j_1', 'j_2'],
      openBreakId: 0,
      openBreakPublicId: 'b_1',
    });
  });

  it('keeps nulls, ids with no opaque sibling and anything else', () => {
    const shaped = zeroNumericIds({
      id: 5,
      sourceTemplateId: null,
      sourceTemplatePublicId: null,
      ticketIds: [8, 9],
      legCount: 3,
    });
    expect(shaped).toEqual({
      id: 5,
      sourceTemplateId: null,
      sourceTemplatePublicId: null,
      ticketIds: [8, 9],
      legCount: 3,
    });
  });
});
