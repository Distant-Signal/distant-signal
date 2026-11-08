# Regular journeys

Design, 2026-11-06. Status: **proposed** (DS-376). It covers phases 1 to 5
of turning journey templates into "Regular journeys": daily commutes that
appear the evening before, say when to leave, pick the day's train with
the planner, suggest a new route when the day goes wrong, and skip bank
holidays. Implementation waits for review.

"§" alone means a section of this document. "Templates §n" means
[the reusable and repeating journeys design](2026-09-22-reusable-repeating-journeys-design.md),
whose phases A to C are built (its phase D, the manual-mode reminder,
never was). "Breaks §n" means
[the mid-journey changes design](2026-10-22-mid-journey-changes-design.md).

The claims below were checked against `main` on 2026-11-06: ds-core
`70e4774` (v0.4.1), ds-api `b3aef0f`, ds-workers `f4fe769`, ds-deploy
`653068c` and distant-signal `91cbb814`. Line numbers are from those
commits.

## 1. What we have today

**Templates (ds-core, ds-api).** `20260922140000_journey_templates.sql`
created `journey_templates` (`days_of_week` bitmask, `active`,
`starts_on`, `ends_on`, `default_match_mode` `manual` or `auto`,
`auto_commit_rule`) and `journey_template_legs` (origin and destination
station codes and four optional window bounds; no date, no train).
`journeys.source_template_id` links an occurrence back, `ON DELETE SET
NULL`. `20260925214500_journey_template_skipped_dates.sql` adds the
`(template_id, service_date)` tombstones that `journeys::delete_journey`
writes when an occurrence is deleted (`record_template_occurrence_skips`,
ds-api `data/journeys.rs:2705`), so the sweep doesn't mint it again.
ds-api's `routes/journey_templates.rs` serves `POST /JourneyTemplates`
(`manual` legs or `fromJourney`), `GET /JourneyTemplates/mine`,
`GET`/`PUT`/`DELETE /JourneyTemplates/{id}` (PUT is a full replace) and
`POST /JourneyTemplates/{id}/materialize` ("Run now"). A user may own 50
templates (`MAX_JOURNEY_TEMPLATES_PER_USER`); occurrences don't count
towards the 1000-journey cap (`data/journeys.rs:481`).

**The sweep (ds-workers).** `run_template_sweep_cycle`
(`crates/notifier/src/main.rs:1116`) runs every
`notifier.templateSweepPollIntervalSecs` (3600). Stage 1 mints **today's**
occurrence of every due template (`queries::due_templates_for`,
`materialize_due_template_occurrence`, idempotent per template and date,
honouring tombstones), every leg `unmatched`. Stage 2 takes `auto`
templates' unmatched legs within `autoCommitLeadMinutes` (120) of their
window, asks `schedule_candidates_for_leg` (a calling-point query, not the
planner) and commits nearest-to-now. With no candidates on a published
day it sends "Your recurring journey needs attention" once
(`Delivered::Unmatched`, tag `journey-leg-unmatched-{leg}`), gated by
`notification_preferences.template_attention`.

**The planner (ds-api).** `GET /Trips/plan` takes `departAfter` or
`arriveBy` (exclusive), `dayOffset` 0 or 1 and `acrossMidnight`, and
searches a day's connections with CSA (`results=fastest`) or RAPTOR
(`options`) from a `GraphCache` keyed by `GraphMarker`
(`data/trip_planning.rs:577`). The live overlay swaps in cancelled and
late trains. `routes/trips.rs:2535` `plan_for_journey` already plans for a
background job: the break sweep calls it with `ReplanSlot::Sweep`, its own
semaphore (`SWEEP_PLAN_SLOTS`), and only with `TimeBound::DepartAfter`.
`POST /Journeys/itinerary` (`routes/journey_itinerary.rs`,
`journeys::create_journey_from_itinerary`) saves a planned itinerary in
one transaction. `data/journey_replace.rs` replaces a run of legs under the
journey lock and, while the journey `still_planning`
(`data/journey_revisions.rs:273`: only revision 1, never broken, not
started), refreshes revision 1 instead of writing a new one. Revision legs
carry `booked_departure`, the time Delay Repay is measured against.

**Breaks (ds-api, ds-workers).** `journey_break_sweep.rs` opens, updates
and ends breaks on today's and yesterday's journeys and plans suggestions.
`break_notices.rs` sends one push per break, again only when it gets
worse, and the push is that train's push (`push_queue.rs:564`,
`break_owns_train`, `equivalent_train_state`). All of it is off unless
`api.journeyBreaks.enabled` (default false, which also sets the notifier's
`JOURNEY_BREAK_NOTICES_ENABLED`). ds-api's docs/journey-breaks.md is the
runbook.

**Pushes (ds-workers).** `send.rs` builds each message with
`WebPushMessageBuilder` and sets only the payload and the VAPID signature.
web-push 0.11.0's builder defaults the TTL to 2,419,200 s (28 days) and
sets no `Urgency` and no `Topic`, so a delay push to a phone that is off
can arrive weeks later. `hold::gate` (`hold.rs:148`) sends cancellations
and account notices in quiet hours or a snooze, holds line and train
pushes, and drops the full-poll classes (`Gate::NotNow`); it gets one
`quiet` flag for both quiet hours and a snooze. The service worker shows
`{title, body, tag, url}` with no `renotify` (`frontend/public/sw.js:172`),
so a replacement with the same tag doesn't alert again on most browsers.
A separate ds-workers change, shipping ahead of phase 2 (decision 14),
gives every train push a 1-hour TTL; §5.3 builds on it.

**Retention (ds-api).** `data/retention.rs` deletes journeys with no leg
on or after `PAST_TRAVEL_RETENTION_DAYS` (548). Templates are never pruned.

**Frontend.** `/journeys/templates` and `/journeys/templates/[id]` ("Your
journey templates"), `SaveAsTemplateButton`, `RunTemplateNowButton`,
`EditJourneyTemplateForm` (days of week, legs). `/plan`'s `PlanTripFlow`
saves an itinerary with "Track this journey". The home page's "Current
journey" and "Upcoming journeys" (`app/(home)/HomeJourneys.tsx`,
`lib/homeJourneys.ts`) read today's journeys in full and date later ones
from the list. `/account/notifications` labels `templateAttention`
"Recurring journeys".

