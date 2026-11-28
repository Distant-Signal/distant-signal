/**
 * Opt-in shared-cache (CDN) policy for the `/api/[...path]` proxy. The
 * reasoning and the rollout are in docs/api-proxy-public-cache.md; this
 * file is the policy itself and the route (`app/api/[...path]/route.ts`)
 * only calls it.
 *
 * The flag: `API_PROXY_PUBLIC_CACHE_ENABLED=true` (read per request, off by
 * default). With it unset or anything but `true` the proxy behaves exactly
 * as it did before this file existed, and none of the functions below are
 * consulted.
 *
 * The safety rules, in order of importance:
 *
 * 1. NOTHING that can depend on the session cookie is ever publicly
 *    cacheable. A request is a candidate only when it is a GET or HEAD, has
 *    no `distant_signal_session` cookie (the login-state cookie counts
 *    too), has no `Authorization` header, and names an exact path in
 *    `PUBLIC_CACHE_ALLOWLIST`. Anything else is a "locked" request.
 * 2. With the flag on, every response to a locked request (and every
 *    response the proxy itself makes: 4xx, 5xx, redirects) carries
 *    `Cache-Control: private, no-store`, whatever the api said.
 * 3. A candidate's response is made public only when the api itself said
 *    so for this response: status 200 (or 304), a `Cache-Control` with
 *    `public` and a positive `max-age` or `s-maxage`, and none of
 *    `private`, `no-store` or `no-cache`. The api's value is never
 *    upgraded, only re-emitted with the lifetimes capped at
 *    `MAX_PUBLIC_CACHE_SECONDS`. Anything else on a candidate falls back to
 *    rule 2.
 * 4. A public response carries no `Set-Cookie`.
 * 5. An entry with a query rule is a candidate only for a query the rule
 *    accepts, checked on the raw string, so an unknown key (a cache-buster
 *    the api ignores), a repeated key or an alternative encoding can never
 *    mint a new cache key.
 *
 * Cloudflare ignores `Vary` (beyond `Accept-Encoding`), so the Cache Rule in
 * front must itself skip requests carrying the session cookie; this policy
 * is the origin half and does not replace it.
 */

/** The cookie the api's session lives in. Mirrors `SESSION_COOKIE_NAME` in
 * `lib/api.ts` and `crates/api/src/auth.rs` in ds-api. */
const SESSION_COOKIE_NAME = 'distant_signal_session';

/** The mid-login PKCE state cookie (`LOGIN_STATE_COOKIE_NAME` in ds-api).
 * No allowlisted route reads it, but a request carrying either cookie is
 * treated as signed in or signing in, so it is never a candidate. */
const LOGIN_STATE_COOKIE_NAME = 'distant_signal_login';

/** The `Cache-Control` of every response that must not be shared. */
export const PRIVATE_NO_STORE = 'private, no-store';

/** The longest lifetime (seconds) of a public response, for both `max-age`
 * and `s-maxage`: the api's longest anonymous catalogue value is 3600. */
export const MAX_PUBLIC_CACHE_SECONDS = 3600;

/** One proxied path that may be publicly cached: the `/api/...` segments
 * (exact, case-sensitive, no wildcards, no path parameters) and why. */
export interface PublicCacheEntry {
  /** Exact segments; `CRS_SEGMENT` stands for one upper-case CRS code. */
  readonly segments: readonly string[];
  readonly why: string;
  /** The raw query string (with its `?`, or empty) the entry accepts. Absent:
   * any query, as the catalogue routes take at most `?network=`. */
  readonly acceptsQuery?: (search: string) => boolean;
  /** A lower ceiling (seconds) than `MAX_PUBLIC_CACHE_SECONDS`, for a
   * short-lived route. */
  readonly maxSeconds?: number;
}

/** The one path parameter an entry may have: a station's CRS code, three
 * upper-case letters (the form every frontend link uses). */
export const CRS_SEGMENT = ':crs';
const CRS_PATTERN = /^[A-Z]{3}$/;

/** The station board's query (`GET /public/stations/{crs}/board`): only the
 * api's own `limit`, `date` and `operator`, each at most once, each in the
 * canonical spelling, checked on the raw string. The api ignores unknown
 * keys, so without this a cache-buster (`?x=1`, `?x=2`...) would be a new
 * cache key per request and a way around the cache to the api's database.
 * Anything else is merely not cached, never refused. */
