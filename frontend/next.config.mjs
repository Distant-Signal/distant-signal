import { computeBuildId } from './scripts/build-id.mjs';
import { BUILD_EPOCH } from './scripts/build-epoch.mjs';

// Computed once: both the Next build id and the id the browser sends on its
// api calls (`NEXT_PUBLIC_BUILD_ID`, lib/buildId.ts).
const buildId = computeBuildId(import.meta.dirname);

// Origins `next dev` accepts cross-origin dev requests (HMR, the dev
// overlay, /_next/* assets) from. Supplied by docker-compose.dev.yml from
// NEXT_ALLOWED_DEV_ORIGINS in `dev.env` — comma-separated — rather than
// hardcoded, because the value that Next asks for is a Compose bridge IP
// that changes every time the network is recreated.
//
// Empty (the default) means the key is omitted from the config entirely,
// which is what you want for plain http://localhost:3000 browsing; setting
// `allowedDevOrigins: []` is not the same thing.
const devOrigins = (process.env.NEXT_ALLOWED_DEV_ORIGINS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

// The page Content-Security-Policy is built per request, with a nonce, by
// proxy.ts (see lib/csp.ts for the policy and why). This file only covers
// the paths proxy.ts's matcher skips that still need a policy of their own.
// Next merges headers from every matching `headers()` entry, so none of
// these sources may overlap a path proxy.ts handles: two CSP headers are
// both enforced, and a nonce-less one would block the page's scripts.
//
// Shared by the static policies below. Same non-script directives as
// lib/csp.ts's page policy, minus the Anthropic/railMcp `connect-src`
// entries: neither the service worker nor the offline page talks to them.
const STATIC_BASE_DIRECTIVES = [
  "default-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-src 'none'",
  "worker-src 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
];

// `/sw.js` (and the `/sw-cache-rules.js` it `importScripts`): a service
// worker's own response CSP governs the worker, including its `fetch()`es.
// It runs no inline script.
const SERVICE_WORKER_CSP = [...STATIC_BASE_DIRECTIVES, "script-src 'self'", "style-src 'self'"].join('; ');

// `/offline.html`: a static file the service worker serves when a
// navigation fails. It has an inline `<script>` and an inline `onclick`, and
// no nonce can be stamped on a static file, so it keeps `'unsafe-inline'`.
// It renders no request-derived content, so nothing can be injected into it.
const OFFLINE_PAGE_CSP = [
  ...STATIC_BASE_DIRECTIVES,
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
].join('; ');

// Referrer-Policy for every response, and the stricter one for the pages
// whose path carries a share or invite token (see headers()).
const REFERRER_POLICY = 'strict-origin-when-cross-origin';
const TOKEN_PAGE_REFERRER_POLICY = 'no-referrer';
const TOKEN_PAGE_SOURCES = ['/journeys/shared/:token*', '/groups/join/:token*'];

// Hardening headers for every response (see headers()).
// Permissions-Policy denies the powerful features the app never uses. It
// uses `geolocation` (the station search's "near me" button, same-origin
// only), so that one is kept for `self`. Web Push and notifications are not
// Permissions-Policy features, nor is the clipboard-write the share and copy
// buttons use, so none is listed.
const PERMISSIONS_POLICY = [
  'accelerometer=()',
  'browsing-topics=()',
  'camera=()',
  'display-capture=()',
  'geolocation=(self)',
  'gyroscope=()',
  'hid=()',
  'magnetometer=()',
  'microphone=()',
  'midi=()',
  'payment=()',
  'serial=()',
  'usb=()',
].join(', ');
// No popups or window handles are used: sign-in is a plain top-level
// redirect to the identity provider and back, and every `target="_blank"`
// link is `noopener`, so the stricter opener policy changes nothing.
const CROSS_ORIGIN_OPENER_POLICY = 'same-origin';
// Other sites may not embed this site's resources (no-cors), except the
// link-preview and social images, which chat apps and crawlers fetch from
// anywhere (see headers()).
const CORP_SAME_SITE = 'same-site';
const CORP_CROSS_ORIGIN = 'cross-origin';

// Cache-Control values for the static path classes (see headers()).
const CACHE_NO_CACHE = 'no-cache';
const CACHE_UNHASHED_ASSET = 'public, max-age=86400, stale-while-revalidate=604800';
// The offline page is precached by the service worker; browsers only need it
// when the worker is not in play, and it should follow a deploy quickly.
const CACHE_OFFLINE_PAGE = 'public, max-age=300';

// Un-hashed static assets: `public/` files and the `app/` metadata routes
// (`icon.svg`, `apple-icon.png`, `manifest.ts`). /robots.txt and /sitemap.xml
// have their own rules below.
const UNHASHED_ASSET_SOURCES = [
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-512.png',
  '/opengraph-image.png',
  '/icon.svg',
  '/apple-icon.png',
  '/manifest.webmanifest',
];

// `/api/*`: the backend proxy. It returns JSON and redirects, never a page,
// so if a response were ever rendered as a document it should be able to do
// nothing at all.
const API_CSP = ["default-src 'none'", "frame-ancestors 'none'", "base-uri 'none'", "form-action 'none'"].join('; ');

// Cloudflare is in front of the (single-replica) origin
// and caches by these headers. Without them Google's robots.txt fetches
// always reached the origin, which rolls often, and Google reported
// intermittent fetch failures. `stale-if-error` keeps serving the last good
// copy while the origin is down or restarting.
//
// robots.txt is a pure function of NEXT_PUBLIC_SITE_URL, so a day at the
// edge is safe.
const ROBOTS_CACHE_CONTROL =
  'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400, stale-if-error=604800';
// The sitemap falls back to no station URLs when the api's station index
// call fails (app/sitemap.ts), so serving a stale copy on error, or caching
// that thin copy for a day, could pin an incomplete sitemap at the edge. It
// gets a one-hour `s-maxage` (and the same stale windows) so a bad copy
// heals within the hour once the api is back.
const SITEMAP_CACHE_CONTROL =
  'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400, stale-if-error=604800';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Emits `.next/standalone` -- a traced, minimal dependency tree (only
  // what the built app actually imports, not the full `npm ci` output)
  // plus a self-contained `server.js` entrypoint -- so frontend/Dockerfile's
  // runtime-prod stage can ship a much smaller final image than copying
  // the whole node_modules directory in. Two things this mode does NOT
  // bundle automatically (both documented Next.js gotchas): `.next/static`
  // and `public/` -- the Dockerfile copies both in manually alongside
  // `.next/standalone`. No custom server, no monorepo/workspace root here,
  // so none of `output: 'standalone'`'s other edge cases (custom
  // `outputFileTracingRoot`, workspace-relative tracing) apply.
  output: 'standalone',
  // No `X-Powered-By: Next.js`.
  poweredByHeader: false,
  // A hash of the frontend's inputs (scripts/build-id.mjs), not Next's
  // random default: the build ID is stamped into public/sw.js, so a random
  // one made every deploy install a new service worker and drop its
  // caches, and made every image build differ. Now both change only when
  // frontend/ does.
  generateBuildId: () => buildId,
  // Inlined into the browser bundle: the build id, sent as `X-DS-Build` on
  // api calls so the proxy can count requests per build (lib/buildMix.ts).
  // The build epoch rides along for the reload hint (lib/buildEpoch.ts).
  env: { NEXT_PUBLIC_BUILD_ID: buildId, NEXT_PUBLIC_BUILD_EPOCH: String(BUILD_EPOCH) },
  ...(devOrigins.length ? { allowedDevOrigins: devOrigins } : {}),
  // The Journeys page (`app/journeys/page.tsx`) was the Track page at
  // `/track/mine` until DS-115 (21 Oct 2026), and before that
  // `/track/tickets` was a tickets list of its own, until Part B of the
  // upload-first ticket-tracking plan merged it into `/track/mine`.
  // Config-level permanent redirects (not rendered stub pages) keep
  // bookmarks and shared links to either old path working. Both go straight
  // to `/journeys`, never through each other, so no visitor takes two hops.
  // `/track/mine/add-ticket` keeps its URL: a `source` with no wildcard
  // matches its one path only.
  // eslint-disable-next-line @typescript-eslint/require-await -- NextConfig types redirects() as returning a Promise
  async redirects() {
    return [
      {
        source: '/track/mine',
        destination: '/journeys',
        permanent: true,
      },
      {
        source: '/track/tickets',
        destination: '/journeys',
        permanent: true,
      },
      // "New journey" (`/journeys/new`) merged into "Plan a journey"
      // (`/plan`) in DS-194. Next passes the query through unchanged, and
      // `/plan` reads every parameter the old page did (`?mode=`,
      // `?fromTflStop=`), so old links and bookmarks open the same option.
      {
        source: '/journeys/new',
        destination: '/plan',
        permanent: true,
      },
      // Journey templates became "Regular journeys" (regular journeys
      // design §4.4, 2026-11-06): the list and each template's page moved,
      // and old links and bookmarks follow. The id is digits or an `r_` id,
      // as the page takes.
      {
        source: '/journeys/templates',
        destination: '/journeys/regular',
        permanent: true,
      },
      {
        source: '/journeys/templates/:id(\\d+|r_[0-9a-f]+)',
        destination: '/journeys/regular/:id',
        permanent: true,
      },
      // Train pushes linked to `/track/{id}`, a page that never existed,
      // until 22 Oct 2026; this keeps the links already sent working.
      {
        source: '/track/:trackingId(\\d+|t_[0-9a-f]+)',
        destination: '/train/by-id/:trackingId',
        permanent: true,
      },
    ];
  },
  // Cache-Control for the static paths. Next sends `max-age=0` for `public/`
  // files and the metadata routes, which Cloudflare's zone-wide Browser
  // Cache TTL (4 hours by default) overrides, so every one of them got a
  // 14400 at the browser. Each class now states its own lifetime, and the
  // zone's Browser Cache TTL is set to "Respect origin" so these reach the
  // browser as written. /_next/static/* is already `public, max-age=31536000,
  // immutable` (hashed file names) and is left to Next.
  //
  // /sw.js's own byte content changes whenever the frontend does (scripts/
  // stamp-sw-version.mjs stamps the BUILD_ID into it) -- an
  // aggressively browser-HTTP-cached response could mask that from the
  // browser's own service-worker update check, which re-fetches this URL
  // on every navigation and does a byte-for-byte comparison. `no-cache`
  // (not `no-store`) still permits a cheap conditional revalidation
  // request (Next sends an ETag, so an unchanged worker answers 304)
  // rather than forcing a full re-download every time, while
  // guaranteeing the browser never trusts a locally-cached copy without
  // checking. The same goes for /sw-cache-rules.js, which the worker
  // `importScripts`: a stale copy would run against a new worker. See
  // docs/superpowers/specs/2026-09-02-pwa-service-worker-design.md
  // Decision 5, point 4. Cloudflare sits in front of the app and obeys the
  // `Cache-Control` the app sends, so a header set here is the CDN's
  // caching rule too (see ROBOTS_CACHE_CONTROL above).
  //
  // Not hashed, so cacheable for a day with a week of stale-while-revalidate:
  // the icons, the manifest and the social image change rarely and nothing
  // breaks if a browser shows the old one for a day.
  // eslint-disable-next-line @typescript-eslint/require-await -- NextConfig types headers() as returning a Promise
  async headers() {
    return [
      // Referrer-Policy: stated rather than left to the browser default, and
      // `no-referrer` on the pages whose URL is a bearer token (a shared
      // journey link, a group invite), so the token never goes out in a
      // Referer, to this site's own requests or to a link the page opens.
      // Order matters: Next lets the later matching entry win a key.
      {
        source: '/:path*',
        headers: [
          { key: 'Referrer-Policy', value: REFERRER_POLICY },
          { key: 'Permissions-Policy', value: PERMISSIONS_POLICY },
          { key: 'Cross-Origin-Opener-Policy', value: CROSS_ORIGIN_OPENER_POLICY },
          { key: 'Cross-Origin-Resource-Policy', value: CORP_SAME_SITE },
        ],
      },
      ...TOKEN_PAGE_SOURCES.map((source) => ({
        source,
        headers: [{ key: 'Referrer-Policy', value: TOKEN_PAGE_REFERRER_POLICY }],
      })),
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: CACHE_NO_CACHE },
          { key: 'Content-Security-Policy', value: SERVICE_WORKER_CSP },
        ],
      },
      // Keep in sync with proxy.ts's matcher: these are the paths it skips.
      {
        source: '/sw-cache-rules.js',
        headers: [
          { key: 'Cache-Control', value: CACHE_NO_CACHE },
          { key: 'Content-Security-Policy', value: SERVICE_WORKER_CSP },
        ],
      },
      {
        source: '/offline.html',
        headers: [
          { key: 'Cache-Control', value: CACHE_OFFLINE_PAGE },
          { key: 'Content-Security-Policy', value: OFFLINE_PAGE_CSP },
        ],
      },
      ...UNHASHED_ASSET_SOURCES.map((source) => ({
        source,
        headers: [{ key: 'Cache-Control', value: CACHE_UNHASHED_ASSET }],
      })),
      {
        source: '/api/:path*',
        headers: [{ key: 'Content-Security-Policy', value: API_CSP }],
      },
      // Link-preview images (`.../card.png`, lib/livePreview.ts): proxy.ts
      // skips them, and a PNG should be able to do nothing if a browser ever
      // rendered it as a document. Their Cache-Control is the route's own.
      {
        source: '/:path*/card.png',
        headers: [
          { key: 'Content-Security-Policy', value: API_CSP },
          { key: 'Cross-Origin-Resource-Policy', value: CORP_CROSS_ORIGIN },
        ],
      },
      // The `opengraph-image` metadata routes: proxy.ts skips them too, and
      // their 404 (a route that has no image) is a plain response that
      // would otherwise carry no policy at all.
      ...['/:path*/opengraph-image', '/:path*/opengraph-image-:hash'].map((source) => ({
        source,
        headers: [
          { key: 'Content-Security-Policy', value: API_CSP },
          { key: 'Cross-Origin-Resource-Policy', value: CORP_CROSS_ORIGIN },
        ],
      })),
      {
        source: '/opengraph-image.png',
        headers: [{ key: 'Cross-Origin-Resource-Policy', value: CORP_CROSS_ORIGIN }],
      },
      {
        source: '/robots.txt',
        headers: [{ key: 'Cache-Control', value: ROBOTS_CACHE_CONTROL }],
      },
      {
        source: '/sitemap.xml',
        headers: [{ key: 'Cache-Control', value: SITEMAP_CACHE_CONTROL }],
      },
    ];
  },
};

export default nextConfig;
