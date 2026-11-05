import { describe, expect, it } from 'vitest';
import { ATTRIBUTION_SOURCES } from './api-types';
import { NRIL_LICENCE_URL, NRIL_STATEMENT, plainCredits } from './creditText';

describe('plainCredits', () => {
  it('writes out the NRIL licence address, since an image cannot link it', () => {
    expect(plainCredits(['network-rail'])).toBe(`${NRIL_STATEMENT}: ${NRIL_LICENCE_URL}`);
    expect(NRIL_STATEMENT).toBe(ATTRIBUTION_SOURCES.networkRail.notice);
    expect(NRIL_LICENCE_URL).toBe(ATTRIBUTION_SOURCES.networkRail.url);
  });

  it('joins credits once each, in order, without a full stop after an address', () => {
    expect(plainCredits(['national-rail', 'network-rail', 'rsp-timetable', 'national-rail'])).toBe(
      `powered by NationalRail (Train Information Services Ltd) · ${NRIL_STATEMENT}: ${NRIL_LICENCE_URL} · Source: RSP`,
    );
    expect(plainCredits(['knowledgebase-incidents'])).toBe(
      'Incidents from the Knowledgebase, published by Rail Delivery Group',
    );
  });
});