**Phase 0 (DS-375, in flight, not redesigned here).** The manual-mode
"pick your train" reminder; bounds derived when a template is promoted
from a journey whose leg has a train; auto mode refused for a fully open
leg; a recurrence summary on list cards. This design assumes all four have
landed and builds on them.

## 2. Decisions

Decided by the user on 2026-11-06:

1. **Name.** "Regular journeys" in the UI. `journey_templates`,
   `JourneyTemplate` and `/JourneyTemplates` stay in code and the API.
2. **Default mode** is "remind me", with a one-tap pick of the usual
   train. Auto-pick is opt-in.
3. **Occurrences are created the evening before**, at about 18:00 London
   time, so they show under Upcoming.
4. **Leave-by pushes go through quiet hours**, with a toggle to stop that.
5. **Leave-by stays at the booked time when the train is late**, and the
   push says how late. It moves only on a cancellation or an accepted
   replan.
6. **Travel time to the station is set per regular journey**, pre-filled
   from the last value for that station. No location data is used.
7. **One leave-by push by default**, with a lead of 0 to 5 minutes the
   user can set. A morning summary is optional and off by default.
8. **Bank holidays are skipped by default**, using the user's UK division.
9. **The return journey is a linked sibling template.**
10. **Reroutes are always suggestions**; nothing is accepted for the user.
11. **Occurrences with no ticket and no Delay Repay data are kept for 90
    days.**

Answered on 2026-11-06, after the first draft's open questions:

12. **The lead defaults to 0 minutes**: the push comes at the leave-by
    time, because the buffer already includes a margin.
13. **The morning summary goes 60 minutes before the day's first
    leave-by**, not at a fixed clock time.
14. **Every train push has a 1-hour TTL (3600 s)**, cancellations
    included. This ships now as its own small ds-workers change, ahead of
    phase 2. The leave-by push keeps a TTL of about 15 minutes (§5.3).
15. **Leave-by is timed from the first leg with a time**, not the first
    train leg (§5.1).
16. **Pausing deletes untouched occurrences** that are already minted
    (§4.2), rather than keeping tomorrow's for the user to skip.

## 3. The model

A regular journey is a template with a **target**: an origin, a
destination, a time kind (`depart_after` or `arrive_by`), a time and a day
offset, plus the plan options it was planned with (vias, avoids, maximum
changes, operator filter). It keeps a **usual itinerary**: the trains the
user picked when they made it (UIDs, operators and clock times). Each due
date gets an **occurrence**, an ordinary `journeys` row with
`source_template_id` set, created the evening before. Until phase 3 the
occurrence's legs come from the template legs, as now. From phase 3 the
api plans the target for the date and fills the legs from the result.

A **pair** is two templates pointing at each other through
`paired_template_id`: the outbound and the return. Pausing either pauses
both. Deleting one unlinks the other.

Templates without a target (made before phase 1, or with the old leg
editor) keep working as they do today: per-leg windows, the notifier's
candidate query, the phase 0 reminder.

## 4. Phase 1: Regular journeys UX

### 4.1 Schema (ds-core)

`2026111xxx0000_regular_journeys.sql`:

```sql
SET LOCAL lock_timeout = '5s';
ALTER TABLE journey_templates
    ADD COLUMN origin_crs         TEXT,
    ADD COLUMN destination_crs    TEXT,
    ADD COLUMN target_kind        TEXT,
    ADD COLUMN target_time        TIME,
    ADD COLUMN target_day_offset  SMALLINT NOT NULL DEFAULT 0,
    ADD COLUMN plan_options       JSONB,
    ADD COLUMN usual_itinerary    JSONB,
    ADD COLUMN paired_template_id BIGINT;
ALTER TABLE journey_templates
    ADD CONSTRAINT journey_templates_target_check CHECK (
        (target_kind IS NULL AND target_time IS NULL AND usual_itinerary IS NULL)
        OR (target_kind IN ('depart_after', 'arrive_by')
            AND target_time IS NOT NULL
            AND origin_crs ~ '^[A-Z]{3}$' AND destination_crs ~ '^[A-Z]{3}$'
            AND target_day_offset IN (0, 1)
            AND (usual_itinerary IS NULL OR jsonb_typeof(usual_itinerary) = 'object')
            AND (plan_options IS NULL OR jsonb_typeof(plan_options) = 'object'))
    ) NOT VALID,
    ADD CONSTRAINT journey_templates_paired_fkey
        FOREIGN KEY (paired_template_id) REFERENCES journey_templates (id)
        ON DELETE SET NULL NOT VALID,
    ADD CONSTRAINT journey_templates_paired_not_self
        CHECK (paired_template_id IS DISTINCT FROM id) NOT VALID;
```