export function boardQueryIsCanonical(search: string): boolean {
  if (search === '' || search === '?') return true;
  if (!search.startsWith('?')) return false;
  const seen = new Set<string>();
  for (const pair of search.slice(1).split('&')) {
    const eq = pair.indexOf('=');
    if (eq === -1) return false;
    const key = pair.slice(0, eq);
    const value = pair.slice(eq + 1);
    if (seen.has(key)) return false;
    seen.add(key);
    if (key === 'limit') {
      // 1 to 30 (the api clamps above, 400s below).
      if (!/^[1-9]\d?$/.test(value) || Number(value) > 30) return false;
    } else if (key === 'date') {
      if (!/^20\d\d-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(value)) return false;
    } else if (key === 'operator') {
      // ATOC codes, comma-separated, strictly ascending: one spelling per
      // set, so the order cannot split the key.
      const codes = value.split(',');
      if (codes.length > 30) return false;
      if (!codes.every((code) => /^[A-Z0-9]{2}$/.test(code))) return false;
      if (codes.some((code, i) => i > 0 && (codes[i - 1] ?? '') >= code)) return false;
    } else {
      return false;
    }
  }
  return true;
}

/**
 * The exact-path allowlist, checked against ds-api's own anonymous
 * `Cache-Control` (crates/api/src/routes/*.rs). Each entry is a route with
 * no `AuthenticatedUser`/`OptionalAuthenticatedUser` extractor whose
 * response cannot vary by caller, except `lines`, which varies by cookie
 * and is safe only because a cookie makes the request a non-candidate.
 *
 * A path is added here only after reading its handler. The unit test pins
 * this list so a change to it is a visible decision.
 *
 * Deliberately not listed: every live read (departures, status, trains:
 * the api sets no Cache-Control), every `/auth/*`, `/journeys`, groups,
 * account, notifications and calendar route, `/feeds/*` (the api caches
 * them for feed readers, which is its own decision), `stations` search and
 * `tocs` (query-driven, per-user rate limited, no cache header) and any
 * path with a parameter.
 */
export const PUBLIC_CACHE_ALLOWLIST: readonly PublicCacheEntry[] = [
  {
    // routes/lines.rs `list_lines`: `public, max-age=3600` for an anonymous
    // caller, `private, no-store` + `Vary: Cookie` for a signed-in one.
    segments: ['lines'],
    why: 'api: public, max-age=3600 when anonymous; private, no-store and Vary: Cookie when signed in',
  },
  {
    // routes/reference.rs `list_station_codes`: `ID_LIST_CACHE`, no caller.
    segments: ['stations', 'codes'],
    why: 'api: public, max-age=3600 (ID_LIST_CACHE), no auth extractor',
  },
  {
    // routes/reference.rs `list_station_index`: `ID_LIST_CACHE`, no caller.
    segments: ['stations', 'index'],
    why: 'api: public, max-age=3600 (ID_LIST_CACHE), no auth extractor',
  },
  {
    // routes/stanox_crs.rs: whole-table dump, no auth extractor.
    segments: ['stanox-crs'],
    why: 'api: public, max-age=3600 (STANOX_CRS_CACHE_CONTROL), no auth extractor',
  },
  {
    // routes/island_of_ireland.rs `list_stations`: `?network=` only.
    segments: ['island-of-ireland', 'stations'],
    why: 'api: public, max-age=3600 (CATALOGUE_CACHE_CONTROL), no auth extractor',
  },
  {
    // routes/island_of_ireland.rs `list_lines`: `?network=` only.
    segments: ['island-of-ireland', 'lines'],
    why: 'api: public, max-age=3600 (CATALOGUE_CACHE_CONTROL), no auth extractor',
  },
  {
    // routes/transit.rs `list_networks`: NETWORKS_CACHE.
    segments: ['transit', 'networks'],
    why: 'api: public, max-age=300 (NETWORKS_CACHE), no auth extractor',
  },
  {
    // routes/transit.rs `rail_links`: LONG_CACHE.
    segments: ['transit', 'rail-links'],
    why: 'api: public, max-age=3600 (LONG_CACHE), no auth extractor',
  },
  {
    // routes/trips.rs `get_station_groups`: compiled in.
    segments: ['Trips', 'station-groups'],
    why: 'api: public, max-age=3600 (STATION_GROUPS_CACHE_CONTROL), compiled-in data',
  },
  {
    // routes/trips.rs `get_operator_groups`: compiled in.
    segments: ['Trips', 'operator-groups'],
    why: 'api: public, max-age=3600 (STATION_GROUPS_CACHE_CONTROL), compiled-in data',
  },
  {
    // routes/trips.rs `get_planner_operators`: the published window.
    segments: ['Trips', 'operators'],
    why: 'api: public, max-age=300 (PLANNER_OPERATORS_CACHE_CONTROL), no auth extractor',
  },
  {
    // routes/station_board.rs: `GET /public/stations/{crs}/board`, no auth
    // extractor, no user data, the same for everyone. Reached as
    // `/api/stations/{crs}/board` (the proxy prepends `/public`). 404 while
    // the api's switch is off and 400 for a bad query: both locked by rule 3.
    segments: ['stations', CRS_SEGMENT, 'board'],
    why: 'api: public, s-maxage=20, stale-while-revalidate=30; anonymous, identical for every caller',
    acceptsQuery: boardQueryIsCanonical,
    maxSeconds: 60,
  },
];

