import { describe, expect, it, vi } from 'vitest';
import { INCIDENT_ID } from './incidents';
import {
  boundedCredit,
  boundedTitle,
  isCalendarDate,
  PREVIEW_ERROR_CACHE_CONTROL,
  TOKEN_PREVIEW_CACHE_CONTROL,
} from './livePreview';
import { guardPreview } from './previewRoute';
import { PREVIEW_RATE_LIMIT, PREVIEW_RATE_WINDOW_MS, PreviewRateLimiter, rateLimitKey } from './previewRateLimit';
import { stationCreditIds } from './stationPreview';
import { previewTitle } from './incidentPreview';

const request = (ip?: string) =>
  new Request('https://ds.example/x/card.png', ip ? { headers: { 'CF-Connecting-IP': ip } } : {});

describe('guardPreview', () => {
  it('passes a response through', async () => {
    const response = new Response('ok');
    expect(await guardPreview(() => Promise.resolve(response))(request(), {})).toBe(response);
  });

  it('turns anything thrown into a short-lived, noindexed 503 a chat app can retry', async () => {
    const response = await guardPreview(() => Promise.reject(new Error('api down')))(request(), {});
    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe(PREVIEW_ERROR_CACHE_CONTROL);
    expect(response.headers.get('cache-control')).toMatch(/max-age=10$|max-age=10,/);
    expect(response.headers.get('retry-after')).toBe('30');
    expect(response.headers.get('x-robots-tag')).toBe('noindex');
  });

  it("stores a capability-token card's 503 nowhere", async () => {
    const response = await guardPreview(() => Promise.reject(new Error('api down')), { token: true })(request(), {});
    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe(TOKEN_PREVIEW_CACHE_CONTROL);
  });

  it('answers a client over its budget with a 429 before running the route', async () => {
    const limiter = new PreviewRateLimiter(2, 60_000);
    const handler = vi.fn(() => Promise.resolve(new Response('ok')));
    const guarded = guardPreview(handler, { limiter });
    expect((await guarded(request('203.0.113.9'), {})).status).toBe(200);
    expect((await guarded(request('203.0.113.9'), {})).status).toBe(200);
    const limited = await guarded(request('203.0.113.9'), {});
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get('retry-after'))).toBeGreaterThan(0);
    expect(limited.headers.get('cache-control')).toBe(TOKEN_PREVIEW_CACHE_CONTROL);
    expect(limited.headers.get('x-robots-tag')).toBe('noindex');
    expect(handler).toHaveBeenCalledTimes(2);
    // Another client has its own budget.
    expect((await guarded(request('198.51.100.4'), {})).status).toBe(200);
  });

  it('counts every address in an IPv6 /64 as one client', async () => {
    const limiter = new PreviewRateLimiter(2, 60_000);
    const guarded = guardPreview(() => Promise.resolve(new Response('ok')), { limiter });
    expect((await guarded(request('2001:db8:1:2::1'), {})).status).toBe(200);
    expect((await guarded(request('2001:db8:1:2:aaaa:bbbb:cccc:dddd'), {})).status).toBe(200);
    expect((await guarded(request('2001:db8:1:2::ffff'), {})).status).toBe(429);
    expect((await guarded(request('2001:db8:1:3::1'), {})).status).toBe(200);
    expect(limiter.size).toBe(2);
  });

  it('limits nobody it cannot key: no trusted client IP', async () => {
    const limiter = new PreviewRateLimiter(1, 60_000);
    const guarded = guardPreview(() => Promise.resolve(new Response('ok')), { limiter });
    for (let i = 0; i < 3; i++) expect((await guarded(request(), {})).status).toBe(200);
    // A spoofable header is not a key.
    const spoofed = new Request('https://ds.example/x/card.png', { headers: { 'X-Forwarded-For': '203.0.113.9' } });
    for (let i = 0; i < 3; i++) expect((await guarded(spoofed, {})).status).toBe(200);
    expect(limiter.size).toBe(0);
  });
});

describe('PreviewRateLimiter', () => {
  it('allows the limit in a window, then says how long to wait, then starts again', () => {
    const limiter = new PreviewRateLimiter(3, 60_000);
    for (let i = 0; i < 3; i++) expect(limiter.take('a', 1_000)).toBeNull();
    expect(limiter.take('a', 1_000)).toBe(60);
    expect(limiter.take('a', 50_500)).toBe(11);
    expect(limiter.take('a', 61_000)).toBeNull();
  });

  it('keeps at most its client cap, dropping finished windows and then the oldest', () => {
    const limiter = new PreviewRateLimiter(1, 60_000, 3);
    limiter.take('a', 0);
    limiter.take('b', 30_000);
    limiter.take('c', 40_000);
    // 'a' has finished its window: it goes first, and 'b' stays limited.
    limiter.take('d', 61_000);
    expect(limiter.size).toBe(3);
    expect(limiter.take('b', 61_000)).not.toBeNull();
    // Nothing has finished now: the oldest ('b') goes, so it starts afresh.
    limiter.take('e', 62_000);
    expect(limiter.size).toBe(3);
    expect(limiter.take('c', 62_000)).not.toBeNull();
    expect(limiter.take('b', 62_000)).toBeNull();
  });

  it('uses the defaults it documents', () => {
    expect([PREVIEW_RATE_LIMIT, PREVIEW_RATE_WINDOW_MS]).toEqual([60, 60_000]);
  });
});

