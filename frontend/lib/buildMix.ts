import { BUILD_ID_PATTERN } from '@/lib/buildId';
import { createLogger } from '@/lib/logger';

/** How long one counting window runs before it is logged. */
export const BUILD_MIX_WINDOW_MS = 60_000;

/** The most distinct build ids one window keeps apart; any further id counts
 * as `other`, so a client sending made-up ids cannot grow the counter or the
 * log line. A real window holds a handful. */
export const BUILD_MIX_MAX_BUILDS = 16;

/** The bucket for a request with no build header (a build from before the
 * header, or a client that is not the app's own page code). */
export const NO_BUILD = 'none';

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
  // Counts only: no path, address, cookie or user detail. One line a window
  // at most, collected with the pod's other logs.
  createLogger('app/api/build-mix').info('api requests by frontend build', {
    window_seconds: Math.round((now - windowStart) / 1000),
    total,
    builds,
  });
  counts = new Map();
  windowStart = null;
}

/** Counts one `/api/*` request against the build its `X-DS-Build` header
 * names. Aggregated in memory and logged as one line per window, written
 * when the first request after the window ends arrives, so an idle pod logs
 * nothing. `now` is for tests. */
export function recordApiBuild(header: string | null, now: number = Date.now()): void {
  if (windowStart !== null && now - windowStart >= BUILD_MIX_WINDOW_MS) flush(now);
  windowStart ??= now;
  let bucket: string;
  if (header === null) {
    bucket = NO_BUILD;
  } else if (!BUILD_ID_PATTERN.test(header)) {
    bucket = OTHER_BUILD;
  } else if (counts.has(header) || counts.size < BUILD_MIX_MAX_BUILDS) {
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