Then a `_validate.sql` for the three constraints, and a `-- no-transaction`
file with `CREATE INDEX CONCURRENTLY journey_templates_paired_template_id
ON journey_templates (paired_template_id) WHERE paired_template_id IS NOT
NULL` (the FK's `ON DELETE SET NULL` scans by it). Grants: none; the table
grants already cover new columns (`db-grants.yaml:251`, notifier `SU`).

`usual_itinerary` is the selected `/Trips/plan` itinerary trimmed to what
a later day needs: per leg the kind, origin and destination, train UID,
operator and booked clock times (`HH:MM` plus a day offset), and for an
untracked leg its mode, places and minutes. Clock times, not instants: the
template has no date.

### 4.2 API (ds-api)

All additive. One changelog entry, "Regular journeys: targets, pairs and
skip next".

- `POST /JourneyTemplates` gains `mode: "plan"`: `originCrs`,
  `destinationCrs`, `target: {kind, time, dayOffset}`, `planOptions`,
  `usualItinerary` (the itinerary legs, as `POST /Journeys/itinerary`
  takes them, plus clock times), `daysOfWeek` (required), `startsOn`,
  `endsOn`, `defaultMatchMode` (`manual` by default, decision 2) and an
  optional `return` object with its own `target` and `usualItinerary`.
  The server derives the template legs from the itinerary's train legs
  with phase 0's bound derivation for a promoted train, and validates the
  legs with `leg_validation` as the itinerary route does. With `return`
  it creates both templates and links them in one transaction, and checks
  the cap for two. Response: `{id, returnId}`.
- `GET /JourneyTemplates/mine` items and `GET /JourneyTemplates/{id}` gain
  `originCrs`, `destinationCrs` (with names), `target`, `pairedTemplateId`,
  `startsOn`, `endsOn`, `defaultMatchMode`, `nextDate` (the next due date
  on or after London today that isn't skipped, `null` if none) and
  `skippedDates` (tombstones from today on). Detail also gains
  `usualItinerary` and `planOptions`.
- `PUT /JourneyTemplates/{id}`: the new fields are optional, and an absent
  field keeps its value. PUT is a full replace today, so a client built
  before this change would otherwise wipe a target it never knew about.
- `PUT /JourneyTemplates/{id}/active` `{active}`: pauses or resumes the
  template and its pair in one transaction. Pausing deletes the pair's
  occurrences dated today or later that haven't started and that the user
  hasn't touched (every train leg still unmatched, or committed by the
  sweep, and no ticket), without writing tombstones. A paused template is
  never due, so none are needed (decision 16).
- `POST /JourneyTemplates/{id}/skip` `{serviceDate?, pair?}`: tombstones
  `serviceDate` (default `nextDate`) for this template, and for its pair
  when `pair` is true. An occurrence already minted for that date is
  deleted through `journeys::delete_journey`, which writes the same
  tombstone. Refused (409) once its first leg has left. `DELETE
  /JourneyTemplates/{id}/skip/{date}` undoes it: it removes the tombstone,
  and the next sweep mints the occurrence again if it is still due.
- `DELETE /JourneyTemplates/{id}/pair` unlinks both rows.
- `JourneyListItem` and `JourneyDetailResponse` gain `sourceTemplateId`,
  so the journey page and the home cards can link to the regular journey
  and offer "Skip".
- Retention, decision 11: `retention.rs` gains a part for occurrences.
  A journey with `source_template_id` set, whose last leg is older than
  `REGULAR_JOURNEY_RETENTION_DAYS` (90; 0 turns it off), is deleted when
  none of its legs' trains has a ticket (`tracked_train_tickets`) and none
  arrived at least 15 minutes late or was cancelled, the lowest Delay
  Repay band (`data/delay_repay_rules.rs`, DR15). Its trains are released
  as `journeys::delete_journey_row_releasing_trains` does (DS-93). The rest
  fall to the 548-day rule. So does an occurrence whose template was
  deleted, since `source_template_id` is then null. docs/personal-data-retention.md
  gains the row.

Templates stay out of `DELEGATED_ROUTES`. Nothing here is offered to
ds-mcp.

### 4.3 Notifier (ds-workers)

- **The evening before.** Stage 1 of `run_template_sweep_cycle` mints for
  today, as now, and also for tomorrow once London time is at or after
  `--template-mint-evening-hour` (18; 24 turns it off). The per-date
  guard in `materialize_due_template_occurrence` stays the idempotency
  key; today's pass catches a template created or resumed after the
  evening tick. Stage 2 is unchanged: `unmatched_auto_legs_for_commit_check`
  only looks at today, so tomorrow's auto legs still commit on the day.
- `notifier.templateSweepPollIntervalSecs` drops from 3600 to 900, so the
  evening mint lands by 18:15. The due query is one indexed scan of a
  table capped at 50 rows per user.
- The tombstone prune in `retention.rs` keeps `service_date < today`; a
  tombstone for tomorrow is now live, and that is still covered.
- Copy: "Your recurring journey needs attention" becomes "Your regular
  journey needs attention". The phase 0 reminder's link gains
  `?pick=usual` when the template has a usual itinerary.
- Push volume: phase 1 adds no push class.

### 4.4 Frontend (distant-signal)

- **Rename.** Routes move to `/journeys/regular`, `/journeys/regular/new`
  and `/journeys/regular/[id]`, with permanent redirects from
  `/journeys/templates` and `/journeys/templates/:id` in
  `next.config.mjs` (and a case in `next.config.test.js`). h1 and nav
  label: "Regular journeys". "Save as template" becomes "Make this a
  regular journey"; "Run now" becomes "Add a date" (a dialog with one date
  field); "Delete template" becomes "Delete regular journey", whose dialog
  says "Journeys already made from it are kept." The `/account/notifications`
  row becomes "Regular journeys", "When no train is found for one of your
  regular journeys." The privacy, account and delete-account pages say
  "regular journeys", and the privacy page gains the 90-day rule.
- **Create from scratch** (`/journeys/regular/new`): From, To, a segmented
  control "Leave after" / "Arrive by" with a time (the form's first time
  field carries `clockHint`), day chips (Monday to Friday preselected),
  optional "Starts" and "Ends" date fields (`PICKER_DATE_FORMAT`), a
  switch "Add the return journey" that reveals its own "Leave after" /
  "Arrive by" time, and a radio group "Each day": "Remind me to pick my
  train" (default) or "Pick my usual train for me". "Find trains" runs
  `/Trips/plan` for the next matching date and lists itineraries with
  `ItineraryOption`; picking one sets the usual train (and the return's,
  in a second step). "Save regular journey" posts `mode: "plan"`.
- **From /plan.** Beside "Track this journey", "Make this a regular
  journey" opens the same form with the route, the plan's time bound and
  options, and the selected itinerary as the usual train already filled.
- **List** (`/journeys/regular`): a card per template, a pair as one card
  with two rows ("Woking to London Waterloo, leave after 07:45" and
  "London Waterloo to Woking, leave after 17:30"), phase 0's recurrence
  summary, "Next: 10 Nov 2026", and "Paused" as a badge. Actions: "Skip
  next" and "Pause" / "Resume".
