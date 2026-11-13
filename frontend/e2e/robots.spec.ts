import { test, expect } from '@playwright/test';

test('/robots.txt is served as text/plain with the expected rules', async ({ request }) => {
  const response = await request.get('/robots.txt');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toMatch(/^text\/plain/);

  const body = await response.text();
  expect(body).toContain('User-Agent: *');
  expect(body).toContain('Disallow: /api/');
  expect(body).toContain('Disallow: /journeys/');
  expect(body).toContain('Disallow: /groups');
  expect(body).toContain('User-Agent: GPTBot');
  expect(body).not.toContain('undefined');
});

test('/robots.txt is cacheable at the edge, stable across requests and revalidates with a 304', async ({ request }) => {
  const first = await request.get('/robots.txt');
  const second = await request.get('/robots.txt');
  expect(first.headers()['cache-control']).toBe(
    'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400, stale-if-error=604800',
  );
  expect(first.headers()['last-modified']).toBeUndefined();
  const etag = first.headers().etag ?? '';
  expect(etag).not.toBe('');
  expect(second.headers().etag).toBe(etag);
  expect(await second.text()).toBe(await first.text());

  const conditional = await request.get('/robots.txt', { headers: { 'If-None-Match': etag } });
  expect(conditional.status()).toBe(304);
  expect(await conditional.text()).toBe('');
});
