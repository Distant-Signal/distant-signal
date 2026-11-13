# Edge caching: how to tell whether it works

`ds.cursed.solutions` sits behind Cloudflare (a tunnel to the frontend, no
chart Ingress). Cloudflare's cache rules and zone settings live in its
dashboard, not in code, so a caching change is only proven by looking at
what a client gets back. The starting point and the proposals are in the
[Distant Signal Caching Review](https://claude.ai/code/artifact/18582b24-d4c2-4c2a-8421-4d9a9f83741d)
(private artifact, 13 Nov 2026). This page is the runbook for measuring them.

## Reading the headers

Cloudflare adds these to the response the client receives. The origin never
sees them: a HIT does not reach the frontend at all.

| Header | Meaning |
|---|---|
| `cf-cache-status: HIT` | Served from the edge cache. |
| `MISS` | Cacheable, not in cache; fetched from the origin (and stored). |
| `EXPIRED` | Was cached, past its TTL; the edge went back to the origin. Every request is `EXPIRED` when the origin TTL is 0. |
| `REVALIDATED` | Expired, but the origin confirmed the stored copy (304). |
| `STALE` / `UPDATING` | Served stale while refreshing (`stale-while-revalidate`). |
| `DYNAMIC` | Not eligible for caching, so always sent to the origin. HTML and JSON are `DYNAMIC` unless a cache rule makes them eligible. |
| `BYPASS` | Cache deliberately skipped (a bypass rule, or the origin said so). |
| `Age` | Seconds the cached copy has been in the cache. Present and rising on a HIT; absent on `DYNAMIC`. |
| `cache-control` | What the edge tells the browser. It can differ from the origin: Browser Cache TTL rewrites it (a `max-age=14400` on a route the origin sends `no-cache` or `max-age=0` is that override). |

A single request proves little: the first one for a URL in a data centre is
a `MISS`. Look at the second, and compare `Age` between them.

## The ratio in the Cloudflare dashboard

Caching > Analytics (zone `cursed.solutions`) shows the cache hit ratio,
bandwidth served and saved, and top URLs by cache status. For one hostname or
path use Analytics & Logs > Traffic and filter on Hostname `ds.cursed.solutions`
and URI Path, then split by Cache Status. Compare before and after each rule
over at least a few hours, since the crawlers and the live-data polling make
short windows noisy.

## Running the check

```sh
uv run scripts/check-edge-cache.py                      # production, about 30 s
uv run scripts/check-edge-cache.py --json               # machine-readable
uv run scripts/check-edge-cache.py --strict             # exit 1 on a WARN too
uv run scripts/check-edge-cache.py --base-url https://example.test --delay 2
uv run scripts/check-edge-cache.py --only robots.txt
```

It makes about 26 anonymous GETs, one a second (the floor is 0.2 s), with a
User-Agent naming the tool. Each route class is requested twice; a few also
once with `Cookie: distant_signal_session=x`. Nothing is written, nothing is
authenticated. The unit tests use a fake transport and never touch the
network.

The classes and what is expected of the second request:

| Class | Path | Expected |
|---|---|---|
| home, line, station and A to Z pages | `/`, `/lines/c2c`, `/stations/EUS`, `/transit/tfl/stops` | not HIT (`DYNAMIC`): the page carries a per-request CSP nonce and the session-aware nav |
| robots.txt, sitemap.xml | `/robots.txt`, `/sitemap.xml` | HIT, once the cache rule exists (review proposal 1) |
| build asset | a `/_next/static/...` link read from the home page | HIT (works today) |
| service worker | `/sw.js` | not HIT, and `no-cache` (or `no-store`, `max-age=0`) reaching the browser (proposal 3) |
| proxied catalogue reads | `/api/stations/index`, `/api/transit/networks` | HIT once cached (proposal 4) |
| public line status | `/Line/Mode/tube/Status` | HIT once cached (proposal 2) |

## What the results mean

- **PASS**: the second request matched the expectation.
- **WARN**: it did not. Before a cache rule ships, WARN on robots.txt,
  sitemap.xml, the proxied reads and line status is the baseline, not a
  fault. After the rule it means the rule is not matching, the origin's
  `cache-control` makes the response ineligible (a TTL of 0, `private`,
  `no-store`), or the response is not behind Cloudflare (no
  `cf-cache-status`). A `HIT` on an HTML class is also a WARN: HTML caching
  is blocked on the nonce policy (review proposal 5).
- **FAIL** (exit 1): the critical case. One of
  - a request carrying a session cookie was served as `HIT` (HTML and the
    `/api/*` reads; a shared cache must never answer for a signed-in user);
  - any response with `Set-Cookie` was a `HIT`;
  - a `HIT` whose own `cache-control` says `private` or `no-store`, which means
    a rule is overriding the origin ("Cache Everything" with "Ignore origin
    Cache-Control"). Fix the rule first, then purge the zone's cache.

  `/Line/*` is the one exception: the frontend sends no cookie upstream for it,
  so a cookie request that is a HIT is only a WARN. Keep it that way only
  while `lib/tflPublicApi.ts` stays cookie-free.
- Exit 2: no request got an answer (network, DNS, or the site is down).

Run it before and after each Cloudflare change, and keep the output with the
change. A rule is working when its class goes from WARN to PASS and every
cookie line still reads `DYNAMIC` or `BYPASS`.

## The origin side

Cache hit ratio is `1 - origin requests / edge requests`: Cloudflare gives the
second number, the origin has to give the first.

- **ds-api** exports `distant_signal_http_requests_total{method,status,exported_endpoint}`
  (route template as the label) on its internal metrics port, scraped by
  ds-deploy's PodMonitor. It counts the calls the frontend makes to the api,
  so it is a usable proxy for the proxied catalogue and TfL-shaped reads:
  `sum by (exported_endpoint) (rate(distant_signal_http_requests_total{exported_endpoint=~"/Line/.*|/public/stations.*"}[5m]))`
  should fall when an edge rule starts hitting. It sees nothing for HTML.
- **The frontend** has no request metrics. It writes structured JSON logs to
  stdout (`lib/logger.ts`, `instrumentation.ts`) for errors only, and the
  PodMonitor selector deliberately leaves it out. There is no per-request
  counter by route class yet: it needs a change in the frontend's request
  path and a PodMonitor entry in ds-deploy.
- Without that, use the Cloudflare analytics above for the edge total and the
  api counter for the part that reaches the api.
