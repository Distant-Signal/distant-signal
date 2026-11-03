import { clientIpFromHeaders, REAL_IP_HEADER } from '@/lib/clientIp';
import { createLogger } from '@/lib/logger';

/** The public, anonymous, TfL-shaped read API (docs/public-api.md): the
 * api's `/Line/...` and `/StopPoint/{crs}/Disruption` routes
 * (`crates/api/src/routes/line_status.rs`), served on this site at the same
 * paths by `app/Line/[...path]/route.ts` and
 * `app/StopPoint/[crs]/Disruption/route.ts`.
 *
 * Not the `/api/*` proxy: that one forwards the session cookie, and these
 * routes show a signed-in caller their private custom lines. Here nothing
 * identifying reaches the api -- no cookie, no Authorization, no
 * User-Agent -- so every caller gets the anonymous answer and a shared
 * cache may keep it. Only `X-Real-IP` is sent, so the api's per-IP rate
 * limits still apply.
 *
 * Default-deny: a request is forwarded only when its path matches one of
 * the route shapes below, segment by segment, against a strict pattern.
 * The upstream URL is rebuilt from the validated segments, so a decoded
 * `/`, `..`, `?` or `#` (from `%2F`, `%2e%2e`, ...) never matches and never
 * reaches the api. */

/** How long a status answer may be served from a shared cache: the
 * aggregator recomputes line status every cycle, so about half a minute. */
export const STATUS_CACHE_CONTROL = 'public, s-maxage=30, stale-while-revalidate=30';

/** History and statistics change only as new cycles are rolled up. */
export const HISTORY_CACHE_CONTROL = 'public, s-maxage=60, stale-while-revalidate=300';

/** Errors and refusals are never cached. */
export const NO_STORE = 'no-store';

/** How long to wait on the api, covering headers and body. */
export const PUBLIC_UPSTREAM_TIMEOUT_MS = 15_000;

/** Where the credits each response element's `attribution` names are
 * explained in full. */
export const ATTRIBUTION_LINK = '</attribution>; rel="license"';

const MAX_LIST_LENGTH = 512;
const LIST_OF_IDS = /^[a-z0-9-]+(?:,[a-z0-9-]+)*$/;
const LINE_ID = /^[a-z0-9-]{1,128}$/;
const MODE_LIST = /^[a-z-]+(?:,[a-z-]+)*$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})$/;
const CRS = /^[A-Za-z]{3}$/;

type Matcher = (segment: string) => boolean;

const literal =
  (expected: string): Matcher =>
  (segment) =>
    segment === expected;
const pattern =
  (re: RegExp): Matcher =>
  (segment) =>
    segment.length <= MAX_LIST_LENGTH && re.test(segment);

interface RouteShape {
  segments: readonly Matcher[];
  cacheControl: string;
  /** Whether `?detail=` is forwarded (the status routes). */
  detail: boolean;
}

const ID = pattern(LINE_ID);
const D = pattern(DATE);
const T = pattern(INSTANT);
const TO = literal('to');
const STATS = literal('Stats');

/** Every `/Line/...` shape served, without the leading `Line`. */
const LINE_ROUTES: readonly RouteShape[] = [
  {
    segments: [literal('Mode'), pattern(MODE_LIST), literal('Status')],
    cacheControl: STATUS_CACHE_CONTROL,
    detail: true,
  },
  { segments: [pattern(LIST_OF_IDS), literal('Status')], cacheControl: STATUS_CACHE_CONTROL, detail: true },
  { segments: [ID, literal('Status'), T, TO, T], cacheControl: HISTORY_CACHE_CONTROL, detail: false },
  { segments: [ID, STATS, D, TO, D], cacheControl: HISTORY_CACHE_CONTROL, detail: false },
  { segments: [ID, STATS, literal('HalfHourly'), T, TO, T], cacheControl: HISTORY_CACHE_CONTROL, detail: false },
  { segments: [ID, STATS, literal('Hourly'), T, TO, T], cacheControl: HISTORY_CACHE_CONTROL, detail: false },
  { segments: [ID, STATS, literal('SixHourly'), T, TO, T], cacheControl: HISTORY_CACHE_CONTROL, detail: false },
  { segments: [ID, STATS, literal('Coverage'), D, TO, D], cacheControl: HISTORY_CACHE_CONTROL, detail: false },
  {
    segments: [ID, STATS, literal('Coverage'), literal('HalfHourly'), T, TO, T],
    cacheControl: HISTORY_CACHE_CONTROL,
    detail: false,
  },
];

