import { createHash } from 'node:crypto';
import { buildRobots, renderRobots } from '@/lib/robots';
import { getConfiguredSiteOrigin } from '@/lib/siteOrigin';

// Rendered per request, not at `next build`: the image build doesn't pass
// `NEXT_PUBLIC_SITE_URL` (the chart sets it on the running pod), so a
// prerendered file would never carry the configured origin.
export const dynamic = 'force-dynamic';

// A route handler rather than `app/robots.ts`, which Next serves with no
// validators: this one sends an `ETag` hashed from the body (no
// `Last-Modified`, which would otherwise read "now" on every request) and
// answers a matching `If-None-Match` with 304, so the CDN's revalidations
// and crawlers' repeat fetches are cheap and the response is the same
// every time for one origin. `Cache-Control` comes from `next.config.mjs`.

/** Whether an `If-None-Match` value (a list of ETags, weak or strong, or
 * `*`) matches `etag`; weak comparison, per RFC 9110. */
function matches(ifNoneMatch: string | null, etag: string): boolean {
  if (!ifNoneMatch) return false;
  if (ifNoneMatch.trim() === '*') return true;
  const bare = (tag: string): string => tag.trim().replace(/^W\//, '');
  return ifNoneMatch.split(',').some((tag) => bare(tag) === etag);
}

/** `/robots.txt`. The rules live in `lib/robots.ts`. */
export function GET(request: Request): Response {
  const body = renderRobots(buildRobots({ origin: getConfiguredSiteOrigin() }));
  const etag = `"${createHash('sha256').update(body).digest('base64url').slice(0, 27)}"`;
  const headers = { 'Content-Type': 'text/plain; charset=utf-8', ETag: etag };
  if (matches(request.headers.get('if-none-match'), etag)) {
    return new Response(null, { status: 304, headers });
  }
  return new Response(body, { status: 200, headers });
}
