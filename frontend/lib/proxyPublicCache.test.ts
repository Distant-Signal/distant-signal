import { describe, it, expect } from 'vitest';
import {
  CRS_SEGMENT,
  MAX_PUBLIC_CACHE_SECONDS,
  PUBLIC_CACHE_ALLOWLIST,
  boardQueryIsCanonical,
  carriesCredentials,
  isPublicCacheCandidate,
  publicCacheCeilingFor,
  publicCacheEnabled,
  publicCacheHeadersFor,
  publicLifetimes,
} from './proxyPublicCache';

describe('publicCacheEnabled', () => {
  it('is off unless the value is exactly true', () => {
    expect(publicCacheEnabled({})).toBe(false);
    expect(publicCacheEnabled({ API_PROXY_PUBLIC_CACHE_ENABLED: '' })).toBe(false);
    expect(publicCacheEnabled({ API_PROXY_PUBLIC_CACHE_ENABLED: 'false' })).toBe(false);
    expect(publicCacheEnabled({ API_PROXY_PUBLIC_CACHE_ENABLED: '1' })).toBe(false);
    expect(publicCacheEnabled({ API_PROXY_PUBLIC_CACHE_ENABLED: 'TRUE' })).toBe(false);
    expect(publicCacheEnabled({ API_PROXY_PUBLIC_CACHE_ENABLED: 'true' })).toBe(true);
    expect(publicCacheEnabled({ API_PROXY_PUBLIC_CACHE_ENABLED: ' true ' })).toBe(true);
  });
});

describe('PUBLIC_CACHE_ALLOWLIST', () => {
  // A change to this list is a decision about what a shared cache may keep:
  // update the list in lib/proxyPublicCache.ts with its justification, then
  // this expectation.
  it('is exactly the audited set of paths', () => {
    expect(PUBLIC_CACHE_ALLOWLIST.map((entry) => entry.segments.join('/'))).toEqual([
      'lines',
      'stations/codes',
      'stations/index',
      'stanox-crs',
      'island-of-ireland/stations',
      'island-of-ireland/lines',
      'transit/networks',
      'transit/rail-links',
      'Trips/station-groups',
      'Trips/operator-groups',
      'Trips/operators',
      'stations/:crs/board',
    ]);
  });

  it('has no wildcard or empty segment, only the CRS parameter, and a reason for each entry', () => {
    for (const entry of PUBLIC_CACHE_ALLOWLIST) {
      expect(entry.why.length).toBeGreaterThan(0);
      for (const segment of entry.segments) {
        if (segment === CRS_SEGMENT) continue;
        expect(segment).toMatch(/^[A-Za-z0-9-]+$/);
      }
    }
  });

  it('lists none of the personal or live areas', () => {
    const personal = ['auth', 'journeys', 'Journeys', 'groups', 'account', 'notifications', 'calendar', 'preferences'];
    for (const entry of PUBLIC_CACHE_ALLOWLIST) {
      expect(personal).not.toContain(entry.segments[0]);
      expect(entry.segments).not.toContain('departures');
    }
  });
});

describe('carriesCredentials', () => {
  it('sees the session cookie among others, in any case', () => {
    expect(carriesCredentials(new Headers({ cookie: 'a=1; distant_signal_session=x' }))).toBe(true);
    expect(carriesCredentials(new Headers({ cookie: 'Distant_Signal_Session=x' }))).toBe(true);
    expect(carriesCredentials(new Headers({ cookie: 'distant_signal_login=y' }))).toBe(true);
  });

  it('sees an Authorization header', () => {
    expect(carriesCredentials(new Headers({ authorization: 'Bearer abc' }))).toBe(true);
  });

  it('is false for no cookie or only unrelated cookies', () => {
    expect(carriesCredentials(new Headers())).toBe(false);
    expect(carriesCredentials(new Headers({ cookie: 'theme=dark; a=1' }))).toBe(false);
  });
});

