# Iarnród Éireann train tracking

Design, 2026-11-05. Status: **accepted 2026-11-05, with phase 2 split
into 2a and 2b** (DS-369; §11). It covers phases 1 to 4 of bringing
Iarnród Éireann trains toward what GB train tracking does. "§"
alone means a section of this document. "Pages §n" means
[the island of Ireland pages design](2026-11-04-island-of-ireland-pages-design.md),
and "support §n" means
[the Ireland rail support design](2026-09-05-ireland-rail-support-design.md).

The claims below were checked against `main` of each repository on
2026-11-05: ds-core v0.2.0, ds-pollers `efbb05f`, ds-ingest `75961fb`,
ds-api `5f75b47`, ds-workers `bfaecf9` (which pins ds-core v0.1.0) and
distant-signal `7a0a6ef3`. Nothing here was tested against Irish Rail's
live service or production.

## 1. What we have today

**The poller.** ds-pollers' `poller-irish-rail-live` polls Irish Rail's
realtime XML service over plain http
(`http://api.irishrail.ie/realtime/realtime.asmx`, `config.rs`). Each cycle
it calls `getAllStationsXML` once, then calls
`getStationDataByCodeXML?StationCode=<code>` once for each of the 171 stations
that list returns. The cycle runs every 300 s and has a 240 s budget. It
sends no `NumMins`, so each board covers the service's default look-ahead
window. We believe that window is 90 minutes, but we haven't confirmed it.

`schema.rs` keeps these fields:

- `Traincode` (trimmed: the feed pads it with a space)
- `Origin` and `Destination` (names, not codes)
- `Scharrival`, `Schdepart`, `Exparrival` and `Expdepart`, as `HH:MM`
  strings, with `00:00` meaning "none"
- `Late` (signed whole minutes)
- `Status` and `Duein`

The parser ignores everything else in the response. That includes
`Traindate` ("05 Sep 2026"), `Origintime`, `Destinationtime`,
`Lastlocation` ("Departed Dundalk", or empty), `Direction`, `Traintype`
and `Locationtype` (O, D or S in our fixtures), as well as `Servertime`,
`Querytime`, `Stationfullname` and `Stationcode`.

**The data.** The poller sends samples to ds-ingest's writer as
`ioi-station-samples/1` on `ds:ingest:ioi-live`. The writer upserts them
into `island_of_ireland_station_samples`, one row per live `StationCode`,
holding only the latest board as JSONB. When a train leaves a board, its
row is gone; nothing is kept. The writer also re-serialises `departures`
from the decoded struct, so any field it doesn't know about is dropped
when the row is stored.

**Station ids.** Catalogue stations (GTFS `stop_id`, such as `8220IR0007`)
carry a `live_code` (such as `CNLLY`). The writer matches these from the
`ioi-live-stations/1` list (ds-core v0.2.0).

**GB tracking.** A tracked train is a `trains` row keyed on
`(train_uid, service_date)`, with TRUST's `train_id` attached once the
train is resolved. A user's subscription to it is a `train_subscriptions`
row. Live state lives in `train_current_state`, and movements in
`train_movement_events`. Two corrections to the research brief:

- `train_subscriptions.pin_origin_crs` is **nullable** (migration
  `20260906130000_nullable_pin_columns`). The CRS requirement is in the
  api, not the schema: `validate_pin` (ds-api `data/train_tracking.rs:98`)
  and `validate_train_uid` (`data/journeys.rs:1146`, exactly 6
  alphanumerics).
- The notifier's train pushes start from two places: new
  `train_movement_events` ids, or new `notifier_forward_queue` ids (ds-workers
  `queries.rs:972-1023` and `:1053-1088`). A change to `train_current_state`
  on its own never wakes it.

## 2. Goals and non-goals

Goals, by phase:

1. **Keep what the boards already tell us.** Parse `Traindate`,
   `Origintime`, `Destinationtime` and `Lastlocation`. Keep a short,
   bounded history of board observations per train, and prune it. Fix the
   README's claim that we show line status for the island of Ireland.
2. **A page for each Iarnród Éireann train** that has appeared on a
   board, and tracking it, in two parts:
   - **2a:** the train page, built from the board history, and a link to
     it from each board row. No tracking, and nothing but release v0.3.0.
   - **2b:** "Track this train", one-leg journeys, and
     `train_current_state` derived from the boards.
3. **Delay pushes** for tracked Iarnród Éireann trains, using the
   notifier's existing ranking and decision rules.
4. **Groups, sharing and the API:** tracked Irish trains work in groups and
   share links, and the personal-token and delegated APIs can read and
   track them.

Non-goals:

- No new upstream calls. We won't call `getTrainMovementsXML`,
  `getCurrentTrainsXML` or the boards more often (§7).
- No NI Railways tracking. There is no live NI Railways feed (pages §1).
- No timetable. The GTFS feed gives us stations and lines, not trips
  (pages §1). So a train that hasn't yet appeared on any board can't be
  tracked (§9).
- No cancellation or skipped-stop pushes. The fields we can see don't say
  when a train is cancelled or misses a stop (§6.4).
