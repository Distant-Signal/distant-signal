import { timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import { createLogger } from './logger';

/** The header the api's per-IP rate limiter keys on
 * (`crates/api/src/rate_limit.rs`'s `REAL_IP_HEADER`). */
export const REAL_IP_HEADER = 'X-Real-IP';

/** The header the edge adds, carrying `TRUSTED_PROXY_SECRET`, when that
 * optional hardening is on (docs/client-ip-trust.md). */
export const PROXY_SECRET_HEADER = 'x-ds-proxy-secret';

const log = createLogger('lib/clientIp');

let warnedMissing = false;

/** For the tests: forget that the once-only warning was logged. */
export function __resetClientIpWarningForTests(): void {
  warnedMissing = false;
}

function secretMatches(headers: Pick<Headers, 'get'>, secret: string): boolean {
  const given = Buffer.from(headers.get(PROXY_SECRET_HEADER) ?? '');
  const wanted = Buffer.from(secret);
  return given.length === wanted.length && timingSafeEqual(given, wanted);
}

/** The client IP to send the api as `X-Real-IP` (FE-8), or null, read from
 * an incoming browser request's headers.
 *
 * Only `CF-Connecting-IP` is trusted: in production the frontend is reached
 * only through the Cloudflare tunnel, which sets it. There is no other
 * trustworthy source -- Next 16 exposes no socket peer address to route
 * handlers or Server Components (`request.ip` is gone), and the
 * `X-Forwarded-For` it passes in is the client's own whenever the client
 * sent one. The client's own `X-Real-IP`/`X-Forwarded-For` are never
 * relayed. With no trustworthy value the header is omitted and the api falls
 * back to its own peer address. A value that isn't a literal IP is ignored.
 *
 * That trust assumes the origin cannot be reached except through the
 * tunnel (docs/client-ip-trust.md). Where that cannot be promised, set
 * `TRUSTED_PROXY_SECRET` and have the edge send the same value in
 * `X-DS-Proxy-Secret`: `CF-Connecting-IP` is then honoured only on a request
 * carrying it. Unset (the default), behaviour is unchanged. In production a
 * request with no usable `CF-Connecting-IP` logs one warning per process.
 *
 * Used by both paths that reach the api on a browser's behalf: the `/api/*`
 * proxy (`app/api/[...path]/route.ts`) and every server-render fetch
 * (`lib/api.ts`'s `apiFetch`). */
export function clientIpFromHeaders(headers: Pick<Headers, 'get'>): string | null {
  const secret = process.env.TRUSTED_PROXY_SECRET;
  const cf = headers.get('cf-connecting-ip')?.trim();
  if (cf && isIP(cf) !== 0 && (!secret || secretMatches(headers, secret))) return cf;
  if (process.env.NODE_ENV === 'production' && !warnedMissing) {
    warnedMissing = true;
    log.warn(
      'no trusted client address on a request (CF-Connecting-IP missing, invalid or unauthenticated); per-client rate limits fall back to the api peer address',
    );
  }
  return null;
}