describe('isPublicCacheCandidate', () => {
  const anon = new Headers();

  it('accepts GET and HEAD of every allowlisted path with no credentials', () => {
    for (const entry of PUBLIC_CACHE_ALLOWLIST) {
      const path = entry.segments.map((segment) => (segment === CRS_SEGMENT ? 'PAD' : segment));
      expect(isPublicCacheCandidate('GET', path, anon)).toBe(true);
      expect(isPublicCacheCandidate('HEAD', path, anon)).toBe(true);
    }
  });

  it('rejects every allowlisted path when a session cookie or Authorization is present', () => {
    for (const entry of PUBLIC_CACHE_ALLOWLIST) {
      expect(
        isPublicCacheCandidate(
          'GET',
          entry.segments.map((s) => (s === CRS_SEGMENT ? 'PAD' : s)),
          new Headers({ cookie: 'distant_signal_session=abc' }),
        ),
      ).toBe(false);
      expect(isPublicCacheCandidate('GET', entry.segments, new Headers({ authorization: 'Bearer x' }))).toBe(false);
    }
  });

  it('rejects other methods', () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) {
      expect(isPublicCacheCandidate(method, ['lines'], anon)).toBe(false);
    }
  });

  it('rejects paths that are not on the list, including near misses', () => {
    expect(isPublicCacheCandidate('GET', ['preferences'], anon)).toBe(false);
    expect(isPublicCacheCandidate('GET', ['auth', 'session'], anon)).toBe(false);
    expect(isPublicCacheCandidate('GET', ['stations', 'EUS', 'departures'], anon)).toBe(false);
    expect(isPublicCacheCandidate('GET', ['stations'], anon)).toBe(false);
    expect(isPublicCacheCandidate('GET', ['lines', 'c2c'], anon)).toBe(false);
    expect(isPublicCacheCandidate('GET', ['Lines'], anon)).toBe(false);
    expect(isPublicCacheCandidate('GET', ['trips', 'operators'], anon)).toBe(false);
    expect(isPublicCacheCandidate('GET', ['stations', 'index', ''], anon)).toBe(false);
    expect(isPublicCacheCandidate('GET', [], anon)).toBe(false);
  });

  it('does not let a decoded slash inside one segment spell an allowlisted path', () => {
    expect(isPublicCacheCandidate('GET', ['stations/index'], anon)).toBe(false);
  });
});

describe('the station board entry', () => {
  const anon = new Headers();
  const board = (crs: string): string[] => ['stations', crs, 'board'];

  it('matches one upper-case CRS and nothing else in that slot', () => {
    expect(isPublicCacheCandidate('GET', board('PAD'), anon)).toBe(true);
    for (const bad of ['pad', 'PADD', 'PA', 'P1D', '', 'PA%2F', 'index', 'codes']) {
      expect(isPublicCacheCandidate('GET', board(bad), anon)).toBe(false);
    }
    expect(isPublicCacheCandidate('GET', ['stations', 'PAD'], anon)).toBe(false);
    expect(isPublicCacheCandidate('GET', ['stations', 'PAD', 'board', 'x'], anon)).toBe(false);
    expect(isPublicCacheCandidate('GET', ['stations', 'PAD', 'departures'], anon)).toBe(false);
    expect(isPublicCacheCandidate('GET', ['public', 'stations', 'PAD', 'board'], anon)).toBe(false);
  });

  it('is never a candidate for a signed-in request or a non-GET', () => {
    expect(isPublicCacheCandidate('GET', board('PAD'), new Headers({ cookie: 'distant_signal_session=x' }))).toBe(
      false,
    );
    expect(isPublicCacheCandidate('POST', board('PAD'), anon)).toBe(false);
  });

  it('accepts the api query in its canonical spelling', () => {
    for (const search of [
      '',
      '?',
      '?limit=8',
      '?limit=30&date=2026-11-28',
      '?date=2026-11-28&operator=GW',
      '?limit=1&operator=GW,SW,XC',
    ]) {
      expect(boardQueryIsCanonical(search)).toBe(true);
      expect(isPublicCacheCandidate('GET', board('PAD'), anon, search)).toBe(true);
    }
  });

  it('refuses a query that could mint a new cache key for the same answer', () => {
    for (const search of [
      '?x=1',
      '?limit=8&x=1',
      '?limit=8&limit=9',
      '?limit=0',
      '?limit=31',
      '?limit=08',
      '?limit=abc',
      '?limit=',
      '?%6Cimit=8',
      '?limit=%38',
      '?date=2026-13-01',
      '?date=2026-11-28T00:00',
      '?operator=gw',
      '?operator=SW,GW',
      '?operator=GW,GW',
      '?operator=GW%2CSW',
      '?operator=GWR',
      '?limit',
      'limit=8',
    ]) {
      expect(boardQueryIsCanonical(search)).toBe(false);
      expect(isPublicCacheCandidate('GET', board('PAD'), anon, search)).toBe(false);
    }
    const codes = (n: number): string =>
      Array.from({ length: n }, (_, i) => `A${String.fromCharCode(65 + i)}`).join(',');
    expect(boardQueryIsCanonical(`?operator=${codes(26)}`)).toBe(true);
    const thirtyOne = `${codes(26)},B0,B1,B2,B3,B4`;
    expect(boardQueryIsCanonical(`?operator=${thirtyOne}`)).toBe(false);
  });

  it('caps its lifetime at 60 seconds, the rest at the global ceiling', () => {
    expect(publicCacheCeilingFor(board('PAD'))).toBe(60);
    expect(publicCacheCeilingFor(['lines'])).toBe(MAX_PUBLIC_CACHE_SECONDS);
    const got = publicCacheHeadersFor(
      200,
      new Headers({ 'Cache-Control': 'public, s-maxage=20, stale-while-revalidate=30' }),
      60,
    );
    expect(got?.cacheControl).toBe('public, s-maxage=20');
    expect(
      publicCacheHeadersFor(200, new Headers({ 'Cache-Control': 'public, s-maxage=3600' }), 60)?.cacheControl,
    ).toBe('public, s-maxage=60');
  });

  it('never caches a 404 (the api switch off) or a 400', () => {
    const cc = new Headers({ 'Cache-Control': 'public, s-maxage=20' });
    for (const status of [400, 404, 429, 503]) expect(publicCacheHeadersFor(status, cc, 60)).toBeNull();
  });
});

