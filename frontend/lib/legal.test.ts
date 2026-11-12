import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  __resetLegalWarningForTests,
  DEFAULT_RETENTION_POLICY,
  describeRetentionDays,
  retentionPolicy,
  LEGAL_CONFIG,
  readLegalConfig,
  legalPageMetadata,
  legalPagesMode,
  legalPagesPublished,
  legalPagesVisible,
  unfilledLegalPlaceholders,
  type LegalConfig,
} from './legal';

const FILLED: LegalConfig = {
  OPERATOR_NAME: 'Example Operator',
  CONTACT_EMAIL: 'hello@example.com',
  ICO_REGISTRATION: 'ZA000000',
  MINIMUM_AGE: '18',
  SSO_LOG_RETENTION: '1 year',
  LAST_UPDATED: '1 November 2026',
};

describe('legal pages flag', () => {
  it('does not count an unset optional ICO registration as a placeholder', () => {
    const { ICO_REGISTRATION: _ico, ...withoutIco } = FILLED;
    expect(unfilledLegalPlaceholders(withoutIco)).toEqual([]);
    expect(legalPagesPublished({ LEGAL_PAGES_PUBLISHED: 'true' }, withoutIco)).toBe(true);
  });

  beforeEach(() => {
    __resetLegalWarningForTests();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('is off when LEGAL_PAGES_PUBLISHED is unset (the default)', () => {
    expect(legalPagesPublished({}, FILLED)).toBe(false);
  });

  it.each(['false', '1', 'TRUE', 'yes', ''])('is off for LEGAL_PAGES_PUBLISHED=%j', (value) => {
    expect(legalPagesPublished({ LEGAL_PAGES_PUBLISHED: value }, FILLED)).toBe(false);
  });

  it('is on only for exactly "true" with every operator value filled in', () => {
    expect(legalPagesPublished({ LEGAL_PAGES_PUBLISHED: 'true' }, FILLED)).toBe(true);
  });

  it('stays off, and warns once, while any placeholder is left', () => {
    const partial = { ...FILLED, CONTACT_EMAIL: '[[CONTACT_EMAIL]]' };
    expect(legalPagesPublished({ LEGAL_PAGES_PUBLISHED: 'true' }, partial)).toBe(false);
    expect(legalPagesPublished({ LEGAL_PAGES_PUBLISHED: 'true' }, partial)).toBe(false);
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(vi.mocked(console.warn).mock.calls[0]![0]).toContain('CONTACT_EMAIL');
  });

  it('with no LEGAL_* values set, every required field is a placeholder, so the pages cannot go live by accident', () => {
    // The minimum age defaults to 18; the ICO registration is optional.
    expect(LEGAL_CONFIG.MINIMUM_AGE).toBe('18');
    expect(LEGAL_CONFIG.ICO_REGISTRATION).toBeUndefined();
    expect(unfilledLegalPlaceholders(LEGAL_CONFIG)).toEqual([
      'OPERATOR_NAME',
      'CONTACT_EMAIL',
      'SSO_LOG_RETENTION',
      'LAST_UPDATED',
    ]);
    expect(legalPagesPublished({ LEGAL_PAGES_PUBLISHED: 'true' })).toBe(false);
  });

  it('reads process.env by default', () => {
    const before = process.env.LEGAL_PAGES_PUBLISHED;
    delete process.env.LEGAL_PAGES_PUBLISHED;
    expect(legalPagesPublished()).toBe(false);
    if (before !== undefined) process.env.LEGAL_PAGES_PUBLISHED = before;
  });

  it('previews the drafts, placeholders and all, only with LEGAL_PAGES_PREVIEW=true', () => {
    expect(legalPagesMode({ LEGAL_PAGES_PREVIEW: 'true' })).toBe('preview');
    expect(legalPagesVisible({ LEGAL_PAGES_PREVIEW: 'true' })).toBe(true);
    expect(legalPagesPublished({ LEGAL_PAGES_PREVIEW: 'true' })).toBe(false);
    expect(legalPagesMode({ LEGAL_PAGES_PREVIEW: '1' })).toBe('off');
    expect(legalPagesVisible({})).toBe(false);
  });

  it('falls back to preview, not published, when the publish flag is on but placeholders remain', () => {
    expect(legalPagesMode({ LEGAL_PAGES_PUBLISHED: 'true', LEGAL_PAGES_PREVIEW: 'true' })).toBe('preview');
    expect(legalPagesMode({ LEGAL_PAGES_PUBLISHED: 'true', LEGAL_PAGES_PREVIEW: 'true' }, FILLED)).toBe('published');
  });
});

const ENV = {
  LEGAL_OPERATOR_NAME: 'Example Operator',
  LEGAL_CONTACT_EMAIL: 'hello@example.com',
  LEGAL_SSO_LOG_RETENTION: '1 year',
  LEGAL_LAST_UPDATED: '1 November 2026',
};

describe('readLegalConfig', () => {
  it('reads every field from the environment, trimmed', () => {
    expect(
      readLegalConfig({ ...ENV, LEGAL_OPERATOR_NAME: '  Example Operator ', LEGAL_ICO_REGISTRATION: 'ZA000000' }),
    ).toEqual({
      OPERATOR_NAME: 'Example Operator',
      CONTACT_EMAIL: 'hello@example.com',
      ICO_REGISTRATION: 'ZA000000',
      MINIMUM_AGE: '18',
      SSO_LOG_RETENTION: '1 year',
      LAST_UPDATED: '1 November 2026',
    });
  });

  it('publishes with the required values set and the optional ones absent', () => {
    expect(legalPagesPublished({ ...ENV, LEGAL_PAGES_PUBLISHED: 'true' })).toBe(true);
  });

  it('reads an optional hosting provider, leaves it undefined when unset and flags a malformed one', () => {
    expect(readLegalConfig(ENV).HOSTING_PROVIDER).toBeUndefined();
    expect(readLegalConfig({ ...ENV, LEGAL_HOSTING_PROVIDER: ' Example Hosting ' }).HOSTING_PROVIDER).toBe(
      'Example Hosting',
    );
    expect(unfilledLegalPlaceholders(readLegalConfig(ENV))).toEqual([]);
    expect(unfilledLegalPlaceholders(readLegalConfig({ ...ENV, LEGAL_HOSTING_PROVIDER: '<b>x</b>' }))).toEqual([
      'HOSTING_PROVIDER',
    ]);
  });

  it('takes a valid minimum age and rejects the rest', () => {
    expect(readLegalConfig({ ...ENV, LEGAL_MINIMUM_AGE: '16' }).MINIMUM_AGE).toBe('16');
    for (const bad of ['12', '99', 'eighteen', '1e1', '-18']) {
      expect(readLegalConfig({ ...ENV, LEGAL_MINIMUM_AGE: bad }).MINIMUM_AGE).toBe('[[MINIMUM_AGE]]');
    }
  });

  it.each([
    ['LEGAL_OPERATOR_NAME', 'OPERATOR_NAME', ''],
    ['LEGAL_OPERATOR_NAME', 'OPERATOR_NAME', '   '],
    ['LEGAL_OPERATOR_NAME', 'OPERATOR_NAME', '<script>alert(1)</script>'],
    ['LEGAL_OPERATOR_NAME', 'OPERATOR_NAME', 'x'.repeat(101)],
    ['LEGAL_OPERATOR_NAME', 'OPERATOR_NAME', 'two\nlines'],
    ['LEGAL_CONTACT_EMAIL', 'CONTACT_EMAIL', 'not-an-email'],
    ['LEGAL_CONTACT_EMAIL', 'CONTACT_EMAIL', 'a b@example.com'],
    ['LEGAL_CONTACT_EMAIL', 'CONTACT_EMAIL', 'a@example.com\nBcc: x@example.com'],
    ['LEGAL_CONTACT_EMAIL', 'CONTACT_EMAIL', 'a@localhost'],
    ['LEGAL_SSO_LOG_RETENTION', 'SSO_LOG_RETENTION', 'x'.repeat(61)],
    ['LEGAL_LAST_UPDATED', 'LAST_UPDATED', '2026-11-01'],
    ['LEGAL_LAST_UPDATED', 'LAST_UPDATED', '31 February 2026'],
    ['LEGAL_LAST_UPDATED', 'LAST_UPDATED', '1 Nov 2026'],
  ])('%s=%j is invalid and stays a placeholder, so the pages stay off', (name, key, value) => {
    const env = { ...ENV, [name]: value };
    expect(unfilledLegalPlaceholders(readLegalConfig(env))).toEqual([key]);
    expect(legalPagesPublished({ ...env, LEGAL_PAGES_PUBLISHED: 'true' })).toBe(false);
  });

  it('treats a malformed optional ICO registration as a placeholder rather than dropping it', () => {
    expect(unfilledLegalPlaceholders(readLegalConfig({ ...ENV, LEGAL_ICO_REGISTRATION: 'no spaces <b>' }))).toEqual([
      'ICO_REGISTRATION',
    ]);
  });

  it('LEGAL_CONFIG follows process.env at access time, not at import', () => {
    vi.stubEnv('LEGAL_OPERATOR_NAME', 'First');
    expect(LEGAL_CONFIG.OPERATOR_NAME).toBe('First');
    vi.stubEnv('LEGAL_OPERATOR_NAME', 'Second');
    expect(LEGAL_CONFIG.OPERATOR_NAME).toBe('Second');
    vi.unstubAllEnvs();
  });
});

describe('legalPageMetadata', () => {
  it('is noindex unless the pages are really published', () => {
    expect(legalPageMetadata('Terms of use', 'd', '/terms', false).robots).toEqual({ index: false, follow: false });
    expect(legalPageMetadata('Terms of use', 'd', '/terms', true).robots).toBeUndefined();
    expect(legalPageMetadata('Terms of use', 'd', '/terms', true).title).toBe('Terms of use · Distant Signal');
  });
});

// LEG-28 / DQ7: the privacy notice follows the api's retention settings.
describe('retentionPolicy', () => {
  it('defaults to the chart defaults (inactive-account deletion off)', () => {
    expect(retentionPolicy({})).toEqual({
      pastTravelDays: 548,
      stalePushSubscriptionDays: 365,
      inactiveAccountDays: 0,
      regularJourneyDays: 0,
      recentlyDeletedDays: 0,
    });
  });

  it('reads the values the chart copies from the api', () => {
    expect(
      retentionPolicy({
        RETENTION_PAST_TRAVEL_DAYS: '400',
        RETENTION_STALE_PUSH_SUBSCRIPTION_DAYS: '0',
        RETENTION_INACTIVE_ACCOUNT_DAYS: '730',
        RETENTION_REGULAR_JOURNEY_DAYS: '90',
        RETENTION_RECENTLY_DELETED_DAYS: '14',
      }),
    ).toEqual({
      pastTravelDays: 400,
      stalePushSubscriptionDays: 0,
      inactiveAccountDays: 730,
      regularJourneyDays: 90,
      recentlyDeletedDays: 14,
    });
  });

  it('leaves the Recently deleted sentences out unless the chart passes the days', () => {
    expect(retentionPolicy({}).recentlyDeletedDays).toBe(0);
    expect(retentionPolicy({ RETENTION_RECENTLY_DELETED_DAYS: '' }).recentlyDeletedDays).toBe(0);
    expect(retentionPolicy({ RETENTION_RECENTLY_DELETED_DAYS: '7' }).recentlyDeletedDays).toBe(7);
  });

  it('falls back to the default for a malformed value', () => {
    expect(retentionPolicy({ RETENTION_INACTIVE_ACCOUNT_DAYS: 'soon', RETENTION_PAST_TRAVEL_DAYS: '-1' })).toEqual(
      DEFAULT_RETENTION_POLICY,
    );
  });
});

describe('describeRetentionDays', () => {
  it.each([
    [365, '12 months'],
    [548, '18 months'],
    [730, '24 months'],
    [30, '1 month'],
    [45, '45 days'],
    [1, '1 day'],
  ])('%i -> %s', (days, words) => {
    expect(describeRetentionDays(days)).toBe(words);
  });
});
