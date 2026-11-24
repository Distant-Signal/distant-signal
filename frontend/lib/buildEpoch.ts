/** The response header the `/api/*` proxy adds, only when the operator set
 * `FRONTEND_MIN_BUILD`: the lowest build epoch still allowed to run. A page
 * built with a lower epoch offers a reload (`components/BuildUpdateNotice.tsx`,
 * docs/frontend-min-build.md). */
export const MIN_BUILD_HEADER = 'X-DS-Min-Build';

/** A whole number from 1 up to 15 digits, no sign, no leading zero. */
const EPOCH_PATTERN = /^[1-9][0-9]{0,14}$/;

/** Parses an epoch or floor from text. Anything else (empty, a build id, a
 * decimal, a negative, text) is not one and gives null. */
export function parseBuildEpoch(value: string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return EPOCH_PATTERN.test(trimmed) ? Number(trimmed) : null;
}

/** This build's epoch, inlined at build time from next.config.mjs's `env`
 * (scripts/build-epoch.mjs), or null when it is missing or not a number (the
 * test suite has none), in which case no reload hint is ever shown. */
export function clientBuildEpoch(): number | null {
  return parseBuildEpoch(process.env.NEXT_PUBLIC_BUILD_EPOCH);
}

/** Whether a build with epoch `own` is below the floor `min`. Equal, newer, or
 * either one unknown is not stale. */
export function isBuildStale(own: number | null, min: number | null): boolean {
  return own !== null && min !== null && own < min;
}
