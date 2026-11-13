import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('next/headers', () => ({
  headers: async () => ({ get: () => null }),
}));

import { GET, HEAD, POST } from './route';

// The shared-cache policy (lib/proxyPublicCache.ts,
// docs/api-proxy-public-cache.md): the proxy's behaviour with the flag off
// and on, for anonymous and signed-in callers, allowlisted or not.

const PUBLIC_1H = 'public, max-age=3600';
const SESSION = 'distant_signal_session=abc123';

function req(path: string[], init?: ConstructorParameters<typeof NextRequest>[1]): NextRequest {
  return new NextRequest(`http://localhost:3000/api/${path.join('/')}`, init);
}

function call(
  handler: typeof GET,
  path: string[],
  init?: ConstructorParameters<typeof NextRequest>[1],
): Promise<Response> {
  return handler(req(path, init), { params: Promise.resolve({ path }) });
}

function headerMap(res: Response): Record<string, string> {
  return Object.fromEntries([...res.headers.entries()].sort());
}

function upstream(status: number, headers: Record<string, string>, body: string | null = '{"ok":true}'): void {
  vi.mocked(fetch).mockResolvedValueOnce(
    new Response(body, { status, headers: { 'Content-Type': 'application/json', ...headers } }),
  );
}

describe('/api/[...path] proxy public cache policy', () => {
  beforeEach(() => {
    vi.stubEnv('API_BASE_URL', 'http://test-api:8080');
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  describe('flag off', () => {
    const scenarios: [string, string[], number, Record<string, string>][] = [
      ['allowlisted public', ['stations', 'index'], 200, { 'Cache-Control': PUBLIC_1H, Vary: 'Cookie', ETag: '"x"' }],
      ['allowlisted private', ['lines'], 200, { 'Cache-Control': 'private, no-store', Vary: 'Cookie' }],
      ['non-allowlisted public', ['feeds', 'network'], 200, { 'Cache-Control': 'public, max-age=300' }],
      ['no cache header', ['stations', 'EUS', 'departures'], 200, { 'X-Generated-At': 'now' }],
      ['404', ['stations', 'codes'], 404, { 'Cache-Control': PUBLIC_1H }],
    ];

    for (const flag of [undefined, '', 'false', 'yes', '1']) {
      it(`is byte-identical to the unflagged proxy (flag ${JSON.stringify(flag)})`, async () => {
        for (const [, path, status, headers] of scenarios) {
          vi.unstubAllEnvs();
          vi.stubEnv('API_BASE_URL', 'http://test-api:8080');
          upstream(status, headers);
          const baseline = await call(GET, path);
          const baselineBody = await baseline.text();

          if (flag !== undefined) vi.stubEnv('API_PROXY_PUBLIC_CACHE_ENABLED', flag);
          upstream(status, headers);
          const res = await call(GET, path);
          expect(res.status).toBe(baseline.status);
          expect(headerMap(res)).toEqual(headerMap(baseline));
          expect(await res.text()).toBe(baselineBody);
        }
      });
    }

    it('passes the api headers through as before: Cache-Control, no Vary, Set-Cookie', async () => {
      const headers = new Headers({ 'Content-Type': 'application/json', 'Cache-Control': PUBLIC_1H, Vary: 'Cookie' });
      headers.append('Set-Cookie', 'a=1; Path=/');
      vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 200, headers }));
      const res = await call(GET, ['stations', 'index']);
      expect(res.headers.get('cache-control')).toBe(PUBLIC_1H);
      expect(res.headers.get('vary')).toBeNull();
      expect(res.headers.getSetCookie()).toEqual(['a=1; Path=/']);
    });

    it('adds nothing to a response the api sent no Cache-Control with, nor to a proxy error', async () => {
      upstream(200, {});
      expect((await call(GET, ['stations', 'index'])).headers.get('cache-control')).toBeNull();
      vi.mocked(fetch).mockRejectedValueOnce(new Error('boom'));
      const failed = await call(GET, ['stations', 'index']);
      expect(failed.status).toBe(502);
      expect(failed.headers.get('cache-control')).toBeNull();
    });
  });

  describe('flag on', () => {
    beforeEach(() => {
      vi.stubEnv('API_PROXY_PUBLIC_CACHE_ENABLED', 'true');
    });

    it('gives an anonymous allowlisted GET cacheable headers, with validators and Vary', async () => {
      upstream(200, {
        'Cache-Control': PUBLIC_1H,
        ETag: '"v1"',
        'Last-Modified': 'Wed, 04 Nov 2026 09:05:03 GMT',
        Vary: 'Cookie',
      });
      const res = await call(GET, ['stations', 'index']);
      expect(res.status).toBe(200);
      expect(res.headers.get('cache-control')).toBe(PUBLIC_1H);
      expect(res.headers.get('etag')).toBe('"v1"');
      expect(res.headers.get('last-modified')).toBe('Wed, 04 Nov 2026 09:05:03 GMT');
      expect(res.headers.get('vary')).toBe('Cookie');
      expect(await res.json()).toEqual({ ok: true });
    });

    it('serves anonymous /lines publicly and sends the api no cookie', async () => {
      upstream(200, { 'Cache-Control': PUBLIC_1H, Vary: 'Cookie' });
      const res = await call(GET, ['lines'], { headers: { cookie: 'theme=dark' } });
      expect(res.headers.get('cache-control')).toBe(PUBLIC_1H);
      const sent = vi.mocked(fetch).mock.calls[0]![1]!.headers as Record<string, string>;
      expect(sent.Cookie).toBeUndefined();
    });

    it('keeps a short api lifetime and caps a long one', async () => {
      upstream(200, { 'Cache-Control': 'public, max-age=300' });
      expect((await call(GET, ['transit', 'networks'])).headers.get('cache-control')).toBe('public, max-age=300');
      upstream(200, { 'Cache-Control': 'public, max-age=86400, s-maxage=604800' });
      expect((await call(GET, ['transit', 'networks'])).headers.get('cache-control')).toBe(
        'public, max-age=3600, s-maxage=3600',
      );
    });

    it('answers HEAD of an allowlisted path with the same headers and no body', async () => {
      upstream(200, { 'Cache-Control': PUBLIC_1H }, null);
      const res = await call(HEAD, ['stations', 'codes'], { method: 'HEAD' });
      expect(vi.mocked(fetch).mock.calls[0]![1]!.method).toBe('HEAD');
      expect(res.status).toBe(200);
      expect(res.headers.get('cache-control')).toBe(PUBLIC_1H);
      expect(await res.text()).toBe('');
    });

    it('never makes a request with the session cookie cacheable, even on an allowlisted path', async () => {
      for (const path of [['lines'], ['stations', 'index'], ['Trips', 'operators']]) {
        upstream(200, { 'Cache-Control': PUBLIC_1H, ETag: '"v1"', Vary: 'Cookie' });
        const res = await call(GET, path, { headers: { cookie: `theme=dark; ${SESSION}` } });
        expect(res.headers.get('cache-control')).toBe('private, no-store');
        expect(res.headers.get('vary')).toBeNull();
      }
    });

    it('never makes a request with the login-state cookie or an Authorization header cacheable', async () => {
      upstream(200, { 'Cache-Control': PUBLIC_1H });
      const login = await call(GET, ['lines'], { headers: { cookie: 'distant_signal_login=abc' } });
      expect(login.headers.get('cache-control')).toBe('private, no-store');
      upstream(200, { 'Cache-Control': PUBLIC_1H });
      const bearer = await call(GET, ['lines'], { headers: { authorization: 'Bearer abc' } });
      expect(bearer.headers.get('cache-control')).toBe('private, no-store');
    });

    it('still forwards the session cookie upstream for a signed-in request', async () => {
      upstream(200, { 'Cache-Control': 'private, no-store', Vary: 'Cookie' });
      await call(GET, ['lines'], { headers: { cookie: SESSION } });
      const sent = vi.mocked(fetch).mock.calls[0]![1]!.headers as Record<string, string>;
      expect(sent.Cookie).toBe(SESSION);
    });

    it('locks a path that is not allowlisted, whatever the api says', async () => {
      for (const path of [
        ['feeds', 'network'],
        ['stations', 'EUS', 'departures'],
        ['preferences'],
        ['auth', 'session'],
        ['Journeys', 'mine'],
        ['lines', 'c2c'],
      ]) {
        upstream(200, { 'Cache-Control': PUBLIC_1H, ETag: '"x"' });
        const res = await call(GET, path);
        expect(res.headers.get('cache-control')).toBe('private, no-store');
        expect(res.headers.get('vary')).toBeNull();
      }
    });

    it('locks a response the api gave no Cache-Control', async () => {
      upstream(200, {});
      expect((await call(GET, ['stations', 'index'])).headers.get('cache-control')).toBe('private, no-store');
    });

    it('never turns an upstream private or no-store public', async () => {
      for (const value of ['private, no-store', 'no-store', 'private, max-age=3600', 'public, no-store', 'public']) {
        upstream(200, { 'Cache-Control': value });
        const res = await call(GET, ['lines']);
        expect(res.headers.get('cache-control')).toBe('private, no-store');
      }
    });

    it('strips Set-Cookie from a public response', async () => {
      const headers = new Headers({ 'Content-Type': 'application/json', 'Cache-Control': PUBLIC_1H });
      headers.append('Set-Cookie', 'a=1; Path=/');
      headers.append('Set-Cookie', 'b=2; Path=/');
      vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 200, headers }));
      const res = await call(GET, ['stations', 'index']);
      expect(res.headers.get('cache-control')).toBe(PUBLIC_1H);
      expect(res.headers.getSetCookie()).toEqual([]);
    });

    it('keeps Set-Cookie on a private response, as today', async () => {
      const headers = new Headers({ 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' });
      headers.append('Set-Cookie', 'a=1; Path=/');
      vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 200, headers }));
      const res = await call(GET, ['lines']);
      expect(res.headers.getSetCookie()).toEqual(['a=1; Path=/']);
    });

    it('never makes an error response public, even from an allowlisted anonymous GET', async () => {
      for (const status of [400, 401, 403, 404, 429, 500, 502, 503]) {
        upstream(status, { 'Cache-Control': PUBLIC_1H, ETag: '"x"' }, 'nope');
        const res = await call(GET, ['stations', 'index']);
        expect(res.status).toBe(status);
        expect(res.headers.get('cache-control')).toBe('private, no-store');
        expect(res.headers.get('vary')).toBeNull();
      }
    });

    it('locks the errors the proxy makes itself', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('boom'));
      const failed = await call(GET, ['stations', 'index']);
      expect(failed.status).toBe(502);
      expect(failed.headers.get('cache-control')).toBe('private, no-store');

      vi.mocked(fetch).mockRejectedValueOnce(Object.assign(new Error('t'), { name: 'TimeoutError' }));
      const timedOut = await call(GET, ['stations', 'index']);
      expect(timedOut.status).toBe(504);
      expect(timedOut.headers.get('cache-control')).toBe('private, no-store');

      const crossSite = await call(POST, ['preferences'], {
        method: 'POST',
        headers: { origin: 'https://evil.example' },
      });
      expect(crossSite.status).toBe(403);
      expect(crossSite.headers.get('cache-control')).toBe('private, no-store');
    });

    it('locks a redirect', async () => {
      const headers = new Headers({ Location: 'https://sso.example/authorize', 'Cache-Control': PUBLIC_1H });
      headers.append('Set-Cookie', 'distant_signal_login=z; Path=/');
      vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 302, headers }));
      const res = await call(GET, ['auth', 'login']);
      expect(res.status).toBe(302);
      expect(res.headers.get('cache-control')).toBe('private, no-store');
      expect(res.headers.getSetCookie()).toEqual(['distant_signal_login=z; Path=/']);
    });

    it('locks every non-GET, allowlisted path or not', async () => {
      upstream(200, { 'Cache-Control': PUBLIC_1H });
      const res = await call(POST, ['lines'], { method: 'POST', body: '{}' });
      expect(res.headers.get('cache-control')).toBe('private, no-store');
    });

    describe('conditional requests', () => {
      it('forwards If-None-Match and relays a 304 with the public headers and validators', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          new Response(null, { status: 304, headers: { ETag: '"v1"', 'Cache-Control': PUBLIC_1H, Vary: 'Cookie' } }),
        );
        const res = await call(GET, ['stations', 'index'], { headers: { 'if-none-match': '"v1"' } });
        const sent = vi.mocked(fetch).mock.calls[0]![1]!.headers as Record<string, string>;
        expect(sent['If-None-Match']).toBe('"v1"');
        expect(res.status).toBe(304);
        expect(res.headers.get('etag')).toBe('"v1"');
        expect(res.headers.get('cache-control')).toBe(PUBLIC_1H);
        expect(res.headers.get('vary')).toBe('Cookie');
        expect(await res.text()).toBe('');
      });

      it('forwards If-Modified-Since for a candidate only', async () => {
        const since = 'Wed, 04 Nov 2026 09:05:03 GMT';
        vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 304 }));
        await call(GET, ['stations', 'index'], { headers: { 'if-modified-since': since } });
        expect((vi.mocked(fetch).mock.calls[0]![1]!.headers as Record<string, string>)['If-Modified-Since']).toBe(
          since,
        );

        vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 304 }));
        await call(GET, ['stations', 'index'], { headers: { 'if-modified-since': since, cookie: SESSION } });
        expect(
          (vi.mocked(fetch).mock.calls[1]![1]!.headers as Record<string, string>)['If-Modified-Since'],
        ).toBeUndefined();
      });

      it('locks a 304 for a signed-in request', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          new Response(null, { status: 304, headers: { ETag: '"v1"', 'Cache-Control': PUBLIC_1H } }),
        );
        const res = await call(GET, ['stations', 'index'], { headers: { 'if-none-match': '"v1"', cookie: SESSION } });
        expect(res.status).toBe(304);
        expect(res.headers.get('cache-control')).toBe('private, no-store');
      });

      it('locks a 304 that carries no public Cache-Control', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 304, headers: { ETag: '"v1"' } }));
        const res = await call(GET, ['stations', 'index'], { headers: { 'if-none-match': '"v1"' } });
        expect(res.headers.get('cache-control')).toBe('private, no-store');
      });
    });
  });
});
