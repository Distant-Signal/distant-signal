# Frontend build mix: reading the log for the stage 2b gate

The ds-api stage 2b decision (`API_SERVE_NUMERIC_IDS`) needs to know whether
browsers are still running a frontend build from before the numeric-id fix.
Nothing else can see an idle tab that only polls `/api/*`, so the proxy
counts its requests by frontend build.

## What is logged

The browser puts `X-DS-Build: <build id>` (24 lowercase hex digits) on its
same-origin `/api/*` calls (`lib/buildHeader.ts`, `components/BuildHeader.tsx`).
The `/api/[...path]` proxy (`lib/buildMix.ts`) counts requests in memory and,
when the first request after a 60 second window arrives, logs one line:

```json
{"service":"frontend","target":"app/api/build-mix","message":"api requests by frontend build",
 "window_seconds":60,"total":31,"builds":{"<build id>":4,"none-browser":2,"none-other":25}}
```

Keys of `builds`:

| Key | Meaning |
|---|---|
| `<24 hex>` | A request from that build. At most 16 distinct ids a window. |
| `none-browser` | No build header, but `Sec-Fetch-Site: same-origin`: a browser page calling `/api` on its own origin. This is a tab running a build from before the header existed, so it is the stale-tab count. |
| `none-other` | No build header and no same-origin fetch metadata: probes, bots, curl and other clients. Ignore it for the gate. |
| `other` | A header that is not a build id, or an id past the 16 cap. |

The old single `none` key was replaced by `none-browser` and `none-other`
(DS-534). Lines logged before that change still carry `none`, which mixed both;
do not read it. Nothing in this repository reads the key; the gate reads the
log as described below.

Only counts per class and build id are recorded: no address, user agent,
cookie, path, and not the `Sec-Fetch-Site` value. That header is a
measurement hint only (any client can send it); nothing trusts it, and neither
it nor `X-DS-Build` is forwarded to the api.

## The gate

Stage 2b may go ahead when, over the last 24 hours, `none-browser` plus
`other` plus requests from builds older than the numeric-id fix are a small
share of `total` (ideally zero), with no bursts of them over the last 7 days,
and the oldest build seen in those 7 days is the fixed one or newer. A build id
carries no order, so compare ids against the ids of the fixed build and the
builds deployed after it.

## Queries

All the lines (Loki):

```logql
{service_name="frontend"} |= "api requests by frontend build"
```

Per-day count of one class (swap `none_browser` for `none_other` or `other`;
Loki flattens `builds["none-browser"]` to `builds_none_browser`):

```logql
sum(sum_over_time({service_name="frontend"} |= "api requests by frontend build"
  | json | unwrap builds_none_browser | __error__="" [1d]))
```

Per-day counts for every class and every build id, from `logcli` and `jq`:

```sh
logcli query '{service_name="frontend"} |= "api requests by frontend build"' \
  --since=7d --limit=100000 --quiet -o raw |
  jq -r '. as $l | .builds | to_entries[] | "\($l.timestamp[0:10]) \(.key) \(.value)"' |
  awk '{c[$1 " " $2] += $3} END {for (k in c) print k, c[k]}' | sort
```

The first column is the UTC day, the second the key, the third the count. Any
24-hex key that is not the fixed build or a later one is a stale build.
