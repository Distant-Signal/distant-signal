import { computeBuildId } from './scripts/build-id.mjs';

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

// `/api/*`: the backend proxy. It returns JSON and redirects, never a page,
// so if a response were ever rendered as a document it should be able to do
// nothing at all.
// Cache-Control values for the static path classes (see headers()).
const CACHE_NO_CACHE = 'no-cache';
const CACHE_UNHASHED_ASSET = 'public, max-age=86400, stale-while-revalidate=604800';
// The offline page is precached by the service worker; browsers only need it
// when the worker is not in play, and it should follow a deploy quickly.
const CACHE_OFFLINE_PAGE = 'public, max-age=300';

// Un-hashed static assets: `public/` files and the `app/` metadata routes
// (`icon.svg`, `apple-icon.png`, `manifest.ts`). /robots.txt and /sitemap.xml
// are deliberately not here.
const UNHASHED_ASSET_SOURCES = [
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-512.png',
  '/opengraph-image.png',
  '/icon.svg',
  '/apple-icon.png',
  '/manifest.webmanifest',
];

const API_CSP = ["default-src 'none'", "frame-ancestors 'none'", "base-uri 'none'", "form-action 'none'"].join('; ');

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
  // A hash of the frontend's inputs (scripts/build-id.mjs), not Next's
  // random default: the build ID is stamped into public/sw.js, so a random
  // one made every deploy install a new service worker and drop its
  // caches, and made every image build differ. Now both change only when
  // frontend/ does.
  generateBuildId: () => computeBuildId(import.meta.dirname),
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
      // and old links and bookmarks follow. The id takes digits only, as
      // the page does.
      {
        source: '/journeys/templates',
        destination: '/journeys/regular',
        permanent: true,
      },
      {
        source: '/journeys/templates/:id(\\d+)',
        destination: '/journeys/regular/:id',
        permanent: true,
      },
      // Train pushes linked to `/track/{id}`, a page that never existed,
      // until 22 Oct 2026; this keeps the links already sent working.
      {
        source: '/track/:trackingId(\\d+)',
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
  // Decision 5, point 4. A CDN in front must not rewrite this: it has to
  // respect the origin's Cache-Control rather than apply its own TTL.
  //
  // Not hashed, so cacheable for a day with a week of stale-while-revalidate:
  // the icons, the manifest and the social image change rarely and nothing
  // breaks if a browser shows the old one for a day.
  // eslint-disable-next-line @typescript-eslint/require-await -- NextConfig types headers() as returning a Promise
  async headers() {
    return [
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
    ];
  },
};

export default nextConfig;
