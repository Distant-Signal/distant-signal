import { clientIpFromHeaders } from './clientIp';
import { createLogger } from './logger';
import { NOINDEX_HEADER, PREVIEW_ERROR_CACHE_CONTROL, TOKEN_PREVIEW_CACHE_CONTROL } from './livePreview';
import { redactTokens } from './redactUrl';
import { PreviewRateLimiter, rateLimitKey } from './previewRateLimit';

const log = createLogger('lib/previewRoute');

/** One limiter for every card route in this process. */
const limiter = new PreviewRateLimiter();

export interface GuardPreviewOptions {
  /** A capability-token card: its 503 and 429 are stored nowhere
   * (`TOKEN_PREVIEW_CACHE_CONTROL`), like its PNG and its 404. */
  token?: boolean;
  /** For tests: the limiter to count against. */
  limiter?: PreviewRateLimiter;
}

/** Wraps a card route's `GET`:
 * - a client over its render budget (`lib/previewRateLimit.ts`, keyed on
 *   the trusted client IP, an IPv6 one by its /64) gets a 429 before any api read or drawing;
 * - an api outage (anything thrown that the route did not already turn
 *   into a 404) is a 503 a chat app can retry, not an uncached 500 or a
 *   long-cached failure. The routes are dynamic (`lib/livePreview.ts`,
 *   "Caching"), so the 503 never replaces a stored good card.
 * Both send `X-Robots-Tag: noindex`: neither is anything to index. */
export function guardPreview<Ctx>(
  handler: (request: Request, ctx: Ctx) => Promise<Response>,
  options: GuardPreviewOptions = {},
): (request: Request, ctx: Ctx) => Promise<Response> {
  const cacheControl = options.token ? TOKEN_PREVIEW_CACHE_CONTROL : PREVIEW_ERROR_CACHE_CONTROL;
  return async (request, ctx) => {
    const client = clientIpFromHeaders(request.headers);
    const wait = client === null ? null : (options.limiter ?? limiter).take(rateLimitKey(client));
    if (wait !== null) {
      return new Response('Too many requests', {
        status: 429,
        headers: { 'Cache-Control': TOKEN_PREVIEW_CACHE_CONTROL, 'Retry-After': String(wait), ...NOINDEX_HEADER },
      });
    }
    try {
      return await handler(request, ctx);
    } catch (err) {
      log.warn('link-preview image unavailable', { error: redactTokens(String(err)) });
      return new Response('Preview unavailable', {
        status: 503,
        headers: { 'Cache-Control': cacheControl, 'Retry-After': '30', ...NOINDEX_HEADER },
      });
    }
  };
}
