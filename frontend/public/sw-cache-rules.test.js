import { describe, it, expect } from 'vitest';
import cacheRules from './sw-cache-rules.js';

const {
  isCacheable,
  notificationClickClient,
  notificationOptions,
  parsePushPayload,
  pushNotification,
  sameOriginNotificationUrl,
  showsNotificationPage,
} = cacheRules;

describe('isCacheable', () => {
  it.each([
    ['/_next/static/chunks/main-abc123.js', true],
    ['/_next/static/css/app-def456.css', true],
    ['/icon-192.png', true],
    ['/icon-512.png', true],
    ['/manifest.webmanifest', true],
    ['/offline.html', true],
  ])('%s is cacheable', (pathname, expected) => {
    expect(isCacheable(pathname)).toBe(expected);
  });

  it.each([
    ['/', false],
    ['/lines/123', false],
    ['/api/preferences', false],
    ['/api/Train/track', false],
    // Close-but-not-actually-matching shapes, guarding against an
    // overly loose prefix/substring check rather than an exact
    // pathname comparison:
    ['/icon-192.png/evil', false],
    ['/notmanifest.webmanifest', false],
    ['/sw.js', false],
  ])('%s is NOT cacheable', (pathname, expected) => {
    expect(isCacheable(pathname)).toBe(expected);
  });
});

// FE-10
describe('notificationOptions', () => {
  it('passes the body, tag and url, and renotify only when asked with a tag', () => {
    expect(notificationOptions({ title: 't', body: 'b', tag: 'line-x', url: '/lines/x' })).toEqual({
      body: 'b',
      tag: 'line-x',
      data: { url: '/lines/x' },
    });
    expect(
      notificationOptions({ title: 't', body: 'b', tag: 'journey-leg-leave-11', url: '/journeys/7', renotify: true }),
    ).toEqual({ body: 'b', tag: 'journey-leg-leave-11', renotify: true, data: { url: '/journeys/7' } });
    // renotify without a tag would throw in showNotification.
    expect(notificationOptions({ title: 't', body: 'b', url: '/', renotify: true })).toEqual({
      body: 'b',
      data: { url: '/' },
    });
  });
});

describe('parsePushPayload', () => {
  it('returns the parsed object for a JSON payload', () => {
    expect(parsePushPayload({ json: () => ({ title: 't', url: '/lines/x' }) })).toEqual({
      title: 't',
      url: '/lines/x',
    });
  });

  it('returns null, not a throw, for a non-JSON payload', () => {
    expect(
      parsePushPayload({
        json: () => {
          throw new SyntaxError('Unexpected token');
        },
      }),
    ).toBeNull();
  });

  it('returns null for a missing payload or a non-object JSON value', () => {
    expect(parsePushPayload(null)).toBeNull();
    expect(parsePushPayload({ json: () => 'just a string' })).toBeNull();
    expect(parsePushPayload({ json: () => [1, 2] })).toBeNull();
    expect(parsePushPayload({ json: () => null })).toBeNull();
  });
});

describe('sameOriginNotificationUrl', () => {
  const origin = 'https://ds.example';

  it('resolves an app-relative path on this origin', () => {
    expect(sameOriginNotificationUrl('/lines/bakerloo', origin)).toBe('https://ds.example/lines/bakerloo');
  });

  it('accepts an absolute URL on this same origin', () => {
    expect(sameOriginNotificationUrl('https://ds.example/track/42', origin)).toBe('https://ds.example/track/42');
  });

  it.each(['https://evil.example/', '//evil.example/x', 'http://ds.example/', 'javascript:alert(1)'])(
    'refuses %s',
    (url) => {
      expect(sameOriginNotificationUrl(url, origin)).toBeNull();
    },
  );

  it('falls back to the site root for a missing or non-string url', () => {
    expect(sameOriginNotificationUrl(undefined, origin)).toBe('https://ds.example/');
    expect(sameOriginNotificationUrl(42, origin)).toBe('https://ds.example/');
  });
});

describe('showsNotificationPage', () => {
  const origin = 'https://ds.example';

  it('matches the page whatever the push adds as a query or hash', () => {
    expect(showsNotificationPage('https://ds.example/journeys/42', '/journeys/42?break=7&src=push#break', origin)).toBe(
      true,
    );
    expect(showsNotificationPage('https://ds.example/journeys/42?x=1', '/journeys/42', origin)).toBe(true);
  });

  it('does not match another page or another site', () => {
    expect(showsNotificationPage('https://ds.example/journeys/43', '/journeys/42', origin)).toBe(false);
    expect(showsNotificationPage('https://ds.example/journeys/42', 'https://evil.example/journeys/42', origin)).toBe(
      false,
    );
  });
});

// WebKit revokes a push subscription whose pushes show no notification, so
// every push shows one.
describe('pushNotification', () => {
  const origin = 'https://ds.example';
  const payload = { title: 'Lewes: delays', body: 'Up to 20 minutes', url: '/lines/x', tag: 'line-x', renotify: true };

  it('shows the payload as it is when no focused tab shows the page', () => {
    const clients = [
      { url: 'https://ds.example/lines/x', focused: false },
      { url: 'https://ds.example/lines/y', focused: true },
    ];
    expect(pushNotification(payload, clients, origin)).toEqual({
      title: 'Lewes: delays',
      options: { body: 'Up to 20 minutes', tag: 'line-x', renotify: true, data: { url: '/lines/x' } },
    });
  });

  it('shows it silently, rather than not at all, when a focused tab already shows the page', () => {
    const clients = [{ url: 'https://ds.example/lines/x?tab=1', focused: true }];
    expect(pushNotification(payload, clients, origin)).toEqual({
      title: 'Lewes: delays',
      options: { body: 'Up to 20 minutes', tag: 'line-x', silent: true, data: { url: '/lines/x' } },
    });
  });

  it('shows a generic notification for a missing or titleless payload', () => {
    for (const bad of [null, { body: 'no title' }, { title: 42 }]) {
      const { title, options } = pushNotification(bad, [], origin);
      expect(title).toBe('Distant Signal');
      expect(options.body).toBe('There is an update. Open the app to see it.');
      expect(options.data).toEqual({ url: '/' });
    }
  });
});

// A click used to open a new window every time.
describe('notificationClickClient', () => {
  const origin = 'https://ds.example';

  it('prefers a window already at the link, then one on the same page', () => {
    const exact = { url: 'https://ds.example/journeys/42?break=7', id: 'exact' };
    const samePage = { url: 'https://ds.example/journeys/42', id: 'same' };
    const other = { url: 'https://ds.example/lines', id: 'other' };
    const target = 'https://ds.example/journeys/42?break=7';
    expect(notificationClickClient([other, samePage, exact], target, origin)).toBe(exact);
    expect(notificationClickClient([other, samePage], target, origin)).toBe(samePage);
  });

  it('returns null when no window shows that page, so the click opens one', () => {
    expect(
      notificationClickClient([{ url: 'https://ds.example/lines' }], 'https://ds.example/journeys/42', origin),
    ).toBe(null);
    expect(notificationClickClient([], 'https://ds.example/', origin)).toBe(null);
  });
});
