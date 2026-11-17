// Plain, dependency-free JS -- deliberately no `import`/`export` syntax.
// This file is loaded two different ways that disagree on module syntax:
// sw.js (Task 4) loads it via the classic importScripts(), which throws a
// SyntaxError on any top-level `export`/`import` keyword (this app's
// service worker must stay a classic, non-module script -- Firefox does
// not support `type: 'module'` service workers as of this writing, unlike
// Chrome/Edge/Safari; see this plan's Global Constraints). This test file
// loads it as a CommonJS-shaped module via Vitest/Vite's own CJS-interop.
// The two conditional assignments below satisfy both call sites from one
// shared file, with no build step for either.
//
// See docs/superpowers/specs/2026-09-02-pwa-service-worker-design.md
// Decision 1 -- default-deny, allowlist-only. Forgetting to add a new
// static asset here is a cache miss (safe, caught immediately in
// testing); it can never mean live content gets cached by omission,
// because nothing here is a blocklist.

/**
 * @param {string} pathname - a URL's pathname, e.g. new URL(request.url).pathname
 * @returns {boolean} true only for the five cache-first-cacheable URL
 *   shapes; false for everything else, including every navigation/
 *   RSC-refresh request and every /api/* call.
 */
function isCacheable(pathname) {
  if (pathname.startsWith('/_next/static/')) return true;
  return (
    pathname === '/icon-192.png' ||
    pathname === '/icon-512.png' ||
    pathname === '/manifest.webmanifest' ||
    pathname === '/offline.html'
  );
}

// The two push helpers below live here, not in sw.js, only because this is
// the one service-worker file that is also loadable by the unit tests (and
// already served/no-cached by proxy.ts and next.config.mjs). FE-10.

/**
 * Parses a push message's payload, returning null (never throwing) for one
 * that isn't a JSON object.
 * @param {{ json(): unknown } | null | undefined} data - a PushEvent's `data`
 * @returns {Record<string, unknown> | null}
 */
function parsePushPayload(data) {
  if (!data) return null;
  try {
    const parsed = data.json();
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
      ? /** @type {Record<string, unknown>} */ (parsed)
      : null;
  } catch {
    return null;
  }
}

/**
 * Resolves a notification's `url` (documented as app-relative) against this
 * site's origin, returning the absolute URL only when it stays on that
 * origin -- a push naming `https://evil.example` or `//evil.example` opens
 * nothing. Anything unparseable or non-string falls back to the site root.
 * @param {unknown} url
 * @param {string} origin - `self.location.origin`
 * @returns {string | null}
 */
function sameOriginNotificationUrl(url, origin) {
  if (typeof url !== 'string' || url === '') return `${origin}/`;
  let resolved;
  try {
    resolved = new URL(url, origin);
  } catch {
    return `${origin}/`;
  }
  return resolved.origin === origin ? resolved.href : null;
}

/**
 * Whether a window open at `clientUrl` already shows the page a
 * notification's `url` opens: the same pathname, whatever the query or
 * hash. A suggestion push links to `/journeys/42?break=7&src=push#break`;
 * a tab already on `/journeys/42` shows the in-app banner instead (mid-
 * journey changes spec 2026-10-22 §6.4).
 * @param {string} clientUrl
 * @param {unknown} url
 * @param {string} origin - `self.location.origin`
 * @returns {boolean}
 */
function showsNotificationPage(clientUrl, url, origin) {
  const target = sameOriginNotificationUrl(url, origin);
  if (target === null) return false;
  try {
    return new URL(clientUrl).pathname === new URL(target).pathname;
  } catch {
    return false;
  }
}

/**
 * The `showNotification` options for a push payload: its body, tag and
 * URL, and `renotify` when the payload asks for it (a moved leave-by, so
 * the replacement alerts again). `renotify` needs a tag, so it is only set
 * with one.
 * @param {Record<string, unknown>} payload - a parsed push payload
 * @returns {{ body: string, tag?: string, renotify?: boolean, data: { url: unknown } }}
 */
function notificationOptions(payload) {
  /** @type {{ body: string, tag?: string, renotify?: boolean, data: { url: unknown } }} */
  const options = { body: typeof payload.body === 'string' ? payload.body : '', data: { url: payload.url } };
  if (typeof payload.tag === 'string' && payload.tag !== '') {
    options.tag = payload.tag;
    if (payload.renotify === true) options.renotify = true;
  }
  return options;
}

/** Title and body for a push with no usable payload. */
const FALLBACK_NOTIFICATION_TITLE = 'Distant Signal';
const FALLBACK_NOTIFICATION_BODY = 'There is an update. Open the app to see it.';

/**
 * The notification to show for a push, always one: WebKit (Safari and iOS
 * home-screen apps) requires every push to show a notification and revokes
 * the subscription after repeated pushes that show none. So a push with no
 * usable payload shows a generic notice, and a push for the page a focused
 * tab already shows (AutoRefresh keeps that tab fresh) shows quietly
 * (`silent`, no `renotify`) instead of being skipped.
 * @param {Record<string, unknown> | null} payload - `parsePushPayload`'s result
 * @param {readonly { url: string, focused: boolean }[]} clientList - the open windows
 * @param {string} origin - `self.location.origin`
 * @returns {{ title: string, options: { body: string, tag?: string, renotify?: boolean, silent?: boolean, data: { url: unknown } } }}
 */
function pushNotification(payload, clientList, origin) {
  if (!payload || typeof payload.title !== 'string') {
    return {
      title: FALLBACK_NOTIFICATION_TITLE,
      options: { body: FALLBACK_NOTIFICATION_BODY, tag: 'distant-signal-update', data: { url: '/' } },
    };
  }
  /** @type {{ body: string, tag?: string, renotify?: boolean, silent?: boolean, data: { url: unknown } }} */
  const options = notificationOptions(payload);
  const alreadyShown = clientList.some(
    (client) => client.focused && showsNotificationPage(client.url, payload.url, origin),
  );
  if (alreadyShown) {
    delete options.renotify;
    options.silent = true;
  }
  return { title: payload.title, options };
}

/**
 * The open window a notification click should bring forward instead of
 * opening another: one already at `target`, else one showing the same page
 * (whatever its query or hash), else null.
 * @template {{ url: string }} C
 * @param {readonly C[]} clientList - the open windows
 * @param {string} target - `sameOriginNotificationUrl`'s absolute URL
 * @param {string} origin - `self.location.origin`
 * @returns {C | null}
 */
function notificationClickClient(clientList, target, origin) {
  return (
    clientList.find((client) => client.url === target) ??
    clientList.find((client) => showsNotificationPage(client.url, target, origin)) ??
    null
  );
}

if (typeof self !== 'undefined') {
  self.isCacheable = isCacheable;
  self.notificationClickClient = notificationClickClient;
  self.pushNotification = pushNotification;
  self.notificationOptions = notificationOptions;
  self.parsePushPayload = parsePushPayload;
  self.sameOriginNotificationUrl = sameOriginNotificationUrl;
  self.showsNotificationPage = showsNotificationPage;
}
// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- TypeScript assumes CommonJS `module.exports` always exists; kept as a runtime guard
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    isCacheable,
    notificationClickClient,
    notificationOptions,
    pushNotification,
    parsePushPayload,
    sameOriginNotificationUrl,
    showsNotificationPage,
  };
}
