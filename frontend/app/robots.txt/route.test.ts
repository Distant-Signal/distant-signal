import { describe, it, expect, afterEach } from 'vitest';
import { GET } from './route';

const get = (headers?: Record<string, string>): Response =>
  GET(new Request('http://localhost/robots.txt', headers ? { headers } : {}));

describe('GET /robots.txt', () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
  });

  it('renders per request, so the runtime NEXT_PUBLIC_SITE_URL is used rather than a build-time value', async () => {
    const { dynamic } = await import('./route');
    expect(dynamic).toBe('force-dynamic');
  });

  it('reads NEXT_PUBLIC_SITE_URL at call time, trimming a trailing slash', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://ds.example/';
    const body = await get().text();
    expect(body).toContain('\nHost: https://ds.example\n');
    expect(body.endsWith('Sitemap: https://ds.example/sitemap.xml\n')).toBe(true);
  });

  it('omits Host and Sitemap when NEXT_PUBLIC_SITE_URL is unset', async () => {
    const body = await get().text();
    expect(body).not.toMatch(/^(Host|Sitemap):/m);
    expect(body).not.toContain('undefined');
  });

  it('is text/plain with the rules in Next-compatible layout', async () => {
    const response = get();
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/plain; charset=utf-8');
    const body = await response.text();
    expect(body.startsWith('User-Agent: *\nAllow: /\nDisallow: /api/\n')).toBe(true);
    expect(body).toContain('User-Agent: GPTBot\nUser-Agent: ClaudeBot\n');
    expect(body).toMatch(/Disallow: \/\n\n/);
  });

  it('is stable across requests: same body, same ETag, no Last-Modified', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://ds.example';
    const [a, b] = [get(), get()];
    expect(await a.text()).toBe(await b.text());
    expect(a.headers.get('etag')).toMatch(/^"[\w-]{27}"$/);
    expect(a.headers.get('etag')).toBe(b.headers.get('etag'));
    expect(a.headers.get('last-modified')).toBeNull();
  });

  it('changes the ETag when the origin changes', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://a.example';
    const a = get().headers.get('etag');
    process.env.NEXT_PUBLIC_SITE_URL = 'https://b.example';
    expect(get().headers.get('etag')).not.toBe(a);
  });

  it('answers a matching If-None-Match with an empty 304 (strong, weak, listed or *)', async () => {
    const etag = get().headers.get('etag') ?? '';
    for (const value of [etag, `W/${etag}`, `"other", ${etag}`, '*']) {
      const response = get({ 'If-None-Match': value });
      expect(response.status).toBe(304);
      expect(response.headers.get('etag')).toBe(etag);
      expect(await response.text()).toBe('');
    }
  });

  it('answers a non-matching If-None-Match with the full body', () => {
    expect(get({ 'If-None-Match': '"nope"' }).status).toBe(200);
  });
});