- **Skip next** opens a small dialog: "Skip 10 Nov 2026?", a checkbox
  "Skip the return journey too" (checked, shown only for a pair), "Skip".
  Afterwards: "Skipped 10 Nov 2026." with "Undo".
- **Pause** on a pair says "Pauses the return journey too." in the
  dialog.
- **Journey page and home cards** of an occurrence: a dimmed line "Regular
  journey" linking to its page, and "Skip" while it hasn't started. With
  `?pick=usual`, `JourneyLegCandidates` puts the usual train first, marked
  "Your usual train", with one "Track this train" button.
- Failures through `describeFailure`: "Couldn't save this regular
  journey.", "Couldn't skip this journey.", "Couldn't pause this regular
  journey."

### 4.5 Values

- ds-deploy: `notifier.templateMintEveningHour: 18`,
  `notifier.templateSweepPollIntervalSecs: 900`,
  `api.regularJourneyRetentionDays: 90`. The retention value goes into the
  chart only after the frontend release with the new privacy copy is live.

### 4.6 Tests

- ds-core: the migration and `gen-db-grants.py check` on a migrated
  database; the constraint rejects a target without a time.
- ds-api DB tests: `mode: "plan"` with and without a return (one
  transaction, cap counted twice); PUT without the new fields keeps them;
  pause pauses the pair and removes only untouched occurrences; skip with
  and without an existing occurrence, with `pair`, after departure (409),
  and undo; `nextDate` across a tombstone and `endsOn`; retention keeps an
  occurrence with a ticket or a 15-minute arrival delay and deletes one
  without.
- ds-workers: with an injected `now`, 17:59 mints today only and 18:00
  mints tomorrow too; on 29 Mar and 25 Oct 2026 (the clock changes) the
  hour is London's; a second tick mints nothing; a tombstoned tomorrow
  stays unminted.
- distant-signal: vitest for the form, the pair card, skip and undo, the
  redirects; Playwright e2e "make a regular journey from /plan" and "skip
  next" against the seeded stack (`e2e/fixtures/seed.sql` gains a target
  template); axe on the new pages; visual baselines for the list and the
  form at 390 and 1366 px, light and dark.

## 5. Phase 2: Leave by

### 5.1 Schema (ds-core)

```sql
SET LOCAL lock_timeout = '5s';
ALTER TABLE journey_templates ADD COLUMN station_buffer_minutes SMALLINT;
ALTER TABLE journeys ADD COLUMN station_buffer_minutes SMALLINT;
ALTER TABLE notification_preferences
    ADD COLUMN leave_by              BOOLEAN  NOT NULL DEFAULT TRUE,
    ADD COLUMN leave_by_quiet_hours  BOOLEAN  NOT NULL DEFAULT TRUE,
    ADD COLUMN leave_by_lead_minutes SMALLINT NOT NULL DEFAULT 0,
    ADD COLUMN morning_summary       BOOLEAN  NOT NULL DEFAULT FALSE;
-- each CHECK NOT VALID, validated in the next file:
--   station_buffer_minutes IS NULL OR station_buffer_minutes BETWEEN 0 AND 120 (both tables)
--   leave_by_lead_minutes BETWEEN 0 AND 5

CREATE TABLE regular_journey_push_state (
    journey_id       BIGINT PRIMARY KEY REFERENCES journeys (id) ON DELETE CASCADE,
    user_id          TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    leave_leg_id     BIGINT,
    leave_by_sent    TIMESTAMPTZ,
    leave_by_sent_at TIMESTAMPTZ,
    pushes           SMALLINT NOT NULL DEFAULT 0
);
CREATE TABLE regular_journey_summaries (
    user_id      TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    service_date DATE NOT NULL,
    sent_at      TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (user_id, service_date)
);
```

The occurrence copies `station_buffer_minutes` from its template at mint,
so a change to the template doesn't move a day already under way, and one
day can be changed on its own. The buffer is the user's own number,
margin included ("minutes to get to the station").

Grants:

```yaml
regular_journey_push_state: {class: internal, grants: {notifier: SIU, api: S}}
regular_journey_summaries: {class: internal, grants: {notifier: SID}}
journey_revisions: {class: personal, grants: {api: SIUD, notifier: [{privileges: S, columns: [id, journey_id, revision_no]}]}}
journey_revision_legs: {class: personal, grants: {api: SIUD, notifier: [{privileges: S, columns: [revision_id, position, booked_departure, planned_departure]}]}}
```

The notifier needs the booked departure, which lives only in the revision
legs (`20261023090000_journey_revisions.sql`).

**Shared SQL.** `ds_store::journeys::leave_by_sql` (new, in ds-store, as
`ds_store::trains::leg_crs_sql` is shared today) computes one journey's
leave-by. The api and the notifier both use it, so the page and the push
never disagree:

- the plan is the journey's **current** revision, so an accepted replan
  moves it (phase 4) with no extra code;
- the first leg with a time sets it: a train leg's `booked_departure`, or
  an untracked leg's `planned_departure` (decision 15). A journey that
  starts with a Tube or a walk needs the user out of the door for that
  leg, and the buffer is the time to its start;
- `leave_by = departure - station_buffer_minutes`. Lateness never moves it
  (decision 5);
- the first train is cancelled: with an open break whose best suggestion
  is `covered`, it is that suggestion's first departure minus the buffer,
  basis `suggestion`; without one, there is no leave-by.

### 5.2 API (ds-api)

Changelog entry, "Leave by".

- `JourneyListItem` and `JourneyDetailResponse` gain `stationBufferMinutes`
  and `leaveBy: {at, departure, basis} | null`, where `basis` is `booked`
  or `suggestion`. `null` when the journey has no buffer, no timed leg or a
  cancelled first train with nothing suggested. The detail also returns it
  after departure (the page hides it).
- `PUT /Journeys/{id}/station-buffer` `{minutes | null}`, owner only, for
  one day.
- Template create and PUT gain `stationBufferMinutes`.
- `GET /JourneyTemplates/station-buffer?crs=WOK` `{minutes | null}`: the
  buffer on the caller's most recently updated template from that
  station, else on their most recent occurrence from it. It pre-fills the
  form (decision 6).
