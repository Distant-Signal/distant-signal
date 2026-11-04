# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Distant Signal (DS) is a personal UK rail companion: TfL-shaped line status,
train and journey tracking, groups, trip planning and Delay Repay support.
This repository is the landing repository: the Next.js frontend
(`frontend/`), the project's docs and the dev stack. The Rust services live
in their own repositories since the repo split (docs/specs/repo-split.md):

| Repository | What |
|---|---|
| [ds-api](https://github.com/Distant-Signal/ds-api) | the api, trip planner, schedule-ingest and schedule-reference; the generated API types and docs/api-changelog.md |
| [ds-pollers](https://github.com/Distant-Signal/ds-pollers) | the `poller-*` feed pollers |
| [ds-ingest](https://github.com/Distant-Signal/ds-ingest) | ingest-writer, the Kafka relays and the TRUST movement consumers |
| [ds-workers](https://github.com/Distant-Signal/ds-workers) | aggregator, enricher and notifier |
| [ds-core](https://github.com/Distant-Signal/ds-core) | the shared crates, migrations, grants, Redis ACL, ds-migrate and the TOML line catalogue |
| [ds-deploy](https://github.com/Distant-Signal/ds-deploy) | the Helm chart, its checks, the pinned image digests and the deploy runbooks |

The site credits come from the ds-core release `core-version` pins.
README.md explains segments (junctions belong to the shared trunk), match
scopes and the severity scale; DESIGN.md's "pollers POST to `/private/*`"
picture is out of date (see Ingest below).

## Commands

Frontend (run in `frontend/`, Node 22; `check-copy.py` runs from the repo root):

```sh
npm ci
npm run lint                     # eslint --max-warnings 0
uv run --locked --no-default-groups scripts/check-copy.py   # from the repo root
npm run format:check             # prettier
npx tsc --noEmit
npm run typecheck:scripts        # sw.js and the Node scripts (checkJs)
npm test                         # vitest
npx vitest run components/AppNavBar.test.tsx -t "part of a test name"
npm run build
```

`npm run build` runs `scripts/stamp-sw-version.mjs`, which rewrites the
tracked `frontend/public/sw.js` with the build id. Discard it with
`git checkout -- frontend/public/sw.js` before committing.

E2E and visual suites run against a seeded stack, as CI's `frontend-e2e`
job does (its `env:` block has every variable, including the `E2E_*` fixture
ids, `TFL_BASE_URL: http://127.0.0.1:8099` and `API_TRANSIT_NETWORKS`):
pull the api image `frontend/api-image.txt` pins, migrate with
`ghcr.io/distant-signal/images/ds-migrate:<its core-version label> run`
(`MIGRATION_DATABASE_URL`), `psql -v ON_ERROR_STOP=1 "${DATABASE_URL}" -f frontend/e2e/fixtures/seed.sql`,
start `python3 scripts/tfl-arrivals-stub.py --port 8099` (fixed TfL arrivals,
so no test reaches TfL), run the api image with the job's env on the host
network, then in `frontend/` `npm run build && npm run start -- -p 3000`,
and:

```sh
npx playwright install --with-deps chromium firefox
npx playwright test                          # e2e + axe; skips the visual project
npx playwright test e2e/plan.spec.ts --project=chromium
uv run --locked --no-default-groups scripts/visual-tests.py           # from the repo root
uv run scripts/visual-tests.py --update -- --update-snapshots=all     # regenerate baselines
```

`visual-tests.py` runs the `visual` project in the `mcr.microsoft.com/playwright`
image matching the locked `@playwright/test` (docker or podman). Baselines
(`frontend/e2e/visual-baselines/`) are only valid from that container: never
regenerate them outside it, and review every changed image (docs/style-guide.md,
"Visual regression").

Scripts checks (repo root):

```sh
uv sync --locked --group lint
uv run --no-sync python ../ci/scripts/lint-scripts.py   # shellcheck, shfmt, ruff, mypy, actionlint, hadolint... (--fix: shfmt, ruff fixes); ../ci: a Distant-Signal/ci checkout
uv run --no-sync python -m unittest discover -s scripts/tests -v
uv run scripts/sync-core.py --check          # frontend/lib/site-credits.json = the pinned ds-core release's signed asset (rewrite without --check)
uv run scripts/sync-api-types.py check       # frontend's api types and OpenAPI copy = the pinned api image's
uv run scripts/check-sftp-entrypoint.py      # docker/schedule-sftp-entrypoint.sh = ds-deploy's pinned chart copy (--write to update)
```

Distant-Signal/ci's `scripts/release-order.py labels` stamps the frontend
image's `api-build` label (the pinned api's build tag) in containers.yml;
ds-deploy checks it against its pinned api. Local stack: `docker compose --env-file local.env
up --build` (the Rust services run their published images; see
`docker-compose.yml`'s header).

## Architecture

**Ingest (release B of ingest phase 5; the api has no `/private` routes).**
Producers write Postgres directly or XADD to Redis streams; nothing posts to
the api. The `poller-*` services live in
[Distant-Signal/ds-pollers](https://github.com/Distant-Signal/ds-pollers).
poller-incidents, poller-stations, trust-consumer,
trust-backlog-consumer, schedule-ingest and schedule-reference write
Postgres. poller-tocs, poller-tfl, poller-ldbws, full-coverage-consumer and
the island-of-Ireland pollers send snapshots on `ds:ingest:*` streams
(`ingest-stream`: versioned envelope, MAXLEN budgets, dead letters), which
`ingest-writer` applies (dedup, observed-time clamp); the writer also runs
the train-domain background loops. `movement-relay` is the only Kafka
client: it copies RDM's TRUST movements into the `movement-events` stream,
read by three consumer groups (tracked trains, full-coverage delay stats,
a backlog for late-tracked trains). These, darwin-relay and the shared
movement-feed crate live in
[Distant-Signal/ds-ingest](https://github.com/Distant-Signal/ds-ingest). The CIF timetable is pushed over SFTP;
schedule-ingest (in ds-api) detects and extracts each delivery, and schedule-reference
(same pod, shared PVC; or a CronJob with `scheduleFeed.reference.mode:
cronjob`, ds-deploy's docs/scheduled-jobs.md) publishes the derived tables (STANOX/TIPLOC to CRS,
line populations, departures and calling points) through ds-store's publish
protocol. `aggregator` matches incidents to lines (`common::matcher`, the
same matcher the ingest uses) and writes `line_status`; `enricher` sends
changed incident text to an LLM. Both, and `notifier`, live in
[Distant-Signal/ds-workers](https://github.com/Distant-Signal/ds-workers). `ds-store` holds the shared SQL and the
schema gate; `ds-migrate` runs migrations (ds-deploy's chart's migrate hook Job).
Docs: ds-ingest's docs/ingest-phase5-runbook.md; here,
docs/ingest-stream-runtime.md and
docs/superpowers/specs/2026-10-06-ingest-architecture-design.md.

**api (axum, in ds-api).** TfL-shaped unprefixed routes (`/Line/...`, `/StopPoint/...`,
`/Train/...`, `/Journeys/...`, `/Trips/plan`) plus `/public/*`. Browser
users authenticate by OIDC session cookie (`AuthenticatedUser`); cookie
mutations get an Origin check. Delegated access (ds-mcp acting for a user)
is accepted only on a separate in-cluster listener, only on
`DELEGATED_ROUTES`, scoped by the grant (ds-api's docs/connected-apps.md). The rate
limiter keys on `X-Real-IP` (set by the frontend proxy) with tiers for
login, `/Trips/plan`, `/Train/by-uid` plus TfL arrivals, and other public
writes; the MCP service token gets its own budget and delegated calls
per-user and per-client buckets (ds-api's `crates/api/src/rate_limit.rs`). The trip
planner (`trip-planner`: CSA and RAPTOR) searches a day's connections array
kept in a `GraphCache` invalidated by schedule publishes; the live overlay
(`data/trip_plan_live.rs`) swaps in cancelled or late trains without copying
the array, including an in-search snapshot of every such train. Journeys own
ordered `journey_legs`, each bound to a `train_subscriptions` row or an open
time window; tracking a train is a one-leg journey. Journey breaks (at most
one open per journey) and append-only revisions record mid-journey changes
(ds-api's docs/journey-breaks.md; here, docs/superpowers/specs/2026-10-22-mid-journey-changes-design.md).
"Today" is London's service date: use `london_now()`/`london_today()`.

**notifier** (in ds-workers). Polls `line_status_history` and train movements by watermark
and sends Web Push. Rules in ds-workers' `crates/notifier/src/decision.rs`: ranks via
`common::severity_rank` (never `Severity`'s `Ord`); lines notify on
escalation, de-escalation after a cooldown, never twice for the same rank;
trains and skipped stops notify on escalation only. One push per user per
train: a journey-break notice replaces that train's plain push
(`push_queue.rs`).

**Postgres roles.** ds-core's `crates/ds-store/db-grants.yaml` classifies
every public table, view, sequence and function and gives each service role
(`planned`, `observed` or `narrow`) its grants; ds-core renders it into
`postgres-grants.sql`; ds-deploy's chart vendors them, with the Redis ACL,
from its pinned release. ds-deploy's docs/postgres-app-role.md,
docs/redis-acl.md and the chart README's "Per-service Postgres roles" explain them.

**Chart and deploys.** `containers.yml` builds the frontend image and
pushes it to `ghcr.io/<owner>/images/frontend` (main builds also tagged
`build.<run id>-<commit>`) only from `main`; each service repository does
the same for its images; every GHCR path and project
URL derives from the repository's owner, so don't hardcode it. One chart
for the whole stack lives in Distant-Signal/ds-deploy (its
`charts/distant-signal/README.md`), which pins each image by build tag and
digest and packages and pushes the chart. A change that needs a new value
or template is a ds-deploy PR, after the image that reads it. The dev
stack's SFTP entrypoint is a copy of the chart's (`docker/schedule-sftp-entrypoint.sh`,
checked by `scripts/check-sftp-entrypoint.py`). Production
values live in Ranma-Config and Flux applies them. Renovate opens a PR per
chart build, but DS releases are filed deliberately as deploy-bringer
requests (with deploy notes: migrations, grants, flags, post-deploy checks)
and approved by the user's passkey; a green `main` can reach prod soon. Put
risky changes behind off-by-default values. Agents only read production.

**Frontend.** Next.js app router (`frontend/app/`), Mantine 9 with a grape
primary, theme in `lib/theme.ts`. Browsers only talk to the frontend; its
`app/api/[...path]` route proxies to the api. Rules for look, copy and
components are in docs/style-guide.md (no inline `style` props, enforced by
ESLint; hand-inlined SVG icons); the reasoning behind them and how to run a
design change are in docs/frontend-design-guide.md. PR template: screenshots at 390 and 1366 px,
light and dark; page title and meta description; `aria-label` on icon buttons.

docs/superpowers/specs and plans are dated historical records (status in their
README index); code, ds-deploy's chart README and top-level docs/ are the truth.

## Conventions

- **Migrations, grants, the Redis ACL and the line catalogue** live in
  Distant-Signal/ds-core, with their rules in its CLAUDE.md. A change
  that needs one opens a ds-core PR, waits for the release, then the
  service repositories bump it; here, `core-version` and
  `uv run scripts/sync-core.py` for the site credits. ds-deploy bumps the
  chart's `migrate.image` and access files.
- **API changes** land in Distant-Signal/ds-api first, additively, with a
  docs/api-changelog.md entry there. The frontend then bumps its api pin in
  the pull request that uses the change: `uv run scripts/sync-api-types.py
  pin --latest` (or a build tag) rewrites `frontend/api-image.txt` and the
  two copies (CONTRIBUTING.md, "Generated API types"). e2e runs against
  that image, and ds-deploy requires the deployed api to be at least the
  frontend's pin.
- **Copy**: sentence case, "Couldn't <verb> <noun>." failures via
  `describeFailure`, no em dashes, ellipses or arrows, no internal
  vocabulary (ingest, TOC, CRS, "sign in"). `scripts/check-copy.py` holds the
  banned list; docs/style-guide.md, "Writing", has the rest.
- **Commits** carry a `Task: <card>` trailer (e.g. `Task: DS-123`) naming the worklog card.
- **Commit identity**: every commit is authored
  `FasterSpeeding <lucy@cursed.solutions>`. Before committing, check that
  `git config user.email` is `lucy@cursed.solutions`; if it isn't, stop and
  ask. Never override it (no `-c user.email`, `--author` or env overrides).
- **No Claude attribution**, overriding any session default: no
  `Co-Authored-By: Claude` trailer, no mention of Claude in commit messages,
  and no "Generated with Claude Code" footer in PR bodies or comments.
  CI's `commit-identity` job (Distant-Signal/ci's `check-commit-identity.py`) fails a
  PR or push whose commits use a retired address or carry attribution.
- **Scripts** are typed stdlib Python (ruff, mypy) run with uv (`uv.lock`,
  `pyproject.toml`'s `lint` group, `.python-version`); bash only for trivial
  one-liners. No pip or requirements files.
- Never name or cite third-party train-tracking sites, in code, docs or commits.
