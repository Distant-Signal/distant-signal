import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import * as route from './route';
import { HISTORY_CACHE_CONTROL, STATUS_CACHE_CONTROL } from '@/lib/tflPublicApi';

const { GET, HEAD } = route;

const TFL_SHAPED = [
  {
    $type: 'DistantSignal.LineStatusReport',
    id: 'wcml',
    lineStatuses: [],
    attribution: [{ licence: 'x', text: 'powered by NationalRail (Train Information Services Ltd)' }],
  },
];

function makeRequest(pathname: string, init?: ConstructorParameters<typeof NextRequest>[1]): NextRequest {
  return new NextRequest(`http://localhost:3000${pathname}`, init);
}

/** Next hands the handler decoded segments; mirror that. */
function segmentsOf(pathname: string): string[] {
  return pathname
    .replace(/^\/Line\//, '')
    .split('?')[0]!
    .split('/')
    .map(decodeURIComponent);
}

async function get(pathname: string, init?: ConstructorParameters<typeof NextRequest>[1]): Promise<Response> {
  return GET(makeRequest(pathname, init), { params: Promise.resolve({ path: segmentsOf(pathname) }) });
}

function upstreamCall(): { url: string; init: RequestInit & { headers: Record<string, string> } } {
  const [url, init] = vi.mocked(fetch).mock.calls[0]!;
  return { url: String(url), init: init as RequestInit & { headers: Record<string, string> } };
}

describe('/Line/[...path] public TfL-shaped routes', () => {
  beforeEach(() => {
    vi.stubEnv('API_BASE_URL', 'http://test-api:8080');
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify(TFL_SHAPED), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it.each([
    ['/Line/Mode/national-rail/Status', STATUS_CACHE_CONTROL],
    ['/Line/Mode/national-rail,tube,dlr/Status', STATUS_CACHE_CONTROL],
    ['/Line/wcml/Status', STATUS_CACHE_CONTROL],
    ['/Line/wcml,tfl-victoria/Status', STATUS_CACHE_CONTROL],
    ['/Line/wcml/Status/2026-11-01T00:00:00Z/to/2026-11-02T00:00:00Z', HISTORY_CACHE_CONTROL],
    ['/Line/wcml/Status/2026-11-01T00:00:00.000+00:00/to/2026-11-02T00:00:00+01:00', HISTORY_CACHE_CONTROL],
    ['/Line/wcml/Stats/2026-10-01/to/2026-11-01', HISTORY_CACHE_CONTROL],
    ['/Line/wcml/Stats/HalfHourly/2026-11-01T00:00Z/to/2026-11-02T00:00Z', HISTORY_CACHE_CONTROL],
    ['/Line/wcml/Stats/Hourly/2026-11-01T00:00:00Z/to/2026-11-02T00:00:00Z', HISTORY_CACHE_CONTROL],
    ['/Line/wcml/Stats/SixHourly/2026-11-01T00:00:00Z/to/2026-11-02T00:00:00Z', HISTORY_CACHE_CONTROL],
    ['/Line/wcml/Stats/Coverage/2026-10-01/to/2026-11-01', HISTORY_CACHE_CONTROL],
    ['/Line/wcml/Stats/Coverage/HalfHourly/2026-11-01T00:00:00Z/to/2026-11-02T00:00:00Z', HISTORY_CACHE_CONTROL],
  ])('serves %s from the api at the same path, cached', async (pathname, cacheControl) => {
    const res = await get(pathname);
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe(cacheControl);
    expect(await res.json()).toEqual(TFL_SHAPED);
    const { url } = upstreamCall();
    expect(decodeURIComponent(new URL(url).pathname)).toBe(pathname);
    expect(new URL(url).origin).toBe('http://test-api:8080');
  });

  it('caches status for about 30 s and history/stats for longer', () => {
    expect(STATUS_CACHE_CONTROL).toBe('public, s-maxage=30, stale-while-revalidate=30');
    expect(HISTORY_CACHE_CONTROL).toBe('public, s-maxage=60, stale-while-revalidate=300');
  });

  it('serves https://ds.cursed.solutions/Line/Mode/national-rail/Status anonymously', async () => {
    const res = await GET(
      new NextRequest('https://ds.cursed.solutions/Line/Mode/national-rail/Status', {
        headers: { cookie: 'distant_signal_session=secret' },
      }),
      { params: Promise.resolve({ path: ['Mode', 'national-rail', 'Status'] }) },
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(TFL_SHAPED);
    const { url, init } = upstreamCall();
    expect(url).toBe('http://test-api:8080/Line/Mode/national-rail/Status');
    expect(init.method).toBe('GET');
    expect(Object.keys(init.headers).map((h) => h.toLowerCase())).not.toContain('cookie');
  });

  it('forwards no cookie, Authorization, User-Agent or client-sent forwarding headers', async () => {
    await get('/Line/Mode/national-rail/Status', {
      headers: {
        cookie: 'distant_signal_session=abc; distant_signal_login=def',
        authorization: 'Bearer token',
        'user-agent': 'client/1.0',
        'x-real-ip': '6.6.6.6',
        'x-forwarded-for': '6.6.6.6',
      },
    });
    const { init } = upstreamCall();
    expect(init.headers).toEqual({ Accept: 'application/json' });
  });

  it('sends the trusted client IP as X-Real-IP for per-IP rate limits', async () => {
    await get('/Line/wcml/Status', { headers: { 'cf-connecting-ip': '203.0.113.7', 'x-real-ip': '6.6.6.6' } });
    expect(upstreamCall().init.headers['X-Real-IP']).toBe('203.0.113.7');
  });

  it('forwards ?detail=true on status routes only, and no other query', async () => {
    await get('/Line/wcml/Status?detail=true&app_key=abc');
    expect(upstreamCall().url).toBe('http://test-api:8080/Line/wcml/Status?detail=true');
    vi.mocked(fetch).mockClear();
    await get('/Line/wcml/Stats/2026-10-01/to/2026-11-01?detail=true');
    expect(upstreamCall().url).toBe('http://test-api:8080/Line/wcml/Stats/2026-10-01/to/2026-11-01');
  });

  it.each([
    '/Line/wcml',
    '/Line/wcml/Arrivals',
    '/Line/Mode/national-rail/Disruption',
    '/Line/wcml/Stats/Daily/2026-10-01/to/2026-11-01',
    '/Line/wcml/Stats/2026-10-01T00:00:00Z/to/2026-11-01T00:00:00Z',
    '/Line/wcml/Status/2026-11-01/to/2026-11-02',
    '/Line/WCML/Status',
    '/Line/wcml/Status/extra',
    '/Line/Search/wcml',
  ])('refuses %s, a path outside the allowlist, without calling the api', async (pathname) => {
    const res = await get(pathname);
    expect(res.status).toBe(404);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    ['..', 'Status'],
    ['wcml', '..', '..', 'public', 'preferences'],
    ['wcml%2F..%2F..%2Fpublic', 'Status'],
    ['wcml/../../public/preferences', 'Status'],
    ['wcml?x=1', 'Status'],
    ['wcml#x', 'Status'],
    ['wcml\u0000', 'Status'],
    ['Mode', 'national-rail/..', 'Status'],
    ['wcml', 'Status', '2026-11-01T00:00:00Z/../x', 'to', '2026-11-02T00:00:00Z'],
    ['%2e%2e', 'Status'],
  ])('refuses traversal and encoded separators in %j', async (...segments) => {
    const res = await GET(makeRequest('/Line/x'), { params: Promise.resolve({ path: segments }) });
    expect(res.status).toBe(404);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('refuses an over-long id list', async () => {
    const ids = Array.from({ length: 200 }, (_, i) => `line-${i}`).join(',');
    const res = await GET(makeRequest('/Line/x'), { params: Promise.resolve({ path: [ids, 'Status'] }) });
    expect(res.status).toBe(404);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('exports GET and HEAD only, so Next answers other methods with 405', () => {
    const methods = Object.keys(route).filter((name) => /^[A-Z]+$/.test(name));
    expect(methods.sort()).toEqual(['GET', 'HEAD']);
  });

  it('proxies HEAD as HEAD with no body', async () => {
    const pathname = '/Line/Mode/national-rail/Status';
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(null, { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    const res = await HEAD(makeRequest(pathname, { method: 'HEAD' }), {
      params: Promise.resolve({ path: segmentsOf(pathname) }),
    });
    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
    expect(res.headers.get('Cache-Control')).toBe(STATUS_CACHE_CONTROL);
    expect(upstreamCall().init.method).toBe('HEAD');
  });

  it('passes an api error through uncached, with Retry-After', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('busy', { status: 503, headers: { 'Content-Type': 'text/plain', 'Retry-After': '5' } }),
    );
    const res = await get('/Line/Mode/national-rail/Status');
    expect(res.status).toBe(503);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(res.headers.get('Retry-After')).toBe('5');
    expect(await res.text()).toBe('busy');
  });

  it('passes the api 404 for an unknown line through, uncached', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('no matching line(s): nope', { status: 404 }));
    const res = await get('/Line/nope/Status');
    expect(res.status).toBe(404);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  it('answers 502 when the api is unreachable and 504 on timeout', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError('fetch failed'));
    expect((await get('/Line/wcml/Status')).status).toBe(502);
    vi.mocked(fetch).mockRejectedValueOnce(Object.assign(new Error('t'), { name: 'TimeoutError' }));
    expect((await get('/Line/wcml/Status')).status).toBe(504);
  });

  it('links the attribution page and allows any origin to read', async () => {
    const res = await get('/Line/wcml/Status');
    expect(res.headers.get('Link')).toBe('</attribution>; rel="license"');
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });
});