- No Irish stations in the journey planner, and no multi-leg journeys
  mixing GB and Irish legs. Each Irish track is a one-leg journey.

## 3. Identity

**The uid.** We use `ie:<TRAINCODE>`, for example `ie:A120`. The code is
upper-cased and trimmed, and must match `^[A-Z0-9]{1,8}$`. A CIF uid, a
TRUST id or a Darwin RID never contains `:`, so it can never collide with
this one. The trip planner's transit uids (`<network>:<n>`, ds-api
`data/transit_planning.rs:241-251`) also use a colon. That is why
`is_transit_uid` (`uid.contains(':')`) must be narrowed in the same change,
so it doesn't treat `ie:` as a transit trip. `split_uid` already rejects
`ie:A120`, because `A120` isn't a number. The `ie` prefix is reserved and
must never be used as a transit network id.

**The service date is `Traindate`.** Train codes are reused every day.
`Traindate` is the day the train *started*, so it stays the same when a
train runs past midnight. A board polled at 00:20 on the 6th that shows a
train which left Connolly at 23:50 on the 5th says `05 Nov 2026`. Each
train is identified by `(train_code, Traindate)`, and the uid keeps its
`trains.service_date` from that.

- We parse `Traindate` as `%d %b %Y`.
- If a departure's `Traindate` is missing or won't parse, it stays on the
  latest board as it does today, but it isn't written to the history and
  can't be tracked. We count these in a metric. We never guess the date
  from the poll time.

**The network.** Every row carries `network` (`republic-of-ireland` today),
because the history tables are keyed by `(network, train_code, train_date)`.
If NI Railways times ever arrive, its codes won't collide with Iarnród
Éireann's.

**The time zone.** Board times are Irish local time (Europe/Dublin). Dublin
and London have the same offset and the same daylight saving dates, but we
still convert using Europe/Dublin, so the code says what it means. "Today"
for Irish trains is Dublin's date.

## 4. Data model (ds-core)

Every migration below is expand-only. Each starts with
`SET LOCAL lock_timeout`, adds nothing that rewrites a table, and puts a
new constraint on `NOT VALID` with a separate validate migration. None
needs a `-- contract:` header.

### 4.1 Phases 1 and 2a: wire fields and board history (release v0.3.0)

**`common::island_of_ireland::IslandOfIrelandDeparture`** gains four
optional fields. Each uses `#[serde(default, skip_serializing_if = "Option::is_none")]`,
like the existing optional fields:

| Field | From | Notes |
|---|---|---|
| `train_date: Option<NaiveDate>` | `Traindate` | serialised as `YYYY-MM-DD` |
| `origin_time: Option<String>` | `Origintime` | `HH:MM` |
| `destination_time: Option<String>` | `Destinationtime` | `HH:MM` |
| `last_location: Option<String>` | `Lastlocation` | trimmed; blank becomes `None` |

The wire format stays `ioi-station-samples/1`. Adding optional fields is
compatible in both directions: an old writer ignores the new fields, and a
new writer decodes `None` from an old poller. Bumping to `/2` would park
every entry with an old writer. The struct isn't `#[non_exhaustive]`, and
ds-pollers builds it as a literal, so this is a breaking Rust change.
Under the 0.x rule in ds-core's README, the release is **minor (v0.3.0)**.
`Direction`, `Traintype` and `Locationtype` are still left out: nothing
reads them yet.

**Migration `20261105120000_island_of_ireland_train_history.sql`** adds two
new tables:

```sql
SET LOCAL lock_timeout = '5s';

-- One row per train per service date: the newest observation of it on
-- any board. Raw feed values; interpretation is §6's, at read time.
CREATE TABLE island_of_ireland_trains (
    network          TEXT NOT NULL,
    train_code       TEXT NOT NULL,
    train_date       DATE NOT NULL,
    origin           TEXT NOT NULL,
    destination      TEXT NOT NULL,
    origin_time      TEXT,            -- HH:MM, Europe/Dublin
    destination_time TEXT,
    status           TEXT NOT NULL,   -- feed text, e.g. 'En Route'
    late_minutes     INTEGER,         -- the feed's Late, as sent
    last_location    TEXT,            -- e.g. 'Departed Dundalk'
    first_seen_at    TIMESTAMPTZ NOT NULL,
    last_seen_at     TIMESTAMPTZ NOT NULL,  -- newest board it was on
    changed_at       TIMESTAMPTZ NOT NULL,  -- newest change to the values
    PRIMARY KEY (network, train_code, train_date),
    CHECK (train_code ~ '^[A-Z0-9]{1,8}$')
);
CREATE INDEX island_of_ireland_trains_train_date
    ON island_of_ireland_trains (train_date);

-- One row per train per station it was seen at: that board's times.
CREATE TABLE island_of_ireland_train_calls (
    network             TEXT NOT NULL,
    train_code          TEXT NOT NULL,
    train_date          DATE NOT NULL,
    station_code        TEXT NOT NULL,   -- the live StationCode
    scheduled_arrival   TEXT,            -- HH:MM; NULL for the feed's 00:00
    scheduled_departure TEXT,
    expected_arrival    TEXT,
    expected_departure  TEXT,
    late_minutes        INTEGER,
    first_seen_at       TIMESTAMPTZ NOT NULL,
    changed_at          TIMESTAMPTZ NOT NULL,  -- when these values were seen
    PRIMARY KEY (network, train_code, train_date, station_code),
    CHECK (train_code ~ '^[A-Z0-9]{1,8}$')
);
CREATE INDEX island_of_ireland_train_calls_train_date
    ON island_of_ireland_train_calls (train_date);

ALTER TABLE island_of_ireland_train_calls SET (
    autovacuum_vacuum_scale_factor = 0.05,
    autovacuum_analyze_scale_factor = 0.05);
ALTER TABLE island_of_ireland_trains SET (
    autovacuum_vacuum_scale_factor = 0.05,
    autovacuum_analyze_scale_factor = 0.05);
```

