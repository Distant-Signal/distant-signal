import { describe, it, expect } from 'vitest';
import { isLegacyJourneyId, isPublicJourneyId, journeyUrlWithQuery } from './journeyId';

const PUBLIC = 'j_0123456789abcdef0123456789abcdef';

describe('journey ids', () => {
  it('tells the opaque id from the numeric one, and neither from junk', () => {
    expect(isPublicJourneyId(PUBLIC)).toBe(true);
    expect(isLegacyJourneyId(PUBLIC)).toBe(false);
    expect(isLegacyJourneyId('167')).toBe(true);
    expect(isPublicJourneyId('167')).toBe(false);
    for (const junk of ['', 'j_', 'j_XYZ', 'j_0123456789ABCDEF0123456789ABCDEF', '12ab', ' 12', `${PUBLIC}0`]) {
      expect(isPublicJourneyId(junk)).toBe(false);
      expect(isLegacyJourneyId(junk)).toBe(false);
    }
  });

  it('builds the opaque URL with the query kept', () => {
    expect(journeyUrlWithQuery(PUBLIC, {})).toBe(`/journeys/${PUBLIC}`);
    expect(journeyUrlWithQuery(PUBLIC, { break: '5', src: 'push', pick: undefined })).toBe(
      `/journeys/${PUBLIC}?break=5&src=push`,
    );
    expect(journeyUrlWithQuery(PUBLIC, { pick: ['1', '2'] })).toBe(`/journeys/${PUBLIC}?pick=1&pick=2`);
  });
});
