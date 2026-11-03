import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import * as route from './route';
import { STATUS_CACHE_CONTROL } from '@/lib/tflPublicApi';

const { GET } = route;

function call(crs: string, headers: Record<string, string> = {}): Promise<Response> {
  return GET(new NextRequest(`http://localhost:3000/StopPoint/${encodeURIComponent(crs)}/Disruption`, { headers }), {
    params: Promise.resolve({ crs }),
  });
}

describe('/StopPoint/[crs]/Disruption public route', () => {
  beforeEach(() => {
    vi.stubEnv('API_BASE_URL', 'http://test-api:8080');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } })),
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('serves a CRS anonymously from the api, cached as status', async () => {
    const res = await call('eus', { cookie: 'distant_signal_session=abc', authorization: 'Bearer x' });
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe(STATUS_CACHE_CONTROL);
    expect(await res.json()).toEqual([]);
    const [url, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(String(url)).toBe('http://test-api:8080/StopPoint/EUS/Disruption');
    expect((init as { headers: Record<string, string> }).headers).toEqual({ Accept: 'application/json' });
  });

  it.each(['EU', 'EUSX', '..', 'E/S', 'EU%', '940GZZLUVIC', 'EU\u0000'])('refuses %j', async (crs) => {
    const res = await call(crs);
    expect(res.status).toBe(404);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('exports GET and HEAD only', () => {
    const methods = Object.keys(route).filter((name) => /^[A-Z]+$/.test(name));
    expect(methods.sort()).toEqual(['GET', 'HEAD']);
  });
});