The indexes are on tables created in the same file, which
`migration_index_locking.rs` allows.

Why two tables rather than an append-only log:

- The page needs each train's calling points and its newest state, and
  these two tables give exactly that.
- A log row per poll would mean about 1,700 rows every 5 minutes, which is
  nearly 500,000 a day.
- Keyed upserts that skip unchanged rows only write when something
  changes. A call row has no "last seen" column for that reason. Only the
  train row's `last_seen_at` moves on every cycle (§4.3).

**`ds_store::samples::island_of_ireland`** gets two new functions, which
the writer's `ioi-station-samples/1` handler calls in the same
transaction as `upsert_station_samples_observed`:

- `record_train_history` writes both tables. It uses the same ordering
  guard as the samples: an older observation never overwrites a newer
  one. Departures with no parseable `Traindate`, or a code that fails the
  `CHECK`, are skipped and counted.
- `prune_train_history` deletes rows whose `train_date` is before the
  cutoff the writer passes, at most 2,000 per table per call (§4.3).
- The feed's `00:00` "none" value is turned into `NULL` here, once, so the
  history never stores it. The latest-board table keeps the feed's values
  as it does today.

The interpretation of §6 is `common::island_of_ireland::train_state`, a
pure function, so the api (2a) and the writer (2b) read the feed the same
way.

**Grants (`db-grants.yaml`):** both tables are class `ingest`. The writer
gets `SIUD` (D is for the prune) and the api gets `S`. No other role gets
access. `access/postgres-grants.sql` is re-rendered.

### 4.2 Phase 2b: tracking (release v0.4.0)

**Migration `20261106120000_ireland_train_tracking.sql`:**

```sql
SET LOCAL lock_timeout = '5s';

-- Display names for a train with no GB station codes (Iarnród Éireann's
-- Origin/Destination). NULL for every GB train.
ALTER TABLE trains ADD COLUMN origin_name TEXT;
ALTER TABLE trains ADD COLUMN destination_name TEXT;
ALTER TABLE trains ADD CONSTRAINT trains_endpoint_names_check
    CHECK ((origin_name IS NULL OR char_length(origin_name) BETWEEN 1 AND 100)
       AND (destination_name IS NULL OR char_length(destination_name) BETWEEN 1 AND 100))
    NOT VALID;

-- A network-neutral station reference beside the CRS pins:
-- '<network>:<code>', e.g. 'ie:CNLLY'. NULL for every GB pin.
ALTER TABLE train_subscriptions ADD COLUMN pin_origin_ref TEXT;
ALTER TABLE train_subscriptions ADD COLUMN pin_destination_ref TEXT;
ALTER TABLE train_subscriptions ADD CONSTRAINT train_subscriptions_pin_ref_check
    CHECK ((pin_origin_ref IS NULL OR pin_origin_ref ~ '^[a-z]{2,8}:[A-Z0-9]{1,12}$')
       AND (pin_destination_ref IS NULL OR pin_destination_ref ~ '^[a-z]{2,8}:[A-Z0-9]{1,12}$'))
    NOT VALID;
```

**Migration `20261106120100_ireland_train_tracking_validate.sql`:**
`SET LOCAL lock_timeout`, then `VALIDATE CONSTRAINT` for each of the two
constraints. These can ship in the same release, as
`20261031090000` and `20261031090100` did.

The pin key stays as it is. GB pins are still CRS plus departure time. An
Irish subscription doesn't need a pin to resolve, because it is bound to
its `trains` row when it is created (§5.3). Its pin CRS columns stay NULL,
which keeps it out of trust-consumer's CRS-and-time heuristic
(`process.rs:668-681`). The refs record which board the user tracked it
from, so the page and the push can say "from Dublin Connolly".

**ds-store code** for 2b:

- **Two-tier prune.** `prune_train_history` keeps a train's history for
  the tracked window when a `trains` row with its `ie:` uid and date has a
  subscription, and for the untracked window otherwise (§4.3).