/** A validated request: the api path to fetch and how to cache it. */
export interface PublicTflTarget {
  /** Path and query on the api, e.g. `/Line/Mode/national-rail/Status`. */
  path: string;
  cacheControl: string;
}

function detailQuery(search: URLSearchParams): string {
  const detail = search.get('detail');
  return detail === 'true' ? '?detail=true' : '';
}

/** The api target for `/Line/<segments>`, or null when the path is not one
 * of the served shapes. Segments are as Next hands them over (decoded). */
export function matchLineRoute(segments: readonly string[], search: URLSearchParams): PublicTflTarget | null {
  const route = LINE_ROUTES.find(
    (shape) =>
      shape.segments.length === segments.length && shape.segments.every((matches, i) => matches(segments[i] ?? '')),
  );
  if (!route) return null;
  const path = `/Line/${segments.map(encodeURIComponent).join('/')}`;
  return { path: route.detail ? path + detailQuery(search) : path, cacheControl: route.cacheControl };
}

/** The api target for `/StopPoint/<crs>/Disruption`, or null. */
export function matchStopPointRoute(crs: string): PublicTflTarget | null {
  if (!CRS.test(crs)) return null;
  return { path: `/StopPoint/${crs.toUpperCase()}/Disruption`, cacheControl: STATUS_CACHE_CONTROL };
}

function plain(status: number, message: string): Response {
  return new Response(message, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': NO_STORE },
  });
}

function isTimeout(err: unknown): boolean {
  const name = typeof err === 'object' && err !== null ? (err as { name?: unknown }).name : undefined;
  return name === 'TimeoutError' || name === 'AbortError';
}

/** Fetches `target` from the api anonymously and relays its status and
 * body. `method` is GET or HEAD; the route files export nothing else, so
 * Next answers any other method with 405. */
export async function servePublicTfl(
  method: 'GET' | 'HEAD',
  incoming: Pick<Headers, 'get'>,
  target: PublicTflTarget | null,
): Promise<Response> {
  if (target === null) return plain(404, 'not found');

  // Built from scratch: no Cookie, no Authorization, nothing else the
  // caller sent.
  const headers: Record<string, string> = { Accept: 'application/json' };
  const realIp = clientIpFromHeaders(incoming);
  if (realIp) headers[REAL_IP_HEADER] = realIp;

  let upstream: Response;
  let body: ArrayBuffer | null = null;
  try {
    upstream = await fetch(`${process.env.API_BASE_URL}${target.path}`, {
      method,
      headers,
      redirect: 'manual',
      cache: 'no-store',
      signal: AbortSignal.timeout(PUBLIC_UPSTREAM_TIMEOUT_MS),
    });
    if (method === 'GET') body = await upstream.arrayBuffer();
  } catch (err) {
    if (isTimeout(err)) return plain(504, 'upstream timed out');
    createLogger('app/Line').error('public TfL route: upstream request failed', { error: err });
    return plain(502, 'upstream unavailable');
  }

  // A redirect from the api is not something this surface serves.
  if (upstream.status >= 300 && upstream.status < 400) return plain(502, 'upstream unavailable');

  const responseHeaders = new Headers({
    'Content-Type': upstream.headers.get('Content-Type') ?? 'application/json',
    'Cache-Control': upstream.status === 200 ? target.cacheControl : NO_STORE,
    // Anonymous data, no credentials: any site may read it.
    'Access-Control-Allow-Origin': '*',
    Link: ATTRIBUTION_LINK,
  });
  const retryAfter = upstream.headers.get('Retry-After');
  if (retryAfter) responseHeaders.set('Retry-After', retryAfter);

  return new Response(body && body.byteLength > 0 ? body : null, {
    status: upstream.status,
    headers: responseHeaders,
  });
}
