import { describe, it, expect } from 'vitest';
import {
  MAX_PUBLIC_CACHE_SECONDS,
  PUBLIC_CACHE_ALLOWLIST,
  carriesCredentials,
  isPublicCacheCandidate,
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
    ]);
  });

  it('has no wildcard, parameter or empty segment, and a reason for each entry', () => {
    for (const entry of PUBLIC_CACHE_ALLOWLIST) {
      expect(entry.why.length).toBeGreaterThan(0);
      for (const segment of entry.segments) {
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
      expect(isPublicCacheCandidate('GET', entry.segments, anon)).toBe(true);
      expect(isPublicCacheCandidate('HEAD', entry.segments, anon)).toBe(true);
    }
  });

  it('rejects every allowlisted path when a session cookie or Authorization is present', () => {
    for (const entry of PUBLIC_CACHE_ALLOWLIST) {
      expect(isPublicCacheCandidate('GET', entry.segments, new Headers({ cookie: 'distant_signal_session=abc' }))).toBe(
        false,
      );
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
