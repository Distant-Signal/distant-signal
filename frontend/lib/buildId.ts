/** The request header the browser puts on its `/api/*` calls, naming the
 * frontend build the page's code came from, so the proxy can count how many
 * calls still come from old builds (`lib/buildMix.ts`). The proxy never
 * forwards it to the api. */
export const BUILD_ID_HEADER = 'X-DS-Build';

/** A build id as `scripts/build-id.mjs` makes it: 24 lowercase hex digits. */
export const BUILD_ID_PATTERN = /^[0-9a-f]{24}$/;

/** This build's id, inlined at build time from next.config.mjs's `env`
 * (the same value as `.next/BUILD_ID` and public/sw.js's cache name), or
 * null when it is missing or not a build id (`next dev` and the test suite
 * have none). */
export function clientBuildId(): string | null {
  const id = process.env.NEXT_PUBLIC_BUILD_ID;
  return id !== undefined && BUILD_ID_PATTERN.test(id) ? id : null;
}