describe('rateLimitKey', () => {
  it.each([
    ['203.0.113.9', '203.0.113.9'],
    ['2001:db8:1:2::1', '2001:db8:1:2::/64'],
    ['2001:0DB8:0001:0002:ffff:0:0:1', '2001:db8:1:2::/64'],
    ['2001:db8::', '2001:db8:0:0::/64'],
    ['::1', '0:0:0:0::/64'],
    ['fe80::1%eth0', 'fe80:0:0:0::/64'],
    ['::ffff:192.0.2.1', '192.0.2.1'],
    ['::ffff:c000:201', '192.0.2.1'],
    ['2001:db8:1:2:3:4:192.0.2.1', '2001:db8:1:2::/64'],
  ])('keys %s as %s', (ip, key) => {
    expect(rateLimitKey(ip)).toBe(key);
  });
});

describe('isCalendarDate', () => {
  it.each(['2026-10-30', '2028-02-29', '2026-12-31'])('accepts %s', (value) => {
    expect(isCalendarDate(value)).toBe(true);
  });

  it.each(['2026-02-30', '2026-13-01', '2026-00-10', '2027-02-29', '2026-1-1', '26-10-30', '2026-10-30T00:00', ''])(
    'rejects %j',
    (value) => {
      expect(isCalendarDate(value)).toBe(false);
    },
  );
});

describe('INCIDENT_ID', () => {
  it.each(['12345', 'FIXTURE-INCIDENT-1', 'E879EB6C791C470AB6C2A7458AE68C3B', 'a_b-c'])('accepts %s', (id) => {
    expect(INCIDENT_ID.test(id)).toBe(true);
  });

  it.each(['', '../x', 'a b', 'a/b', 'a?b', 'x'.repeat(129)])('rejects %j', (id) => {
    expect(INCIDENT_ID.test(id)).toBe(false);
  });
});

describe('boundedTitle and boundedCredit', () => {
  it('tidies, keeps a short title whole and falls back when empty', () => {
    expect(boundedTitle('  Delays   at\nLewes ', 'Incident')).toBe('Delays at Lewes');
    expect(boundedTitle('   ', 'Incident')).toBe('Incident');
  });

  it('cuts a long title at a word, with no ellipsis or trailing punctuation', () => {
    const long = `Disruption between Chester and Llandudno Junction, ${'with a very long explanation, '.repeat(8)}`;
    const cut = boundedTitle(long, 'Incident');
    expect(cut.length).toBeLessThanOrEqual(100);
    expect(long.startsWith(cut)).toBe(true);
    expect(cut).not.toMatch(/[.,;:\s-]$|…|\.\.\./);
  });

  it('cuts one unbroken word at the limit', () => {
    expect(boundedTitle('x'.repeat(500), 'Incident')).toHaveLength(100);
  });

  it('bounds a credit and leaves an empty one empty', () => {
    expect(boundedCredit('licence text '.repeat(60)).length).toBeLessThanOrEqual(300);
    expect(boundedCredit('')).toBe('');
  });
});

describe('previewTitle', () => {
  it('is plain text, without a leading CLEARED, and never empty', () => {
    expect(previewTitle('CLEARED: <b>Delays</b> at&nbsp;Lewes')).toBe('Delays at Lewes');
    expect(previewTitle('   ')).toBe('Incident');
    expect(previewTitle('CLEARED:')).toBe('CLEARED:');
  });
});

describe('stationCreditIds', () => {
  const report = (id: string) => ({ id }) as never;

  it('credits Network Rail wherever a National Rail status makes the claim, even "No disruptions"', () => {
    expect(stationCreditIds({ coverage: 'covered', reports: [] })).toEqual(['national-rail', 'network-rail']);
    expect(stationCreditIds({ coverage: 'covered', reports: [report('southern-x')] })).toEqual([
      'national-rail',
      'network-rail',
    ]);
  });

  it('credits TfL, and not Network Rail, for TfL lines alone, and both for a mix', () => {
    expect(stationCreditIds({ coverage: 'covered', reports: [report('tfl-victoria')] })).toEqual([
      'national-rail',
      'tfl',
    ]);
    expect(stationCreditIds({ coverage: 'covered', reports: [report('tfl-victoria'), report('lner')] })).toEqual([
      'national-rail',
      'network-rail',
      'tfl',
    ]);
  });

  it('claims no status for a station with no tracked line', () => {
    expect(stationCreditIds({ coverage: 'none' })).toEqual(['national-rail']);
  });
});