- `GET`/`PUT /preferences/notifications` gain `leaveBy`,
  `leaveByQuietHours`, `leaveByLeadMinutes` (0 to 5) and `morningSummary`.

### 5.3 Notifier (ds-workers)

**The `leave_reminder` cycle** (`crates/notifier/src/leave_reminder.rs`),
its own `select!` branch every `notifier.leaveReminders.pollIntervalSecs`
(60), off unless `notifier.leaveReminders.enabled`. Each tick is a full
poll of current state, like `skip_check`. It reads journeys with a buffer
whose first timed leg is today or yesterday (overnight) and hasn't left,
owned by a user with `leave_by` on, with their leave-by from the shared
SQL, the first train's current state, any open break, and their
`regular_journey_push_state`. Rows are recorded only after delivery, as
for every other class (`push_queue.rs`, "Delivery semantics").

`decide_leave_reminder` (pure, in `decision.rs`) for one journey:

1. **A break owns it.** An open break on the journey or its first train
   (`break_owns_train`): nothing. The break notice is the push, and phase 4
   adds the leave-by to its text.
2. **Cancelled with nothing suggested**: nothing. The cancellation push
   covers it.
3. **The cap**: `pushes >= notifier.leaveReminders.maxPushesPerOccurrence`
   (3): nothing.
4. **First push** when `now >= leave_by - lead` and `now < leave_by + 5
   min` and `now < departure`. Past that window it is stale and never
   sent.
5. **Moved.** Already sent, and the new leave-by is at least
   `moveThresholdMinutes` (5) earlier than `leave_by_sent`: send again,
   inside the same window. A later leave-by sends nothing.

The cap counts every regular-journey push for the occurrence: the phase 0
pick reminder (read from wherever phase 0 records it), the leave-by and the moves. Train delay, cancellation, skip
and break pushes keep their own rules and aren't counted.

