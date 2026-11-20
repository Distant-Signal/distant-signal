import { BUILD_ID_PATTERN } from '@/lib/buildId';
import { createLogger } from '@/lib/logger';

/** How long one counting window runs before it is logged. */
export const BUILD_MIX_WINDOW_MS = 60_000;

/** The most distinct build ids one window keeps apart; any further id counts
 * as `other`, so a client sending made-up ids cannot grow the counter or the
 * log line. The no-header buckets and `other` do not count toward the cap.
 * A real window holds a handful. */
export const BUILD_MIX_MAX_BUILDS = 16;

/** The bucket for a request with no build header that a browser page made:
 * it carries `Sec-Fetch-Site: same-origin`, which browsers always send and
 * which a page calling `/api` on its own origin has. This is where a tab
 * still running a build from before the header lands, and what the stage 2b
 * gate counts (docs/frontend-build-mix.md). */
export const NONE_BROWSER = 'none-browser';

/** The bucket for a request with no build header and no same-origin fetch
 * metadata: probes, bots, curl and other clients that are not the app's own
 * page code. The old single `none` key is gone; the gate reads `none-browser`
 * and `other`, never `none`. */
export const NONE_OTHER = 'none-other';

/** The bucket for a header that is not a build id, or one past the cap. */
export const OTHER_BUILD = 'other';

let windowStart: number | null = null;
let counts = new Map<string, number>();

function flush(now: number): void {
  if (windowStart === null) return;
  let total = 0;
  const builds: Record<string, number> = {};
  for (const [build, count] of counts) {
    builds[build] = count;
    total += count;
  }
  // Counts only: no path, address, cookie, user agent or fetch metadata.
  // One line a window at most, collected with the pod's other logs.
  createLogger('app/api/build-mix').info('api requests by frontend build', {
    window_seconds: Math.round((now - windowStart) / 1000),
    total,
    builds,
  });
  counts = new Map();
  windowStart = null;
}

/** Which bucket a request with no build header falls in. The fetch metadata
 * value is a measurement hint, not something to trust: any client can send
 * it. It is never stored or logged, only which bucket it picked. */
function classifyNoBuild(fetchSite: string | null): string {
  return fetchSite === 'same-origin' ? NONE_BROWSER : NONE_OTHER;
}

function isSpecialBucket(bucket: string): boolean {
  return bucket === NONE_BROWSER || bucket === NONE_OTHER || bucket === OTHER_BUILD;
}

function distinctBuilds(): number {
  let n = 0;
  for (const key of counts.keys()) if (!isSpecialBucket(key)) n++;
  return n;
}

/** Counts one `/api/*` request against the build its `X-DS-Build` header
 * names (`header`), or, with no header, against `none-browser` or
 * `none-other` by its `Sec-Fetch-Site` value (`fetchSite`). A header that is
 * not a build id counts as `other`. Aggregated in memory and logged as one
 * line per window, written when the first request after the window ends
 * arrives, so an idle pod logs nothing. `now` is for tests. */
export function recordApiBuild(header: string | null, fetchSite: string | null = null, now: number = Date.now()): void {
  if (windowStart !== null && now - windowStart >= BUILD_MIX_WINDOW_MS) flush(now);
  windowStart ??= now;
  let bucket: string;
  if (header === null) {
    bucket = classifyNoBuild(fetchSite);
  } else if (!BUILD_ID_PATTERN.test(header)) {
    bucket = OTHER_BUILD;
  } else if (counts.has(header) || distinctBuilds() < BUILD_MIX_MAX_BUILDS) {
    bucket = header;
  } else {
    bucket = OTHER_BUILD;
  }
  counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
}

/** Test-only: forget the window. */
export function resetBuildMixForTests(): void {
  windowStart = null;
  counts = new Map();
}