describe('publicLifetimes', () => {
  it('accepts public with a positive max-age or s-maxage', () => {
    expect(publicLifetimes('public, max-age=3600')).toEqual({ maxAge: 3600, sMaxAge: undefined });
    expect(publicLifetimes('Public, S-MaxAge=30')).toEqual({ maxAge: undefined, sMaxAge: 30 });
    expect(publicLifetimes('public, max-age=60, s-maxage=600')).toEqual({ maxAge: 60, sMaxAge: 600 });
  });

  it('rejects anything not clearly public', () => {
    expect(publicLifetimes(null)).toBeNull();
    expect(publicLifetimes('')).toBeNull();
    expect(publicLifetimes('max-age=3600')).toBeNull();
    expect(publicLifetimes('private, max-age=3600')).toBeNull();
    expect(publicLifetimes('private, no-store')).toBeNull();
    expect(publicLifetimes('public, no-store')).toBeNull();
    expect(publicLifetimes('public, max-age=3600, private')).toBeNull();
    expect(publicLifetimes('public, no-cache, max-age=3600')).toBeNull();
    expect(publicLifetimes('public')).toBeNull();
    expect(publicLifetimes('public, max-age=0')).toBeNull();
    expect(publicLifetimes('public, max-age=abc')).toBeNull();
    expect(publicLifetimes('public, max-age=-5')).toBeNull();
    expect(publicLifetimes('public, max-age=3600, s-maxage=0')).toBeNull();
  });
});

describe('publicCacheHeadersFor', () => {
  const upstream = (cacheControl: string, extra: Record<string, string> = {}): Headers =>
    new Headers({ 'Cache-Control': cacheControl, ...extra });

  it('re-emits a public header and carries Vary', () => {
    expect(publicCacheHeadersFor(200, upstream('public, max-age=3600', { Vary: 'Cookie' }))).toEqual({
      cacheControl: 'public, max-age=3600',
      vary: 'Cookie',
    });
    expect(publicCacheHeadersFor(200, upstream('public, max-age=300'))?.vary).toBeNull();
  });

  it('caps both lifetimes at the ceiling', () => {
    const got = publicCacheHeadersFor(200, upstream('public, max-age=86400, s-maxage=999999'));
    expect(got?.cacheControl).toBe(`public, max-age=${MAX_PUBLIC_CACHE_SECONDS}, s-maxage=${MAX_PUBLIC_CACHE_SECONDS}`);
  });

  it('drops directives it does not know, such as stale-while-revalidate', () => {
    expect(publicCacheHeadersFor(200, upstream('public, max-age=60, stale-while-revalidate=999'))?.cacheControl).toBe(
      'public, max-age=60',
    );
  });

  it('allows a 304 and nothing else besides 200', () => {
    expect(publicCacheHeadersFor(304, upstream('public, max-age=60'))).not.toBeNull();
    for (const status of [201, 204, 301, 302, 400, 401, 403, 404, 410, 429, 500, 502, 503, 504]) {
      expect(publicCacheHeadersFor(status, upstream('public, max-age=60'))).toBeNull();
    }
  });

  it('is null for private, no-store or a missing header', () => {
    expect(publicCacheHeadersFor(200, upstream('private, no-store'))).toBeNull();
    expect(publicCacheHeadersFor(200, upstream('no-store'))).toBeNull();
    expect(publicCacheHeadersFor(200, new Headers())).toBeNull();
  });
});