**Copy** (sentence case, no em dashes, `lib/trainName.ts`'s naming):

| Case | Title | Body |
|---|---|---|
| On time | Leave by 08:20 | For the 08:42 Woking to London Waterloo. On time. |
| Late | Leave by 08:20 | For the 08:42 Woking to London Waterloo. Expected 6 min late. Leave on time in case it makes up time. |
| Moved | Leave by 08:05 now | For the 08:27 Woking to London Waterloo instead. |
| Suggestion | Leave by 08:35 | Your 08:42 is cancelled. The 08:57 gets you there. Tap to switch. |

The last row is only reachable through phase 4 (a break exists, so step 1
applies unless the user turned suggestions off; then the notice falls back
to this text). Tag `journey-leg-leave-{leg}`, URL `/journeys/{id}`.

**One push per train.** `Delivered::LeaveBy { journey_id, leg_id,
leave_by, trigger: Option<TriggerTrainState> }`. When the text names a
delay at or over the user's threshold, delivery also writes the train's
`train_notification_state` at the equivalent rank (as
`equivalent_train_state` does for a break notice), and the queue drops a
queued plain push for that train (`push_queue.rs:564`'s supersede, widened
to `LeaveBy`). A later escalation still pushes on its own.

**Quiet hours and snooze** (decision 4). `hold::gate` gets which of the
two applies instead of one `quiet` flag. A leave-by is `Send` in quiet
hours when `leave_by_quiet_hours`, else `NotNow`, and never held: a late
leave-by is worse than none. A snooze is something the user did on
purpose, so it stops leave-by pushes.

**The morning summary** (decision 7, off by default): one push per user
and London day, 60 minutes before their first leave-by, listing the day's
occurrences ("Today: 08:42 to London Waterloo, on time. 17:48 to Woking,
on time."). Tag `regular-summary-{date}`, recorded in
`regular_journey_summaries` and pruned after 7 days by the same cycle. It
isn't counted in any occurrence's cap.

**TTL, urgency and topic.** The general TTL and urgency are already in
place when phase 2 starts: the separate ds-workers change (decision 14)
sends every train push with a 3600 s TTL, cancellations included, and
sets its urgency. Grant and token notices aren't train pushes and keep
the default: they are account security notices and must arrive late
rather than never. Phase 2 adds only the leave-by specifics:

- TTL `min(900, seconds to leave_by + 300)`, `high` urgency;
- a topic, the tag, through web-push's `set_topic`. A push service
  holding a leave-by for an offline phone then replaces it with the moved
  one rather than queueing both;
- an optional `renotify` in the payload (true for a moved leave-by),
  which `sw.js` passes to `showNotification`. The TTL, urgency and topic
  stay out of `NotificationPayload`, which is the service worker's wire
  contract.

### 5.4 Frontend

- Template form: "Time to get to the station", a number field in minutes,
  0 to 120, helper "Include a few minutes to spare.", pre-filled from
  `station-buffer`.
- A `LeaveByCountdown` client component (the home page is server-rendered,
  so this is a small client island) on the home "Current journey" and
  "Upcoming journeys" cards and on the journey page: "Leave by 08:20" with
  "in 12 min", then "Leave now", hidden once the train has left. Late:
  "Leave by 08:20 · train expected 6 min late". From a suggestion: "Leave
  by 08:35 for the 08:57". It ticks every 30 s and is not a live region;
  only the change to "Leave now" is announced.
- Journey page, owner, today: "Change" next to the countdown edits the
  buffer for this day.
- `/account/notifications`, a "Regular journeys" section: switch "Leave-by
  reminders" ("One notification when it's time to leave."); select "When"
  ("At leave-by time", "1 min early" to "5 min early"); switch "During
  quiet hours" ("Leave-by reminders still come through in quiet hours.");
  switch "Morning summary" ("One notification an hour before you first
  leave, with the day's regular journeys."). The "When" select defaults
  to "At leave-by time" (decision 12).

### 5.5 Values

`notifier.leaveReminders: {enabled: false, pollIntervalSecs: 60,
maxPushesPerOccurrence: 3, moveThresholdMinutes: 5, ttlSecs: 900}`.

### 5.6 Tests

- ds-store: `leave_by_sql` for a train first leg, an untracked first leg,
  a revision 2, a cancelled train with and without a covered suggestion.
- ds-api: `leaveBy` on list and detail; the buffer route; the pre-fill
  lookup prefers the template.
- ds-workers: the decision matrix (before the window, in it, stale, moved
  by 4 and 5 minutes, later, capped, break-owned, cancelled); a delay at
  the threshold writes the train's state and a later escalation still
  pushes; the quiet-hours gate with the toggle on and off, and a snooze;
  the leave-by's TTL, urgency and topic reach the builder; copy has no banned
  characters (as `break_notices`' test does); a DB test across the 25 Oct
  2026 clock change.
- distant-signal: vitest for the countdown's states (with fake timers),
  the settings section; visual baselines for the home cards with a
  countdown.

## 6. Phase 3: Planner-chosen daily train

### 6.1 Why the api

The notifier can't reach the planner crate, the graph cache or the live
overlay; only the api holds them. So the api plans, and the notifier keeps
minting and pushing.

### 6.2 The sweep (ds-api)

`crates/api/src/regular_plan_sweep.rs`, a `ds_store::loops` loop under a
new advisory lock `REGULAR_PLAN_SWEEP` (ds-core's
`crates/ds-runtime/src/advisory_locks.rs`), every
`api.regularJourneys.planSweep.intervalSecs` (300), at most
`maxOccurrencesPerTick` (200), off unless
`api.regularJourneys.planSweep.enabled`. It plans through a new
`ReplanSlot::Regular` with its own one-permit semaphore, so it never takes
a user's slot or the break sweep's.

For each occurrence dated today or tomorrow whose template has a target,
that hasn't started, has no break, and is due:

1. **Due** means not planned yet, or planned against an older
   `GraphMarker`, or the morning check: the first tick after 05:00 London
   on the service date.
2. **Published.** No timetable for the date
   (`queries::schedule_destination_departures_published_for`): leave it
   for a later tick. Never decide "no service" on a missing day; stage 2
   has the same rule today.
3. **Plan.** `plan_for_journey` grows a `time: TimeBound` (today it only
   takes `depart_after_min`), `dayOffset`, vias and avoids. It asks for
   `results=options` with `live=true`, so a train already known to be
   cancelled is never picked; for tomorrow the overlay has nothing and the
   plan is the timetable's.
4. **Choose**, in order: an itinerary whose train legs are the usual
   itinerary's UIDs; else one whose first train leaves within 5 minutes of
   the usual first departure with the same operator; else the target's
   own best: earliest arrival for `depart_after`, latest departure for
   `arrive_by`.
5. **Keep.** In remind mode (decision 2) it stores the choice and up to
   four alternatives on the occurrence and commits nothing. In auto mode it
   commits the itinerary with `journey_replace::replace` over all the
   occurrence's legs. The journey is still planning, so revision 1 is
   refreshed and becomes the booked plan. Untracked and timetabled legs
   come from the plan too.
6. **Re-check.** On the morning check or a new marker, a committed train
   that no longer runs that day (an STP cancellation, a CIF change) is
   re-planned. Auto mode replaces only the legs the sweep committed itself,
   never a train the user picked; remind mode refreshes the suggestion.
   A train that is late or cancelled in live data is not this sweep's
   concern: that is a break (phase 4), and reroutes are only ever
   suggested (decision 10).
7. **No itinerary** on a published day: status `no_service`. The notifier
   sends the existing "needs attention" push from that status.

The sweep never touches a journey with a break, or one that has started:
`still_planning` already says so.

### 6.3 Schema (ds-core)

```sql
SET LOCAL lock_timeout = '5s';
ALTER TABLE journeys
    ADD COLUMN regular_plan        JSONB,
    ADD COLUMN regular_plan_status TEXT,
    ADD COLUMN regular_plan_marker TEXT,
    ADD COLUMN regular_planned_at  TIMESTAMPTZ;
-- CHECK (regular_plan_status IS NULL OR regular_plan_status IN
--   ('pending', 'suggested', 'committed', 'no_service')) NOT VALID; validated next
```

`regular_plan` holds the choice, the alternatives and the leg ids the
sweep committed. Grants: none new (`journeys` is api `SIUD`, notifier
`SI`). The advisory lock ships in the same ds-core release.

### 6.4 API

Changelog entry, "Regular journeys: the day's train".

- `JourneyDetailResponse` gains `regularPlan: {status, choice,
  alternatives} | null`, owner only.
- `POST /Journeys/{id}/regular-plan/accept` `{index}`: the one-tap pick.
  It replaces the legs with that choice, as auto mode would; 409 if the
  plan changed since it was read (`regularPlannedAt` echoed back).

Update, 2026-11-08 (DS-398): the plan keeps the choice plus up to four
alternatives, not two (ds-api `MAX_ALTERNATIVES`; the sweep already
searches six trains). The alternatives are still the trains closest to
the target, but are stored and listed by departure. An accept's `index`
counts that stored order (0 the choice, then the alternatives as
served), and the `api_regular_plan_accepted_total` `index` label covers
0 to 3 and `4`. The usual-train picker and the journey page's pick
widened too (the same ticket); this document's other numbers stand.

### 6.5 Notifier

- Stage 2's `COMMIT_CHECK_LEGS_SQL` gains `AND jt.target_kind IS NULL`:
  target templates belong to the api sweep. This release goes out only
  after the sweep is on in production; until then stage 2 keeps
  committing target templates the old way, which is harmless.
- The "needs attention" push for a target template reads
  `regular_plan_status = 'no_service'` instead of stage 2's empty
  candidate list. Same `Delivered::Unmatched`, same tag, same once-only
  rule.
- The phase 0 pick reminder's text names the suggestion: "Pick your train
  for 08:42 to London Waterloo. Your usual 08:12 is running." The link
  opens the page with the choice first. No push for a commit: none exists
  today and none is added (templates §0.5).

### 6.6 Frontend

The journey page of an occurrence in remind mode shows the suggestion as
one card: "Your usual train: 08:12 Woking to London Waterloo" with "Track
this train", and "Other trains" listing the alternatives. When the usual
train isn't in the day's timetable: "Your usual train doesn't run today.
This is the closest." The template form's mode radio describes auto mode
as "We'll pick the train closest to your usual one each day."

### 6.7 Values and tests

`api.regularJourneys.planSweep: {enabled: false, intervalSecs: 300,
maxOccurrencesPerTick: 200, morningCheckHour: 5}`. Tests: the choice
order (usual UIDs, same time and operator, target fallback, arrive-by);
nothing decided on an unpublished day; remind mode commits nothing; auto
mode refreshes revision 1 and its leave-by; the morning check after a
schedule publish drops a train and replans; a user's own pick is never
replaced; a break stops the sweep; the slot is separate (a held break slot
doesn't block it). Planner timings measured with
`crates/trip-planner/tests/bench_arrive_by.rs` for one day's sweep at the
current user count.

## 7. Phase 4: Rerouting

### 7.1 Turning breaks on

Breaks have never been switched on in production. Template occurrences
add journeys that are minted unmatched, committed by a sweep, or picked a
day ahead, which the break design didn't see. Before
`api.journeyBreaks.enabled` goes on:

1. DB tests in ds-api: an occurrence with unmatched legs never opens a
   break; a remind-mode occurrence with no pick never does; an auto
   occurrence opens one when its train is cancelled, and the plan sweep
   then leaves it alone; tomorrow's occurrence is outside the sweep's
   window.
2. A chart value `api.journeyBreaks.notices` (default true), so production
   can run the sweep with notices off: one week, watching
   `api_journey_breaks_detected_total` and the funnel query in
   docs/journey-breaks.md for breaks on occurrences that the journey page
   doesn't show.
3. Then notices on, with leave-by already live.

### 7.2 Leave-by after a replan

The shared SQL reads the current revision (§5.1), so accepting a
suggestion moves the leave-by on the page at once. The notifier sees the
new leave-by on its next tick: at least 5 minutes earlier sends "Leave by
08:05 now" (counted in the cap), later sends nothing. The new train's leg
has a new id, so a new tag. `sw.js` closes the old leg's leave-by
notification when the payload names it (`closeTags`, optional).

### 7.3 "Earlier train needed"

A break found before the journey starts (a cancelled second train, a
connection that won't hold) whose best covered suggestion leaves before
the booked first train gets its own notice copy in
`build_break_payload`:

- Title: "Earlier train needed".
- Body: "Leave by 07:50 for the 08:05 to London Waterloo, arriving 09:02.
  Tap to switch." Without a buffer: "Take the 08:05 to London Waterloo,
  arriving 09:02. Tap to switch."

The leave-by in it comes from the same shared SQL with the suggestion's
departure. Delivery records the leave-by in `regular_journey_push_state`,
so the leave-by cycle doesn't repeat it.

### 7.4 Never accepted for the user

Decision 10 is already how breaks work: accept is a user action
(`POST .../replan/accept`). This phase adds a test that neither sweep
calls `journey_replace::replace` on a journey with a break, and the
template form says nothing about rerouting automatically.

### 7.5 Values, tests

`api.journeyBreaks.enabled: true` after the week in §7.1, and the new
`api.journeyBreaks.notices`. Tests: the copy for "Earlier train needed"
with and without a buffer, no banned characters; the notice suppresses
the leave-by push; a replan to an earlier train pushes once, to a later
one never.

## 8. Phase 5: Bank holidays

### 8.1 Schema (ds-core)

```sql
SET LOCAL lock_timeout = '5s';
CREATE TABLE bank_holidays (
    division     TEXT NOT NULL CHECK (division IN
                   ('england-and-wales', 'scotland', 'northern-ireland')),
    holiday_date DATE NOT NULL,
    title        TEXT NOT NULL,
    fetched_at   TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (division, holiday_date)
);
ALTER TABLE users ADD COLUMN bank_holiday_division TEXT;          -- CHECK NOT VALID, same three
ALTER TABLE journey_templates
    ADD COLUMN skip_bank_holidays BOOLEAN NOT NULL DEFAULT TRUE;
```

Grants: `bank_holidays: {class: reference, grants: {api: SIUD, notifier:
S}}`, and the notifier gets `S` on `users (id, bank_holiday_division)`
only. The release also adds the GOV.UK credit (Open Government Licence
v3.0) to the site credits, which reach the frontend through
`sync-core.py`.

### 8.2 The fetch (ds-api)

One fetch for the whole service, never per user: a `bank_holidays_sync`
loop under a new advisory lock, every 24 hours, off unless
`api.bankHolidays.enabled`. It GETs `https://www.gov.uk/bank-holidays.json`
(one object per division, each with `events: [{title, date, notes,
bunting}]`), checks every division parsed and has at least 5 events, then
in one transaction upserts every event and deletes the rows inside the
response's date range that it no longer lists (a moved holiday). A failed
or implausible response keeps the old rows. Metrics:
`api_bank_holidays_sync_total{result}` and
`api_bank_holidays_latest_date_seconds`; ds-deploy's rule alerts when the
latest known date is less than 60 days away. The api's internet egress
rule already allows 443.

### 8.3 Skipping

- Notifier: `due_templates_for` skips a date that is a bank holiday in the
  owner's division when `skip_bank_holidays`. With no division chosen it
  uses England and Wales, and the form says so.
- API: `nextDate` skips them too, and list and detail gain
  `skipBankHolidays` and `nextSkips: [{date, reason}]` (`bank_holiday` or
  `skipped`). `GET /preferences` gains `bankHolidayDivision`; `PUT
  /preferences/bank-holiday-division` sets it. Changelog entry, "Bank
  holidays".
- Frontend: the form's switch "Skip bank holidays" (on) with "England and
  Wales bank holidays. Change" linking to Preferences; Preferences gains a
  "Bank holidays" select (England and Wales, Scotland, Northern Ireland),
  also asked once, inline, the first time someone saves a regular journey
  without one set. The list card shows "Next: 1 Jun 2027 (31 May 2027 is a
  bank holiday)".

### 8.4 Values, tests

`api.bankHolidays: {enabled: false, url: https://www.gov.uk/bank-holidays.json,
intervalHours: 24}`. Tests: parse a recorded copy of the JSON; a partial
response changes nothing; a moved holiday is replaced; the mint skips per
division and not with the switch off; `nextDate` skips Easter Monday in
England and Wales but not in Scotland.

## 9. Risks

**iOS home-screen push.** Web Push works on iOS only for a site added to
the home screen. We can't mark a web push time-sensitive there, so Focus
modes may hold a leave-by. The leave-by settings say so for iPhone users
("On iPhone, Focus can delay this."). Apple's push service takes the RFC
8030 TTL; we haven't checked what it does with `Urgency`. We test on a
real iPhone before `leaveReminders.enabled` goes on.

**Stale delivery.** On the commits checked, every push may arrive up to
28 days late. The separate change bounds train pushes to an hour; phase 2
bounds leave-by to about 15 minutes, its topic replaces a stored one, and
the decision refuses to send one more than 5 minutes past leave-by.

**Timetable changes.** A December or May timetable change gives the usual
train a new UID. Phase 1 matches on UID, so "your usual train" disappears
until the user picks again; phase 3 falls back to the same time and
operator. STP and CIF changes after an occurrence is planned are caught by
the morning check and a new graph marker.

**Clock changes.** The evening mint, the morning check and leave-by use
London time from instants. A target time in the missing spring hour
(01:00 to 02:00 on the last Sunday in March) is skipped for that day, as
stage 2 does (`london_to_utc` returns `None`); in the repeated October
hour the earlier instant wins. A `target_day_offset` of 1 handles an
arrive-by after midnight, as `/Trips/plan`'s `dayOffset` does.

**Journey rows.** A weekday commute with a return is about 506
occurrences a year, each with its legs, a revision and its legs, and a
subscription per train. With the 90-day rule a pair settles near 130
occurrences, against about 780 under the 548-day rule. The worst case is
50 templates every day: about 4,500 live occurrences per user. The
retention part deletes in the same transaction style as
`prune_past_travel`, and the evening mint of every active template is one
burst of inserts at 18:00; at today's user count that is small, and it
should be measured again before any public launch.

**Planner load.** Phase 3 plans every target occurrence at least twice a
day (evening and morning) through one permit. At today's numbers that is
a few searches a minute; the per-tick cap bounds it.

**Breaks.** They have never run in production; §7.1's week with notices
off is the check.

## 10. Rollout and PR order

Each ds-core change ships in a release before its consumers. Every PR body
states its deploy order. Risky parts are off by default; phase 1's evening
mint is not, because it only moves a mint the user already asked for.

The 1-hour TTL and the urgency for train pushes (decision 14) are not in
this table: they ship first, as their own ds-workers change, and phase 2
assumes them.

| # | Repo | Phase | What | Deploy order |
|---|---|---|---|---|
| 1 | distant-signal | none | This design | none |
| 2 | ds-core | 1 | Target, plan options, usual itinerary, pair; validate; index | release |
| 3 | ds-api | 1 | Core bump; `mode: "plan"`, pair, active, skip, `sourceTemplateId`, retention part; changelog; types | after migrate |
| 4 | ds-workers | 1 | Core bump; evening mint, copy, `?pick=usual` | after #2 |
| 5 | distant-signal | 1 | Rename and redirects, the form, from /plan, skip, pause, privacy copy | after #3 is pinned |
| 6 | ds-deploy | 1 | Mint hour, sweep interval, retention days | after #4 and #5 |
| 7 | ds-core | 2 | Buffers, preferences, push state, summaries, revision grants, `leave_by_sql` | release |
| 8 | ds-api | 2 | `leaveBy`, buffer routes, preferences; changelog; types | after migrate |
| 9 | ds-workers | 2 | `leave_reminder`, gate, the leave-by's TTL, urgency and topic, summary | after #7 and the TTL change |
| 10 | distant-signal | 2 | Countdown, buffer field, settings, `sw.js` `renotify` | after #8 is pinned |
| 11 | ds-deploy | 2 | `leaveReminders` (off) | then on after an iPhone test |
| 12 | ds-core | 3 | `regular_plan` columns, advisory lock | release |
| 13 | ds-api | 3 | Plan sweep, slot, `plan_for_journey` time bound, accept route; changelog | after migrate |
| 14 | distant-signal | 3 | Suggestion card | after #13 is pinned |
| 15 | ds-deploy | 3 | `planSweep` (off), then on | after #13 |
| 16 | ds-workers | 3 | Stage 2 skips targets; `no_service` push; reminder text | after #15 is on |
| 17 | ds-api | 4 | Break tests, `notices` switch | none |
| 18 | ds-workers | 4 | "Earlier train needed", leave-by in the notice, `closeTags` | after #17 |
| 19 | ds-deploy | 4 | `journeyBreaks.enabled` with notices off, then on | after a week |
| 20 | ds-core | 5 | `bank_holidays`, division, skip flag, credit | release |
| 21 | ds-api | 5 | Sync loop, `nextSkips`, preference route; changelog | after migrate |
| 22 | ds-workers | 5 | Mint skips bank holidays | after #21's first sync |
| 23 | distant-signal | 5 | Switch, preference, credits sync | after #21 is pinned |
| 24 | ds-deploy | 5 | `bankHolidays` on, alert | after #21 |

To roll back, revert a consumer to the previous core; every schema change
is additive and old code doesn't read it.

## 11. Sizing

| Phase | ds-core | ds-api | ds-workers | distant-signal | Overall |
|---|---|---|---|---|---|
| 1 | S | M | S | L | L |
| 2 | M | S | L | M | L |
| 3 | S | L | S | S | L |
| 4 | none | S | S | none | S, plus a week of watching |
| 5 | S | M | S | S | M |

Phase 2's notifier work is the largest single piece: a new class, the
gate change and the queue's supersede rule all touch the push path every
other push uses.