- **Derive the state of tracked Irish trains (§6).** After the history
  write, for each `trains` row whose `train_uid = 'ie:' || train_code` and
  whose `service_date` is that train's `train_date`, upsert its
  `train_current_state`. When the state's status or delay changes, insert a
  `notifier_forward_queue` row with dedup key
  `ie:<code>:<date>:<status>:<delay>`, so the notifier wakes (§8). This
  path never goes through `upsert_train_event_on` or the train event
  outbox. Their cancellation and resolution side effects are GB-only.
- **Reconciliation.** `list_trains_needing_schedule_enrichment`
  (`sweeps/reconciliation.rs:88`) gains `AND tr.train_uid NOT LIKE 'ie:%'`.
  Without it, every Irish train runs one CIF lookup every 5 minutes and
  finds nothing.

**Grants:** the writer already has `SIU` on `trains` and
`train_current_state`, and `SI` on `notifier_forward_queue`, so no new
grants are needed. The two new `train_subscriptions` columns are written
only by the api, which already has full DML on that table.

### 4.3 Retention and volume

**The windows match National Rail's.** Here is what DS keeps for the GB
data that plays the same part. These are the chart and code defaults, and
production doesn't override any of them:

| GB data | Kept | Where it's set |
|---|---|---|
| `station_samples` (LDBWS boards) | the latest board per station only; no history | aggregator `prune_orphaned_station_samples` |
| `tracked_stop_boards`, `tracked_stop_arrival_boards` | 24 hours after the last poll | aggregator `prune_tracked_stop_boards` |
| `trains` with `train_movement_events` and `train_current_state` (cascade), no subscription | **14 days** of `service_date` | `untrackedTrainsRetentionDays` (`untracked_trains_retention_days`) |
| the same, with a subscription | **30 days** | `trainsRetentionDays` (`trains_retention_days`) |
| `line_status_daily_stats` (LDBWS-derived) | 300 days, under the LDBWS licence's one year | `dailyStatsRetentionDays` |

So the Irish windows are as follows:

- **`island_of_ireland_station_samples`** stays latest-only, like
  `station_samples`.
- **`island_of_ireland_trains` and `island_of_ireland_train_calls`** are
  per-train observations, the role `trains` and `train_movement_events`
  play for GB. They keep **14 days** of `train_date`, the untracked tier.
  From 2b, a train that someone tracks keeps its history for **30 days**,
  the tracked tier. Its `trains` row tells the prune which tier applies.
  Its `trains` and `train_current_state` rows are pruned with every other
  train by the aggregator's `prune_trains`.
- The writer takes `--ioi-train-history-retention-days` (default 14), the
  way the aggregator takes its windows. 2b adds
  `--ioi-tracked-train-history-retention-days` (default 30).

None of this is personal data. The history holds train codes, station
codes, times and the feed's text, with no user id. In 2b, whether a train
is tracked is read from `trains`, which is shared train data. The
personal rows (`train_subscriptions`, journeys) keep their own 548-day
rule (ds-api `docs/personal-data-retention.md`).

**Sizing for 171 stations every 5 minutes.** These are estimates, to be
checked with a read-only count once phase 1 has run for a day.

- **Observations:** 171 boards a cycle with about 10 trains each is about
  1,700 departures a cycle, or about 490,000 a day. Upserts absorb almost
  all of them, because an unchanged call row isn't written.
- **`island_of_ireland_train_calls`:** about 800 to 1,500 trains a day,
  Iarnród Éireann and DART, each seen at about 12 stations. That is
  10,000 to 18,000 rows a day, so 140,000 to 250,000 rows over 14 days, at
  roughly 150 bytes a row with its index. That's under 50 MB. A row is
  rewritten only when its times change.
- **`island_of_ireland_trains`:** 800 to 1,500 rows a day, so 11,000 to
  21,000 over 14 days. About 150 to 300 trains are on some board at any
  time, and each one's `last_seen_at` moves once a cycle. That's 43,000
  to 86,000 small updates a day. The writer skips a bump when the stored
  value is under 4 minutes old, so duplicate snapshots in a cycle cost
  nothing.
- **The prune** runs at the end of every apply, 288 times a day. Each run
  deletes up to 2,000 rows per table older than the cutoff, using the
  `train_date` index. That's a capacity of 576,000 rows a day against an
  intake of at most 18,000, so a day's rows age out within the first 9
  cycles after they pass the cutoff. When nothing is due, it's one index
  probe. If the poller is switched off, nothing is written and nothing
  needs pruning. That's why the prune lives in the apply, not in a new
  loop with its own advisory lock.

## 5. API contract (ds-api)

Every change is additive. Each one gets an `api-changelog.md` entry and
regenerated types. Field names are as served (camelCase).

### 5.1 Phase 2a: board fields

The `GET /public/island-of-ireland/stations/{id}/departures` rows
(`IslandOfIrelandDepartureResponse`) gain `trainDate` (`YYYY-MM-DD` or
`null`), `originTime`, `destinationTime` and `lastLocation` (each
`string | null`). The board uses `trainDate` to build each row's link.

### 5.2 Phase 2a: the train

**`GET /public/island-of-ireland/trains/{trainCode}/{date}`** is public and
unauthenticated, and sends `Cache-Control: no-store`. It is in the
`TrainByUid` rate-limit tier.