type Env = Record<string, string | undefined>;

/** Whether the flag is on: exactly `true`, read from the environment at call
 * time (a rollout is a value change and a restart, never a rebuild). */
export function publicCacheEnabled(env: Env = process.env): boolean {
  return env.API_PROXY_PUBLIC_CACHE_ENABLED?.trim() === 'true';
}

/** Whether the request carries anything that identifies a user. Deliberately
 * wider than the proxy's own cookie forwarding: a case-insensitive substring
 * test on the raw `Cookie` header, so a malformed or oddly-cased pair still
 * counts. */
export function carriesCredentials(headers: Headers): boolean {
  if (headers.has('authorization')) return true;
  const cookie = headers.get('cookie')?.toLowerCase() ?? '';
  return cookie.includes(SESSION_COOKIE_NAME) || cookie.includes(LOGIN_STATE_COOKIE_NAME);
}

function entryFor(path: readonly string[]): PublicCacheEntry | undefined {
  return PUBLIC_CACHE_ALLOWLIST.find(
    (entry) =>
      entry.segments.length === path.length &&
      entry.segments.every((segment, i) =>
        segment === CRS_SEGMENT ? CRS_PATTERN.test(path[i] ?? '') : segment === path[i],
      ),
  );
}

/** The lifetime ceiling (seconds) for an allowlisted path. */
export function publicCacheCeilingFor(path: readonly string[]): number {
  return entryFor(path)?.maxSeconds ?? MAX_PUBLIC_CACHE_SECONDS;
}

/** Whether a request may have a publicly cacheable response (rule 1). Compares
 * the decoded catch-all segments one by one, so an encoded `%2F` inside one
 * segment can never spell an allowlisted path. */
export function isPublicCacheCandidate(
  method: string,
  path: readonly string[],
  headers: Headers,
  search = '',
): boolean {
  if (method !== 'GET' && method !== 'HEAD') return false;
  if (carriesCredentials(headers)) return false;
  const entry = entryFor(path);
  if (entry === undefined) return false;
  return entry.acceptsQuery === undefined || entry.acceptsQuery(search);
}

/** The lifetimes in a `Cache-Control` value, or null when it is not a clean
 * `public` header with a positive lifetime (rule 3). */
export function publicLifetimes(
  cacheControl: string | null,
): { maxAge: number | undefined; sMaxAge: number | undefined } | null {
  if (cacheControl === null) return null;
  let isPublic = false;
  let maxAge: number | undefined;
  let sMaxAge: number | undefined;
  for (const raw of cacheControl.split(',')) {
    const directive = raw.trim().toLowerCase();
    if (directive === '') continue;
    const eq = directive.indexOf('=');
    const name = eq === -1 ? directive : directive.slice(0, eq).trim();
    const value = eq === -1 ? '' : directive.slice(eq + 1).trim();
    if (name === 'private' || name === 'no-store' || name === 'no-cache') return null;
    if (name === 'public') isPublic = true;
    if (name === 'max-age' || name === 's-maxage') {
      if (!/^\d+$/.test(value)) return null;
      const seconds = Number(value);
      if (name === 'max-age') maxAge = seconds;
      else sMaxAge = seconds;
    }
  }
  if (!isPublic) return null;
  // `s-maxage=0` forbids sharing even beside a positive `max-age`.
  if (sMaxAge !== undefined && sMaxAge <= 0) return null;
  if (sMaxAge === undefined && (maxAge === undefined || maxAge <= 0)) return null;
  return { maxAge, sMaxAge };
}

/** The headers the policy decides for a response a shared cache may keep.
 * `ETag` and `Last-Modified` need no decision: the proxy relays them
 * whatever the policy. */
export interface PublicCacheHeaders {
  readonly cacheControl: string;
  readonly vary: string | null;
}

/** Rule 3: the public headers for a candidate's upstream response, or null
 * when it must be locked down instead. Only 200 and 304 qualify, so no error
 * response is ever public. */
export function publicCacheHeadersFor(
  status: number,
  upstream: Headers,
  ceiling = MAX_PUBLIC_CACHE_SECONDS,
): PublicCacheHeaders | null {
  if (status !== 200 && status !== 304) return null;
  const lifetimes = publicLifetimes(upstream.get('cache-control'));
  if (lifetimes === null) return null;
  const parts = ['public'];
  if (lifetimes.maxAge !== undefined) parts.push(`max-age=${Math.min(lifetimes.maxAge, ceiling)}`);
  if (lifetimes.sMaxAge !== undefined) parts.push(`s-maxage=${Math.min(lifetimes.sMaxAge, ceiling)}`);
  return {
    cacheControl: parts.join(', '),
    vary: upstream.get('vary'),
  };
}

/** Marks a response the proxy generated, or must not share, as private.
 * Used only with the flag on. */
export function lockDown(headers: Headers): void {
  headers.set('Cache-Control', PRIVATE_NO_STORE);
}
