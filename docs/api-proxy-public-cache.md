# Shared caching of public API reads

The frontend's `/api/[...path]` proxy can let a shared cache (Cloudflare)
keep a small, fixed set of anonymous catalogue reads. It is off by default.
The policy is `frontend/lib/proxyPublicCache.ts`; the proxy is
`frontend/app/api/[...path]/route.ts`.

## The flag

`API_PROXY_PUBLIC_CACHE_ENABLED=true` turns the policy on. Anything else,
or unset, leaves the proxy exactly as it was: the api's `Cache-Control`,
`ETag` and `Last-Modified` are relayed, `Vary` is dropped, `Set-Cookie` is
relayed. It is read per request, so it is a value change and a restart.

## What the policy does when it is on

A request is a candidate for public caching only if all of these hold:

- the method is GET or HEAD;
- it carries no `distant_signal_session` cookie (nor the
  `distant_signal_login` cookie) and no `Authorization` header;
- its path is exactly one of the allowlist below.

Every other request is locked, and so is every response the proxy makes
itself (4xx, 5xx, redirects): `Cache-Control: private, no-store`, whatever
the api sent. Requests with a session cookie always take this path.

For a candidate, the response is public only if the api itself says so for
that response: status 200 or 304, `Cache-Control` containing `public` and a
positive `max-age` or `s-maxage`, and none of `private`, `no-store` or
`no-cache`. The proxy never upgrades a value. It re-emits
`public, max-age=N[, s-maxage=M]` with N and M capped at 3600 seconds, and
relays `ETag`, `Last-Modified` and `Vary`. `Set-Cookie` is dropped from a
public response. If-None-Match is forwarded as before, and so is
If-Modified-Since for a candidate, so a revalidation gets the api's 304. A
candidate whose response fails any test is locked.

Independent of the flag, the proxy gives every response the api sent no
`Cache-Control` with `Cache-Control: private, no-store` (an upstream value is
kept), so personal JSON is never stored by a heuristic cache.

Locking means a signed-in browser no longer caches these routes for an hour
through the proxy, and Atom feeds are served `private, no-store` (their
validators still work).

## The allowlist

Exact `/api/...` paths (query strings allowed; the cache key must include
them). Each is justified, in the code, by ds-api's own anonymous
`Cache-Control`:

| Path | api `Cache-Control` |
|---|---|
| `/api/lines` | `public, max-age=3600` anonymous; `private, no-store` + `Vary: Cookie` signed in |
| `/api/stations/codes`, `/api/stations/index` | `public, max-age=3600` |
| `/api/stanox-crs` | `public, max-age=3600` |
| `/api/island-of-ireland/stations`, `/api/island-of-ireland/lines` | `public, max-age=3600` |
| `/api/transit/networks` | `public, max-age=300` |
| `/api/transit/rail-links` | `public, max-age=3600` |
| `/api/Trips/station-groups`, `/api/Trips/operator-groups` | `public, max-age=3600` |
| `/api/Trips/operators` | `public, max-age=300` |
| `/api/stations/{crs}/board` | `public, s-maxage=20, stale-while-revalidate=30` |

The station board is the one entry with a path parameter and a query rule:

- The parameter is one upper-case CRS (`[A-Z]{3}`); anything else in that
  slot is not a candidate. Only `/api/stations/{crs}/board` reaches the api's
  `/public/stations/{crs}/board`; `/api/public/stations/...` becomes
  `/public/public/...`, which the api 404s, and is locked.
- Its data is the timetable and Darwin's live times: no user data, identical
  for every caller, so a cookie only makes the request a non-candidate (as
  everywhere), it never changes the answer.
- The api ignores unknown query keys, so `?cb=1`, `?cb=2` would be a fresh
  cache key each and a way past the cache. A board request is a candidate only
  when its raw query is the empty string or `limit` (1 to 30), `date`
  (`YYYY-MM-DD`) and `operator` (ascending two-character codes, at most 30),
  each at most once and unencoded. Any other query is still served, as
  `private, no-store`. The key space is therefore bounded: 17,576 CRS codes,
  30 limits, the date window, operator sets in one spelling.
- The lifetime is the api's `s-maxage=20`, re-emitted as `public, s-maxage=20`
  (no `max-age`, so browsers do not keep it; `stale-while-revalidate` is not
  re-emitted, like every directive the policy does not know), under a
  per-entry ceiling of 60 seconds instead of 3600.
- A 404 (the api's switch off, or no timetable for the day) or 400 is not 200
  or 304, so it is `private, no-store`: nothing negative is cached.
- No browser code calls this route today: the station page's server
  component calls the api directly (`getStationBoard`, `revalidate: 20`). The
  entry only matters for a future client fetch.

Not listed on purpose: live reads (departures, status, trains: the api sets
no `Cache-Control`), `/auth/*`, journeys, groups, account, notifications,
calendar, feeds, search routes and any other path parameter. Add a
path only after reading its handler in ds-api: no auth extractor, and a
response that cannot vary by caller. `lib/proxyPublicCache.test.ts` pins
the list.

## Rolling it out

1. Ship the image with the flag off (this change).
2. In ds-deploy, a frontend chart value that sets
   `API_PROXY_PUBLIC_CACHE_ENABLED` (separate PR, after the image).
3. Turn it on and check with `curl -I`: an anonymous allowlisted path shows
   `Cache-Control: public, ...`; the same with
   `Cookie: distant_signal_session=x` shows `private, no-store`.
4. Only then add the Cloudflare Cache Rule in the dashboard, on the same
   exact paths: eligible for cache, Edge TTL "use cache-control header if
   present", never "Cache Everything" or "ignore origin Cache-Control", and
   bypass cache when the request has the `distant_signal_session` cookie
   (Cloudflare ignores `Vary`, so the rule must do what `Vary: Cookie`
   would). The origin already refuses to mark a session request public; the
   rule is the second lock.