```jsonc
// IslandOfIrelandTrainResponse
{
  "network": "republic-of-ireland",
  "trainCode": "A120",
  "serviceDate": "2026-11-05",
  "origin": "Dublin Connolly",
  "destination": "Belfast",
  "originTime": "15:50",            // null when not sent
  "destinationTime": "17:58",
  "live": {
    "state": "running",             // "noReport" | "running" | "arrived" | "notSeenRecently"
    "lateMinutes": 2,               // null unless state is running or arrived
    "lastLocation": { "event": "departed", "place": "Dundalk" },  // or null
    "observedAt": "2026-11-05T16:59:57Z"   // when a board last showed it
  },
  "calls": [                        // stations it was seen at, in running order
    {
      "stationCode": "CNLLY",
      "stationId": "8220IR0007",    // catalogue id via live_code; null if none
      "name": "Dublin Connolly",    // catalogue name, else the live list's
      "scheduledArrival": null, "scheduledDeparture": "15:50",
      "expectedArrival": null, "expectedDeparture": "15:52"
    }
  ],
  "firstSeenAt": "2026-11-05T14:21:40Z",
  "lastSeenAt": "2026-11-05T16:59:57Z"
}
```

- It returns 404 when the train is in neither history table. A train we
  haven't seen is unknown. We don't make up a page for it.
- `trainCode` must match `^[A-Z0-9]{1,8}$` after trimming and upper-casing,
  and `date` must be a `YYYY-MM-DD` date. Anything else is a 400. A date
  outside the retained days is simply not found.
- The route is keyed by train code and date, not by an `ie:` uid. No
  `trains` row is involved in 2a, and no uid reaches the by-uid routes or
  the planner, so 2a doesn't need §5.3's hardening.
- `calls` is sorted by the call's scheduled time, taking the arrival when
  there is no departure. A time earlier than `originTime` counts as the
  next day, so a train running past midnight keeps its order.
- Times stay as the feed's `HH:MM` strings, as on the departures route.
  They are Irish local time.
- `live` follows §6.
- The route template joins the usage-event allowlist, so the frontend can
  count the page.

### 5.3 Phase 2b: tracking

**`POST /Journeys/irish-train`** takes a session cookie, an Origin check
and the `PublicWrite` rate-limit tier.

```jsonc
// request
{ "trainCode": "A120", "serviceDate": "2026-11-05", "fromStation": "CNLLY" }   // fromStation optional
// 201 (new) or 200 (already tracked: the existing journey)
{ "journeyId": 812, "trackingId": 4411 }
```

Validation:

- The code and date follow the rules of §5.2's GET.
- `serviceDate` must be Dublin's today or yesterday, and the train must be
  in `island_of_ireland_trains` (otherwise 404, "We haven't seen this
  train on a departure board.").
- `fromStation`, when given, must be one of that train's `calls`
  (otherwise 400).
- The existing caps apply: `MAX_FUTURE_PINS_PER_USER` and the journey cap.

In one transaction it:

1. calls `find_or_create_train('ie:A120', date)`;
2. sets `trains.origin_name`, `destination_name` and `scheduled_departure`
   (`originTime` on `train_date`, in Europe/Dublin);
3. inserts `train_subscriptions` with `trains_id` set,
   `resolution_status = 'resolved'`, NULL CRS pins and `pin_origin_ref =
   'ie:CNLLY'`;
4. inserts a one-leg journey (`kind = 'train'`, NULL CRS) and records the
   journey revision.

It skips `enrich_shared_train`, the CIF match and the backlog match. It
also derives the first `train_current_state` from the stored history, so
the new journey shows the train's current state without waiting for the
next poll.

This is a dedicated route rather than a new `POST /Journeys` leg mode. That
keeps `validate_train_uid` and the knownTrain checks GB-only and leaves the
GB request schema alone. It also gives phase 4 a single route to add to
`DELEGATED_ROUTES`.

**Reads of a tracked Irish train.** Phase 2b changes these routes:
`TrackedTrainState` (`GET /Train/{id}`, `/Train/mine`, and the journey
detail's legs), `TrackedTrainListItem` and `JourneyListItem`.

- Each gains `irishTrain: { trainCode, serviceDate } | null`, set when the
  uid starts with `ie:`. Clients use it to link to the Irish train page.
- The origin and destination names fall back to
  `trains.origin_name`/`destination_name`. This covers `leg_crs_sql`'s
  names and the `stations` joins.
- `lastReportedLocation` for an Irish train is the place name, and its
  `lastEventType` is `ARRIVAL` or `DEPARTURE` from §6.
- `operatorName` is "Iarnród Éireann" (a constant, not from CIF).
- Nothing else changes shape. `journeyStops`, `cancellation`, `predictedStart`
  and the skip flags are `null`, which the GB clients already handle.
- `GET /Train/by-uid` stays GB-only. It still uppercases and validates as
  it does now.

**Hardening that ships with 2b**, the first phase that puts `ie:` uids into
`trains`:

- `is_transit_uid` excludes `ie:`.
- The journey-break sweep ignores `ie:` trains, so a GB planner run is
  never started for one. Today it's skipped only because the pin's
  departure time is NULL.
- The by-uid routes keep upper-casing GB uids. The Irish track route
  builds `ie:` plus the upper-cased code itself and never upper-cases the
  prefix, so the row the writer looks up is the row the api made.
- Tests pin all three rules.

### 5.4 Phase 4: groups, sharing and tokens

- **Groups and share links already work with any uid.** Adding a tracked
  train shares its one-leg journey (`group_journeys`), and members and
  unlisted links read it through `build_journey_detail_response`. Phase 4
  adds the name fallback from §5.3 to `list_group_trains`,
  `list_group_journeys` and `list_shared_trains_for_user` (`GroupTrain`,
  `GroupJourney` and `SharedTrain`), and adds `irishTrain` to those types.
- **Delegated API.** `DELEGATED_ROUTES` gains
  `(POST, "/Journeys/irish-train", Scope::JourneysWrite)`, and its handler
  takes `DelegatedOrSessionUser<WriteScope>`. The pinned test is updated.
  Irish journeys already show up in the delegated `GET /Journeys/mine` and
  `GET /Journeys/{id}`, with the fields above.
- **Personal tokens and OpenAPI.**
  - `TOKEN_ROUTES` gains `/v1/island-of-ireland/trains/{trainCode}/{date}`
    (`TrainsRead`, train route class, max-age 30), with a `describe()` arm.
  - Its sources are a new `IRISH_RAIL_REALTIME` source carrying the
    courtesy credit already used on the pages (pages §7).
  - `api-types/openapi/v1.json` is regenerated, and `oasdiff` must report
    no breaking change.
  - `docs/personal-api-tokens.md` lists the route.

## 6. From board observations to train state

The rule: **a train we haven't seen is unknown, not on time.** Each state
below needs a board observation behind it. When none supports it, we say
we don't know.

### 6.1 What one observation tells us

A train shows up on the board of each station it is due at in the
look-ahead window. In one cycle we may see it on several boards. `Late`,
`Status` and `Lastlocation` describe the whole train. The scheduled and
expected times are for that station.

These are the only `Status` values in our captured responses: `En Route`
and `No Information`. In the captures, the second always comes with an
empty `Lastlocation`. `Lastlocation` reads `Departed <place>` or
`Arrived <place>`.

### 6.2 Interpretation

The interpretation lives in one function in `common::island_of_ireland`.
The api and the writer both call it, and it is unit-tested against
fixtures shaped like the real XML.

| Observation (newest board showing the train) | `live.state` (2a) | `lateMinutes` | `train_current_state` (2b) |
|---|---|---|---|
| Never seen (no history row) | none: 404, or "No live report yet" on a tracked train | none | no row |
| `No Information`, empty `Lastlocation` | `noReport` | `null`: `Late` is `0` here and means nothing | `awaiting_activation`, delay `NULL` |
| `Lastlocation` is `Departed X` or `Arrived X`, X not the destination, or `Status` is `En Route` | `running` | `Late` | `en_route`, delay `Late`, location X, event `DEPARTURE` or `ARRIVAL` |
| `Lastlocation` is `Arrived <Destination>` | `arrived` | `Late` | `completed`, delay `Late` |
| Seen before but on no board for 30 minutes, and not arrived | `notSeenRecently` | the last `Late`, shown as "Last reported 14:05" | unchanged (no write) |
| Any other `Status` text | `noReport` if `Lastlocation` is empty, otherwise `running` | as above | as above |

- **`event_time`** is the board's `polled_at`, which is when we saw it, not
  when the train moved. The writer's ordering guard compares it, so a
  late, older snapshot never replaces newer state.
- **No completion we haven't seen.** If a train drops off every board
  without an `Arrived` at its destination, it stays `en_route` until the
  existing `finish_stale_en_route_trains` sweep closes it, two days after
  its service date. The page says "We last saw this train at 14:05",
  using `notSeenRecently`, which is worked out at read time from
  `lastSeenAt`.
- **Different `Late` values in one cycle.** We take the board with the
  newest `polled_at`. On a tie, we take the lowest station code, so the
  result is deterministic.
- **An unrecognised `Status` value** is stored in the history as sent and
  counted (`ioi_unrecognised_status_total`, no label), and §6.2's
  fallback applies. "Terminated" and "Cancelled" are plausible values, but
  we haven't seen them in a capture, so we don't map them until one turns
  up in a fixture.

### 6.3 Coverage

All 171 boards are polled, and every train is written to the history, not
only tracked ones. So by the time a train runs, we have seen it at each
station that showed it inside the look-ahead window. A train's calls are
missing only when:

- a cycle ran out of time;
- the poller was off;
- the train called somewhere that isn't in `getAllStationsXML`.

The page says that the stations come from departure boards. Updates are at
most 5 minutes apart, the poll interval, and we say so.

### 6.4 Skips and cancellations

None of the fields above says a train is cancelled or will miss a station.
A row that disappears could mean a cancellation, the look-ahead window
moving on, or a cycle that ran out of time, and we can't tell which. So
phase 3 sends no skip or cancellation pushes, and we never set `cancelled`.
If a capture ever shows a cancellation `Status`, that's a small follow-up
in §6.2's function.

## 7. Polling budget

Irish Rail publishes no licence or rate limit for this service (support §8
question 4), so these phases don't add a single upstream request:

- Volume stays at 1 + 171 requests every 300 s, about 49,500 a day, with
  the same User-Agent and the 240 s cycle budget.
- Tracking, the train page and pushes all read the history that the
  existing boards produce. Tracking a train adds no request, and neither
  do a thousand users tracking it.
- `getTrainMovementsXML` (one train's full stopping pattern) would fill
  the coverage gaps in §6.3, but it costs one call per tracked train per
  cycle. It is out of scope. If it ever comes in, it needs its own cap and
  a decision on the terms.

What this costs us: a delay shows up at most about 5 minutes after the
board does, plus the writer's lag, and a train is only trackable once it
has appeared on a board.

## 8. Notifications (ds-workers)

The notifier needs no schema change and no core bump. Here is how an Irish
train moves through it, read from `bfaecf9`:

1. The writer's forward-queue row (§4.2) puts the train's `trains_id` into
   `run_forward_queue_cycle`, then `candidates_for_trains_id`.
2. That reads `train_current_state.status` and `delay_minutes`.
3. `subscriber_stop_delays` finds no stop CRS, no movements and no CIF
   calls for `ie:` uids, so it falls back to the working delay, which is
   `Late`.
4. `train_severity_rank` gives rank 1 at or above the user's threshold.
   That threshold is `notification_preferences.delay_threshold_minutes`,
   or the default `--train-delay-threshold-minutes 15`. Pushes go out on
   escalation only and never twice for the same rank. Quiet hours, snooze
   and holds apply as for GB.
5. The single-leg copy is "Your train is delayed", "Now running about N
   minutes late.", linking `/train/by-id/{trackingId}`. The frontend
   redirects that link to the Irish page (§9).

**The threshold.** We keep the user's own threshold, defaulting to 15
minutes, for Irish trains too. A separate Irish default would be a second
setting that users can't see. `Late` comes in whole minutes and is
measured against the timetable, so it matches what the threshold means
for GB. A `noReport` train has a `NULL` delay, so its placeholder `Late`
of 0 can never rank.

Phase 3 is therefore mostly tests: DB tests from the `settings_db_tests.rs`
harness for:

- an `ie:` train with NULL CRS that escalates from 14 to 16 minutes and
  pushes once;
- a `noReport` train that never pushes;
- the copy for a NULL-CRS leg.

One code change goes with them: the copy says "from Dublin Connolly" when
`pin_origin_ref` names a station. That needs the v0.4.0 core, so the
ds-workers PR bumps v0.1.0 to v0.4.0. That jump crosses v0.2.0's changes,
which the PR checks.

## 9. Frontend (distant-signal)

The frontend follows [the frontend design guide](../../frontend-design-guide.md)
and [the style guide](../../style-guide.md). Wherever the data fits, it
reuses the GB train page's parts.

**Route:** `/island-of-ireland/iarnrod-eireann/trains/[code]/[date]`. It
sits under the network because the train belongs to it (pages §2), and the
URL date is the service date.

**The page (2a):**

- **Title and h1:** "15:50 Dublin Connolly to Belfast", from `originTime`,
  `origin` and `destination`, through `lib/trainName.ts`'s pattern. Under
  it, a dimmed line: "Train code A120 · Wednesday 5 November". The page is
  `noindex`, like GB train pages. The meta description is the evergreen
  sentence the GB page uses.
- **Status**, one block:
  - `running`: `DelayBadge` from `lateMinutes` ("2 min late", "On time",
    "1 min early"), plus "Left Dundalk" or "At Dundalk". The feed's
    "Departed X" and "Arrived X" are mapped to our words and never shown
    raw.
  - `arrived`: "Arrived at Belfast", with its `DelayBadge`.
  - `noReport`: "No live report yet" in gray, with no badge.
  - `notSeenRecently`: "We last saw this train at 16:59" in gray, with no
    badge.
- **Calling points:** a `ServiceRowList` of `calls`, each with the
  expected time, the station (linked to its station page when it has a
  `stationId`) and "Timetabled 15:50" when that differs. A dimmed note
  under it: "Stations from live departure boards, which show trains due
  in the next 90 minutes."
- **Freshness:** one `LastUpdated` from `lastSeenAt`, then "Local times".
  We don't write "UK local time" because the train isn't in the UK.
- **Actions:** `ShareButton`. There is no track button until 2b.
- **Credits:** the live courtesy credit (`IrelandAttributionNote`).
- **Failure and empty states:**
  - a 404 shows the section's not-found page ("We haven't seen this
    train", with a link back to the network);
  - a fetch failure shows "Couldn't load this train. Try again."
    (`describeFailure`).
  - Unknown values are left out, never made up.

**Board rows link to the train (2a).** Each `IrelandDepartureBoard` row with
a `trainDate` becomes a `ServiceRow`-style link to its train page. A row
without one stays as plain text. This replaces pages §2's "No row links".
The status words stay hidden. The new route template joins
`lib/usageEvents.ts` once ds-api accepts it.

**Tests (2a):**

- vitest for the page states and the row link.
- `frontend/e2e/fixtures/seed.sql` gains `island_of_ireland_trains` and
  `island_of_ireland_train_calls` rows for the seeded A101.
- `ireland.spec.ts` follows a board row to the train page.
- `accessibility.spec.ts` adds the train page.
- A visual baseline `ireland-train` at 390 and 1366 px, light and dark,
  with "Updated" masked. It is generated only with
  `scripts/visual-tests.py --update` in the Playwright container, and
  every image is reviewed.

**2b adds:**

- `TrackThisTrainButton` with an Irish target, posting to
  `POST /Journeys/irish-train` with `fromStation` from a `?from=` query
  that the board links start carrying. The group picker and redirect are
  the same as for GB. When the visitor already tracks the train, the owner
  controls appear instead.
- `/train/by-id/[trackingId]` redirects to the Irish page when the train
  has `irishTrain`.
- Journey and tracked-train rows link the same way and use the names from
  §5.3.
- vitest for the track button and the redirect; the seed gains a tracked
  `ie:A101` with its journey; e2e tracks it.

**Phase 4:** the group page's shared train and journey rows use the name
fallback and link Irish trains to their page. That needs vitest and an
e2e test of a shared Irish journey.

## 10. Rollout and PR order

ds-core goes first, then its release, then the consumers. Every PR body
states its deploy order, and the user bumps the ds-deploy pins. Nothing
new needs a feature flag:

- the history is written only while the Irish live poller runs, and it is
  switched off by default;
- the train page is reachable only from a board row;
- Irish tracking (2b) is reachable only from the train page.

**Phase 1 and 2a**, on release v0.3.0:

| # | Repo | Phase | What | Deploy order |
|---|---|---|---|---|
| 1 | distant-signal | none | This design note | none |
| 2 | ds-core | 1, 2a | Optional departure fields, history tables, `record_train_history` and `prune_train_history`, `train_state`, grants | merge, then the v0.3.0 release PR |
| 3 | ds-ingest | 1 | Core v0.3.0; the writer records and prunes the history (`--ioi-train-history-retention-days`, 14) | migrate v0.3.0, then the writer |
| 4 | ds-pollers | 1 | Parse `Traindate`, `Origintime`, `Destinationtime`, `Lastlocation`; core v0.3.0 | after #3, or the old writer drops the fields |
| 5 | distant-signal | 1 | README: no line status for the island of Ireland | any time |
| 6 | ds-api | 2a | Core v0.3.0; board fields; `GET /public/island-of-ireland/trains/{trainCode}/{date}`; usage-event template; changelog; types | after migrate v0.3.0; best after #4 so the board fields are filled |
| 7 | distant-signal | 2a | Train page, row links, seed, vitest, e2e, axe, visual | after #6's image is pinned (`sync-api-types.py pin --latest`) |

**2b, then phases 3 and 4**, on release v0.4.0:

| # | Repo | Phase | What | Deploy order |
|---|---|---|---|---|
| 8 | ds-core | 2b | `trains` names, pin refs and their validation, tracked-state derivation, forward signal, two-tier prune, reconciliation filter | release **v0.4.0** |
| 9 | ds-ingest | 2b | Core v0.4.0: derive state, queue signals, `--ioi-tracked-train-history-retention-days` (30) | migrate v0.4.0, then the writer |
| 10 | ds-api | 2b | `POST /Journeys/irish-train`, read fallbacks, `irishTrain`, `is_transit_uid`, uid-case and break-sweep hardening, changelog, types | after migrate v0.4.0 |
| 11 | distant-signal | 2b | Track button, redirect, journey rows, seed, e2e | after #10's image is pinned |
| 12 | ds-workers | 3 | Core v0.4.0, "from" copy, Irish push tests | after #9 |
| 13 | ds-api | 4 | Group name fallbacks, delegated route, token route, OpenAPI, changelog | after #10 |
| 14 | distant-signal | 4 | Group rows for Irish trains | after #13's image is pinned |

To roll back, revert a consumer to the previous core. The tables and
columns are additive and stay in place. Old code never reads them.

## 11. Sizing and decisions

The phases were sized S, M, S and S. After the research, phase 1 is S,
but phase 2 is closer to L. On 2026-11-05 the user decided:

1. **Split phase 2.** 2a is the history-backed train page and the board
   links; it needs only v0.3.0. 2b is tracking, journeys and pushes, with
   phases 3 and 4 on top.
2. **Retention matches National Rail's** equivalent data: 14 days, and
   30 for a tracked train (§4.3).

## 12. Open questions

1. **Look-ahead window.** Is the board's default window 90 minutes? This
   sets how early a train becomes trackable and the wording of the
   page's note. It needs a capture taken by hand, not by our code.
2. **Status vocabulary.** Do `Terminated` and `Cancelled` exist, and when
   do they appear? Until a capture shows them, §6.2 treats them as
   unrecognised.
