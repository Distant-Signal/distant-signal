'use client';

import { RouteShortcutPicker } from './RouteShortcutPicker';
import { NO_ROUTE_SHORTCUTS, type RouteShortcuts } from '@/lib/routeShortcuts';
import { useId, useState, type SubmitEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Group, SegmentedControl, SimpleGrid, Stack, Text, VisuallyHidden } from '@mantine/core';
import { DateTimePicker, DatePickerInput } from '@/components/LazyDateFields';
import { PICKER_DATE_FORMAT, PICKER_DATE_TIME_FORMAT } from '@/lib/dateFormat';
import dayjs from 'dayjs';
import { useNeedsLogin } from './useNeedsLogin';
import { LoginPromptModal } from './LoginPromptModal';
import { DeparturePicker, useDeparturePicker } from './DeparturePicker';
import { TrackDestinationModal } from './TrackDestinationModal';
import { TimeFilterInput } from './TimeFilterInput';
import { useGroupSummaries } from '@/lib/useGroupSummaries';
import { shareTrackedTrainToGroup } from '@/lib/shareTrackedTrain';
import { StationField } from './StationField';
import { OperatorField } from './OperatorField';
import { nowInLondon, londonWallClockToUtc } from '@/lib/londonWallClock';
import type { CreateJourneyResponse } from '@/lib/types';
import { trackFeature } from '@/lib/usageAnalytics';
import { describeFailure, failureFromResponse } from '@/lib/failure';
import { ButtonSpinner } from '@/components/LoadingText';
import {
  CRS_PATTERN,
  PIN_MAX_DAYS_AHEAD,
  cifDepartureDateTime,
  lastPinDate,
  pinTooFarMessage,
  resolveLdbwsDepartureDate,
  type CifPickerRow,
  type DepartureRow,
} from '@/lib/departurePicker';

/** Manual form for tracking a train: pick a departure (pin mode) or search a
 * time window. No public API exposes individual departures, so a per-departure
 * "track this train" action can't be built. `initialOrigin` is set by
 * `/track`'s page when arriving via the "Track a train from here" link on
 * `/stations/[crs]`.
 *
 * `submitTrack` posts a `pin`-mode leg to `POST /Journeys`; `submitWindow`
 * posts a `window`-mode leg for the `SegmentedControl`'s second option, an
 * open time-window search with no train chosen yet (the journey view is where
 * a candidate gets picked next). Both go through the same-origin
 * `/api/Journeys` proxy (Client Components can't read the server-only
 * `API_BASE_URL` env var `lib/api.ts` relies on -- same reasoning as
 * `PinToggle`). Mirrors `PinToggle`'s `needsLogin` 401 pattern, with one
 * difference: a 401 here does NOT reset the form. A form with real typed input
 * is worth protecting, so every field stays as typed while the login prompt
 * renders alongside it.
 *
 * `useGroupSummaries()` decides, once on mount,
 * whether this user belongs to any group. Zero groups (the majority case,
 * and every anonymous visitor) leaves `handleSubmit`'s form `onSubmit`
 * calling `submitTrack(null)`/`submitWindow(null)` (per `mode`) directly --
 * no prompt. One or
 * more groups instead makes `handleSubmit` open `TrackDestinationModal`
 * first and defer the actual submit to its `onConfirm`, which calls
 * whichever of the two matches the current `mode` -- see that component's
 * own doc comment for why reusing it unmodified (rather than a second,
 * divergent submit path) is safe. Sharing the new pin into the chosen
 * group (`shareTrackedTrainToGroup`) is a further best-effort follow-up
 * `submitTrack` performs once the track call itself has already
 * succeeded, swallowing every failure -- `submitWindow` has no such
 * follow-up yet (see
 * that function's own doc comment on why `groupId` is currently unused
 * there). */
export function TrackTrainForm({
  initialOrigin = '',
  initialDestination = '',
  initialMode = 'pick',
  initialServiceDate,
  initialDepartAfter = '',
  initialDepartBefore = '',
  initialArriveAfter = '',
  initialArriveBefore = '',
  onCreated,
  routeShortcuts = NO_ROUTE_SHORTCUTS,
}: {
  initialOrigin?: string | undefined;
  // "Track this journey again" (docs/superpowers/plans/2026-09-22-reusable-journeys-phaseA-track-again-plan.md)
  // is the first caller of these five props -- pre-fills the Destination
  // field (pin mode and window mode read/write the SAME `destinationCrs`
  // state, see that state declaration's own comment -- only one mode's
  // rendering of it is ever visible at a time, driven by `initialMode`),
  // and the window-mode time bounds. All five are inert, ordinary
  // `useState` initial values, same as `initialOrigin` already is -- no
  // new prop changes this component's submit behaviour.
  initialDestination?: string | undefined;
  // The mode toggle is seeded from `?mode=window` (read by `track/page.tsx`, like
  // its `?origin=`) so a link can send a user straight to window mode. (A journey
  // leg's "Edit search" doesn't come here: this form starts a NEW journey, so that
  // re-searches the leg in place via `JourneyLegCard`'s `LegTrainPicker`.)
  initialMode?: 'pick' | 'window';
  /** "YYYY-MM-DD" -- window mode's own service-date field
   * (`windowServiceDate`, below), which otherwise always defaults to
   * today. `undefined` (the default) preserves that exact pre-existing
   * behaviour (`/track?serviceDate=...`). Deliberately has no pin-mode
   * equivalent --
   * pin mode's `scheduledDeparture` is a single full date+time field with
   * its own "now" default, not a bare date, so there is nothing for this
   * prop to feed there. */
  initialServiceDate?: string | undefined;
  /** "HH:MM" -- same value contract `TimeFilterInput`'s own `onChange`
   * already uses for `departFrom`/`departTo`/`arriveFrom`/`arriveTo`. */
  initialDepartAfter?: string | undefined;
  initialDepartBefore?: string | undefined;
  initialArriveAfter?: string | undefined;
  initialArriveBefore?: string | undefined;
  /** `JourneyCreationFlow.tsx`'s (the `/plan` continuous
   * multi-leg creation page) only caller of this prop: this form is
   * reused there verbatim as the "leg 1" step, but that page wants to
   * stay put afterwards and offer an inline "Add a leg" rather than being
   * pushed away to `/journeys/{id}` the instant leg 1 exists -- the way
   * every OTHER caller of this form (`/track` itself, chief among them)
   * still wants, and gets, by leaving this prop unset. When given, this
   * replaces `submitTrack`/`submitWindow`'s own final `router.push` with a
   * call to this instead; every other success side effect (the
   * group-share follow-up below) is unaffected. `undefined`
   * (the default) preserves this component's exact pre-existing
   * behaviour -- the redirect fires unconditionally, same as before this
   * prop existed. */
  onCreated?: (result: CreateJourneyResponse) => void;
  /** The visitor's saved and recent routes: picking one fills Origin and
   * Destination. */
  routeShortcuts?: RouteShortcuts | undefined;
}) {
  const router = useRouter();
  const [originCrs, setOriginCrs] = useState(initialOrigin);
  const [destinationCrs, setDestinationCrs] = useState(initialDestination);
  const [operator, setOperator] = useState('');
  // Defaults to "now" (the repo owner's own stated expectation), not
  // `null` -- computed once via lazy `useState` initializer, in the exact
  // Europe/London-wall-clock `'YYYY-MM-DD HH:mm:ss'` string shape the "Now"
  // button (below) and `pickDeparture`/`pickCifDeparture` already construct,
  // so it round-trips through `handleSubmit`'s own parsing identically to a
  // value the user picked by hand. `nowInLondon()`, not `dayjs()` -- this
  // value feeds `handleSubmit`'s `serviceDate`/`scheduled_departure`
  // computation directly, so it must be pinned to the London wall clock this
  // whole app treats train times as being in, not whatever zone the
  // visitor's own browser happens to be in (2026-09-26 review, finding M8;
  // contrast the trip planner's "Depart at" field, an ordinary filter
  // input correctly left in plain browser-local time).
  const [scheduledDeparture, setScheduledDeparture] = useState<string | null>(() =>
    nowInLondon().format('YYYY-MM-DD HH:mm:ss'),
  );
  // Darwin's own explicit skipped-calling-point snapshot for whichever
  // live departure-board row the user picked (`pickDeparture`, below) --
  // a live-board pick is the only source that ever has this signal at all
  // (the CIF-picker/manual-entry paths never do). `submitTrack`'s `pin`-mode
  // leg forwards this to `POST /Journeys` (`CreateJourneyLegRequest::Pin`'s
  // own `skippedStations` field, `crates/api/src/routes/journeys.rs`), the
  // same value the legacy `TrackPinRequest` this form used to submit
  // carried under the same name.
  const [skippedStations, setSkippedStations] = useState<string[]>([]);
  // Darwin's own platform snapshot for whichever live departure-board row
  // the user picked (`pickDeparture`, below) -- carried through to the pin
  // so the journey timeline's origin stop can eventually show it (see
  // `common::TrackPinRequest.platform`/`planned_platform`'s own doc
  // comments). `null` (never sent) until an LDBWS row is actually picked --
  // same posture as `skippedStations` immediately above.
  const [platform, setPlatform] = useState<string | null>(null);
  const [plannedPlatform, setPlannedPlatform] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const needsLoginState = useNeedsLogin();
  const [fieldError, setFieldError] = useState<string | null>(null);
  const { groups } = useGroupSummaries();
  const [destinationPromptOpened, setDestinationPromptOpened] = useState(false);

  const [originTouched, setOriginTouched] = useState(false);

  const originValid = CRS_PATTERN.test(originCrs.trim());
  const { picker, loading: pickerLoading } = useDeparturePicker(originCrs, originValid, initialOrigin);
  const canSubmit = originValid && scheduledDeparture !== null && !submitting;

  // Window-search mode -- the `SegmentedControl`'s second option. Reuses
  // `TimeFilterInput`'s existing before/after convention verbatim (per the
  // journey-tracking design doc's own §0.5 direction) rather than inventing
  // a new one for leg-window entry.
  const [mode, setMode] = useState<'pick' | 'window'>(initialMode);
  const modeLabelId = useId();
  // Destination is the SAME field in both modes: one `destinationCrs` state, so a
  // value typed in one mode survives toggling the `SegmentedControl`, and the
  // window-mode Autocomplete reuses `destinationSuggestions`/
  // `destinationSuggestionsLoading` (declared with `destinationCrs` above).
  // Origin (`originCrs`) is shared the same way. `scheduledDeparture`, the window
  // date-and-time bounds and `operator` stay mode-scoped on purpose: they have no
  // equivalent in the other mode (window mode has no single departure instant to
  // fill, pick mode has no depart/arrive bounds, and `operator` only narrows pick
  // mode's fetched departure board).
  // Seeded with today's real date, not `null`: a `null` showed "Today" as a grey
  // placeholder that reads as "nothing selected". Still `clearable` (below), and
  // `submitWindow`'s `?? nowInLondon()...` fallback covers a cleared value.
  // `nowInLondon()`, not `dayjs()`: this is a `serviceDate` sent straight to the
  // backend, like `scheduledDeparture`'s default just above.
  const [windowServiceDate, setWindowServiceDate] = useState<string | null>(
    () => initialServiceDate ?? nowInLondon().format('YYYY-MM-DD'),
  );
  const [departFrom, setDepartFrom] = useState(initialDepartAfter);
  const [departTo, setDepartTo] = useState(initialDepartBefore);
  const [arriveFrom, setArriveFrom] = useState(initialArriveAfter);
  const [arriveTo, setArriveTo] = useState(initialArriveBefore);
  // Same half-entered-time bookkeeping TrainSearchForm.tsx's own four
  // TimeFilterInput fields already need -- see that component's own
  // `incompleteTimes` doc comment for the full reasoning (a native
  // `<input type="time">` reports a half-entered value as `''`,
  // indistinguishable from untouched).
  const [windowIncompleteTimes, setWindowIncompleteTimes] = useState({
    departFrom: false,
    departTo: false,
    arriveFrom: false,
    arriveTo: false,
  });
  // Renamed from `windowDestinationValid` now that Destination is shared
  // state (see the comment above `windowServiceDate`) -- this is no longer
  // a window-mode-only computation, even though it is currently only
  // CONSUMED by window mode's own validation/copy below (pin mode's
  // Destination field stays optional with no equivalent validity gate,
  // unchanged).
  const destinationValid = CRS_PATTERN.test(destinationCrs.trim());
  const windowTimesComplete = !Object.values(windowIncompleteTimes).some(Boolean);
  const windowHasABound =
    departFrom.trim() !== '' || departTo.trim() !== '' || arriveFrom.trim() !== '' || arriveTo.trim() !== '';
  const canSubmitWindow = originValid && destinationValid && windowTimesComplete && windowHasABound && !submitting;

  /** Fills Destination/Operator/Scheduled-departure from a picked, real
   * live departure -- without submitting, so the user can still review/
   * edit before tracking. Combines the departure's `"HH:MM"` with its REAL
   * Europe/London calendar date, via `resolveLdbwsDepartureDate`, into the
   * exact `'YYYY-MM-DD HH:mm:ss'` string shape `scheduledDeparture` already
   * expects -- same construction as the "Now" button above
   * (`nowInLondon().format('YYYY-MM-DD HH:mm:ss')`). `resolveLdbwsDepartureDate`
   * itself converts whatever `now` it's given to Europe/London internally
   * (see that function's own doc comment), so the plain `dayjs()` passed
   * below is fine as an absolute instant -- what would NOT be fine is
   * reading a calendar date or combining it with `row.scheduled` (a London
   * wall-clock reading) anywhere else without going through it.
   *
   * Not always literally "today": a row picked from a live board viewed
   * near local midnight can genuinely be tomorrow (e.g. viewing the board
   * at 23:50 and picking a `"00:07"` row -- a real, near-term, 17-minutes-
   * away departure, not something ~23h43m in the past) --
   * `resolveLdbwsDepartureDate`'s own doc comment explains the heuristic
   * this relies on to tell that case apart from a normal same-day pick. */
  function pickDeparture(row: DepartureRow) {
    setDestinationCrs(row.destinationCrs);
    setOperator(row.operator);
    const [hh, mm] = row.scheduled.split(':');
    const date = resolveLdbwsDepartureDate(row.scheduled, dayjs());
    setScheduledDeparture(`${date} ${hh}:${mm}:00`);
    setSkippedStations(row.skippedStations);
    setPlatform(row.platform);
    setPlannedPlatform(row.plannedPlatform);
  }

  /** CIF-derived sibling of `pickDeparture` -- fills only
   * Destination/Scheduled-departure. `operator` is left exactly as the user
   * already typed it, never cleared, never guessed -- the CIF SCHEDULE feed
   * has no operator field at all. If `row.destinationCrs` is
   * `null` (the terminating TIPLOC has no `stanox_crs` row), the existing
   * Destination field is left untouched too, for the same "never guess,
   * never clobber with a blank" reason.
   *
   * Adds `row.dayOffset` days to the row's own `serviceDate` (a
   * Europe/London date captured at fetch
   * time, see `CifPickerRow`), rather than always assuming "today" the way
   * `pickDeparture` (LDBWS, below) still does -- a post-midnight CIF calling
   * point (`dayOffset: 1`, e.g. `00:07`) is genuinely TOMORROW relative to
   * the schedule's service date, and combining it with bare "today" would
   * create a pin with the wrong departure instant (see
   * `ScheduleDepartureRow.dayOffset`'s own doc comment).
   *
   * The pin's `serviceDate` (the first ten characters of this value, see
   * `submitTrack`) is therefore the DEPARTURE's London calendar day, not the
   * CIF service date the row's `/train` link uses. That is deliberate and
   * is the backend's documented pin contract: a pin is matched by station +
   * instant, and `ds_store::sweeps::schedule_matching::find_schedule_match`
   * also searches the previous day's overnight schedules for exactly this
   * case, keying the matched train on the schedule's own date. The same
   * contract covers LDBWS and manual pins, which have no service date to
   * send. A row from yesterday's bucket (00:00-02:00, see
   * `fetchCifPickerRows`) departs today and so is pinned with today.
   *
   * `pickDeparture` (LDBWS, above) has the analogous fix,
   * `resolveLdbwsDepartureDate` -- `DepartureRow` still carries no day-offset
   * FIELD (Darwin's live board has no CIF-schedule linkage to derive one
   * from), but unlike here, where the day offset is a known fact read
   * straight off the row, LDBWS instead INFERS it from a bounded-look-ahead
   * heuristic -- see that function's own doc comment for why that's
   * reliable for this specific data source. */
  function pickCifDeparture(row: CifPickerRow) {
    if (row.destinationCrs !== null) setDestinationCrs(row.destinationCrs);
    // The CIF SCHEDULE feed has no per-service skip signal at all (Decision
    // 2) -- clears any snapshot a previously-picked LDBWS row may have left
    // behind, so switching pickers can't carry a stale skip list onto a
    // different service. Same reasoning for platform: CIF has no live
    // platform signal either.
    setSkippedStations([]);
    setPlatform(null);
    setPlannedPlatform(null);
    setScheduledDeparture(cifDepartureDateTime(row));
  }

  /** The real submit -- does the `POST /api/Train/track` call and every
   * follow-up, exactly as this form always has. `groupId` is `null` for the
   * plain personal-tracking flow (the ONLY value it's ever called with when
   * `groups` is empty, preserving today's exact behavior), or a chosen
   * group's id from `TrackDestinationModal`'s `onConfirm`. */
  async function submitTrack(groupId: string | null) {
    if (!canSubmit) return;
    setSubmitting(true);
    needsLoginState.reset();
    setFieldError(null);
    trackFeature('track_train', 'submitted');
    try {
      // `scheduledDeparture` is the DateTimePicker's own bare-wall-clock
      // string, `'YYYY-MM-DD HH:mm:ss'` (@mantine/dates' `assign-time.mjs`
      // formats it via `date.format('YYYY-MM-DD HH:mm:ss')`) -- not ISO
      // 8601, and with no zone/offset of its own. Every value that ever
      // lands in this state (the "now" default, the "Now" button, a picked
      // live-departure-board row, a picked CIF schedule row -- see each of
      // their own doc comments) is built to represent an Europe/London
      // wall-clock reading, matching the departure times themselves (a
      // train's scheduled departure is always stated in Europe/London terms
      // in this app, `lib/dateFormat.ts`'s own stated convention), NOT
      // whatever zone the visitor's own browser happens to be in.
      //
      // `service_date` is `serviceDate`'s first 10 characters, read directly
      // off the raw string rather than round-tripped through `Date` --
      // that's already the London calendar date the string represents, and
      // a round-trip would risk exactly the kind of local-midnight/DST
      // day-off-by-one this comment is about avoiding for the timestamp
      // below.
      //
      // `scheduled_departure`, unlike `service_date`, DOES need the real UTC
      // instant, so it can't just take the string as-is -- but a bare
      // `new Date(scheduledDeparture.replace(' ', 'T'))` (this function's own
      // shape until the 2026-09-26 "Repeater Signal" review, finding M8)
      // parses a zone-less date-time string in the HOST's own timezone per
      // the ECMAScript spec -- the browser's, for a value built client-side.
      // That is only ever correct for a visitor whose own browser happens to
      // be on Europe/London; anyone else (a UK-based visitor travelling
      // abroad, someone tracking a train for a UK-based relative from a
      // different zone) got the wrong instant, silently -- close enough most
      // of the day to go unnoticed, but capable of computing a `/train/
      // {uid}/{date}` link a whole day off `serviceDate` near the London
      // midnight boundary. `londonWallClockToUtc` (`lib/londonWallClock.ts`)
      // is the fix: it explicitly resolves the string against Europe/London
      // (via `dayjs`'s `utc`/`timezone` plugins) rather than relying on
      // whatever zone the runtime happens to be in.
      const serviceDate = scheduledDeparture.slice(0, 10);
      const departure = londonWallClockToUtc(scheduledDeparture);
      const body = {
        customName: null,
        leg: {
          mode: 'pin' as const,
          originCrs: originCrs.trim().toUpperCase(),
          scheduledDeparture: departure.toISOString(),
          serviceDate,
          ...(destinationCrs.trim() ? { destinationCrs: destinationCrs.trim().toUpperCase() } : {}),
          ...(operator.trim() ? { operator: operator.trim() } : {}),
          ...(skippedStations.length > 0 ? { skippedStations } : {}),
          // Integration note (2026-09-22): the Darwin platform snapshot the
          // departure-board picker captures (`pickDeparture`) used to ride
          // on the legacy `POST /Train/track` body as
          // `platform`/`planned_platform`. `POST /Journeys` replaced that
          // route, so the same two values now travel inside the pin-mode
          // LEG, in this endpoint's camelCase convention -- see
          // `CreateJourneyLegRequest::Pin` in
          // `crates/api/src/routes/journeys.rs`, which forwards them into
          // the very same `common::TrackPinRequest` fields the old route
          // filled. Dropping them here would silently lose the origin
          // calling point's platform on every newly pinned journey.
          ...(platform !== null ? { platform } : {}),
          ...(plannedPlatform !== null ? { plannedPlatform } : {}),
        },
      };

      const response = await fetch('/api/Journeys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        trackFeature('track_train', 'succeeded');
        const result = (await response.json()) as CreateJourneyResponse;
        if (groupId !== null) {
          // Shares the train's new one-leg journey (DS-124).
          await shareTrackedTrainToGroup(groupId, result.journeyPublicId);
        }
        if (onCreated) {
          onCreated(result);
        } else {
          router.push(`/journeys/${result.journeyPublicId}`);
        }
        return;
      }
      if (response.status === 401) {
        needsLoginState.markNeedsLogin();
        return;
      }
      trackFeature('track_train', 'failed');
      if (response.status === 400) {
        setFieldError(await failureFromResponse('track', 'this train', response));
        return;
      }
      setFieldError(describeFailure('track', 'this train', response.status));
    } catch {
      trackFeature('track_train', 'failed');
      setFieldError(describeFailure('track', 'this train'));
    } finally {
      setSubmitting(false);
    }
  }

  /** The window-search mode's own submit -- posts a `window`-mode leg to
   * `POST /Journeys` instead of a `pin`-mode one, creating an `'unmatched'`
   * leg with no train bound yet (the journey view is where a
   * candidate gets picked next). Reuses `TrackDestinationModal`'s
   * Personal-vs-group prompt the same way `submitTrack` does -- see
   * `handleSubmit`'s own doc comment -- but `groupId` is currently a
   * placeholder here: sharing an open/unmatched leg into a group at
   * creation time has no real precedent yet (there is no train to share),
   * and journey-level group sharing is deferred. The parameter is kept,
   * unused, purely so `handleSubmit`'s
   * dispatch to either `submitTrack`/`submitWindow` can share one call
   * shape without a branch on arity. */
  async function submitWindow(_groupId: string | null) {
    if (!canSubmitWindow) return;
    setSubmitting(true);
    needsLoginState.reset();
    setFieldError(null);
    try {
      const body = {
        customName: null,
        leg: {
          mode: 'window' as const,
          originCrs: originCrs.trim().toUpperCase(),
          destinationCrs: destinationCrs.trim().toUpperCase(),
          serviceDate: windowServiceDate ?? nowInLondon().format('YYYY-MM-DD'),
          departWindow: { after: departFrom || null, before: departTo || null },
          arriveWindow: { after: arriveFrom || null, before: arriveTo || null },
        },
      };
      const response = await fetch('/api/Journeys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (response.ok) {
        const result = (await response.json()) as CreateJourneyResponse;
        // No trackingId yet (an open leg has no train bound), so no group-share
        // follow-up is possible here, unlike submitTrack/pin mode. The journey view
        // is where a candidate gets picked next.
        // `_groupId` is reserved for a future group-share-on-window-search follow-up.
        if (onCreated) {
          onCreated(result);
        } else {
          router.push(`/journeys/${result.journeyPublicId}`);
        }
        return;
      }
      if (response.status === 401) {
        needsLoginState.markNeedsLogin();
        return;
      }
      if (response.status === 400) {
        setFieldError(await failureFromResponse('search for', 'a train', response));
        return;
      }
      setFieldError(describeFailure('search for', 'a train', response.status));
    } catch {
      setFieldError(describeFailure('search for', 'a train'));
    } finally {
      setSubmitting(false);
    }
  }

  /** The form's own `onSubmit` -- zero groups calls `submitTrack` directly
   * (today's exact behavior, unchanged); one or more groups opens
   * `TrackDestinationModal` instead and defers the real submit to its
   * `onConfirm`. See this component's own doc comment.
   *
   * The submit `Button` below is disabled only while a submit is in flight
   * (`submitting`, which has its own "Tracking" label). It stays enabled for an
   * invalid form because Mantine's disabled style is under 2:1 contrast in dark
   * mode and unfixable by a `variant` change alone (`@mantine/core/styles.css`'s
   * `[data-disabled]` rule overrides every variant). An invalid press falls
   * through to here and surfaces the same `fieldError` `Alert` a failed backend
   * validation renders, so a click always gets a visible result. */
  function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (submitting) return;
    if (mode === 'window') {
      if (!originValid || !destinationValid || !windowHasABound) {
        setFieldError(
          !originValid || !destinationValid
            ? 'Enter a valid origin and destination station before searching.'
            : 'Enter at least one earliest/latest departure or arrival time to search a window.',
        );
        return;
      }
      // Presence alone isn't enough: "earliest 18:00, latest 09:00" would reach the
      // backend unexamined. Plain string comparison is safe: both are always "HH:MM"
      // (`TimeFilterInput`'s value contract), which sorts like time within one day.
      if (departFrom && departTo && departFrom > departTo) {
        setFieldError('Latest departure must be after earliest departure.');
        return;
      }
      if (arriveFrom && arriveTo && arriveFrom > arriveTo) {
        setFieldError('Latest arrival must be after earliest arrival.');
        return;
      }
      // The picker's `maxDate` stops a far pick; this catches a prefilled
      // one (`?date=`) before the round trip.
      if (windowServiceDate !== null && windowServiceDate > lastPinDate()) {
        setFieldError(pinTooFarMessage);
        return;
      }
      setFieldError(null);
      if (groups.length > 0) {
        setDestinationPromptOpened(true);
        return;
      }
      void submitWindow(null);
      return;
    }
    if (!originValid || scheduledDeparture === null) {
      setFieldError(
        !originValid
          ? 'Pick an origin station from the suggestions, or enter its 3-letter code.'
          : 'Pick a scheduled departure before tracking.',
      );
      return;
    }
    // The picker's `maxDate` already stops a far pick; this catches a typed
    // or prefilled one before the round trip. `scheduledDeparture` is a
    // London wall-clock string, so its first 10 characters are the
    // service date the backend checks.
    if (scheduledDeparture.slice(0, 10) > lastPinDate()) {
      setFieldError(pinTooFarMessage);
      return;
    }
    setFieldError(null);
    if (groups.length > 0) {
      setDestinationPromptOpened(true);
      return;
    }
    void submitTrack(null);
  }

  return (
    <Stack gap="md">
      {/* The intro lives here, not in `track/page.tsx`, so it can follow the
          client-side mode toggle instead of only the initial `?mode=` a page load saw. */}
      <Text c="dimmed">
        {mode === 'window'
          ? "Not sure which train yet? Tell us roughly when you're travelling (Origin, Destination and at least one of the times below) and we'll show you the matches to choose from. You can change your pick later."
          : 'Track a specific train to see its live position, delay and next stop.'}
      </Text>
      <Stack gap="md" component="form" onSubmit={handleSubmit} maw={640}>
        <RouteShortcutPicker
          shortcuts={routeShortcuts}
          onPick={(origin, destination) => {
            setOriginCrs(origin);
            setDestinationCrs(destination);
          }}
        />
        <StationField
          label="Origin station"
          placeholder="e.g. Woking or WOK"
          value={originCrs}
          onChange={setOriginCrs}
          onBlur={() => setOriginTouched(true)}
          error={originTouched && originCrs.length > 0 && !originValid ? 'Must be a 3-letter station code' : null}
          // NOT the native `required` attribute: an empty origin is validated by
          // `handleSubmit` itself, which sets `fieldError` and returns before calling
          // `submitTrack`. A native `required` would let the browser's constraint
          // validation intercept the submit first and replace that message with a
          // native validation bubble.
        />
        {/* Origin is the one field both modes share -- every leg shape
          (`pin`/`knownTrain`/`window`) needs an `originCrs`, so it stays
          above the mode switch rather than being duplicated inside each
          branch. */}
        {/* "I know the train" / "Search a time window" match the `AddJourneyLegButton`
            modal's wording and name the traveller's situation, not the form's mechanism.

            A visible label wired as the radiogroup's own name. Without it a screen
            reader announced "radiogroup, Pick a departure, radio button, 1 of 2,
            checked" with the group itself unnamed, and this toggle is the main
            discovery path for window mode. Same `Text id` + `aria-labelledby` shape
            `HistoryRangePicker`'s "Period" control uses. */}
        <Text id={modeLabelId} size="xs" fw={600} c="dimmed">
          How do you want to find the train?
        </Text>
        <SegmentedControl
          aria-labelledby={modeLabelId}
          value={mode}
          onChange={(value) => setMode(value)}
          data={[
            { label: 'I know the train', value: 'pick' },
            { label: 'Search a time window', value: 'window' },
          ]}
        />
        {/* The toggle swaps ~400px of form with no announcement for screen-reader
            users. `VisuallyHidden` keeps this out of the visual layout. */}
        <VisuallyHidden role="status" aria-live="polite">
          {mode === 'window' ? 'Showing time-window search.' : 'Showing pick-a-departure search.'}
        </VisuallyHidden>
        {mode === 'window' ? (
          <>
            <StationField
              label="Destination station"
              placeholder="e.g. Reading or RDG"
              // `destinationCrs`/`setDestinationCrs`/`destinationSuggestions`
              // -- the SAME state and suggestions hook the pin-mode
              // Destination field below uses, not a separate window-mode
              // copy. See the state-declaration comment above
              // `windowServiceDate` for why: a value typed here now survives
              // switching back to "I know the train" mode, and vice versa.
              value={destinationCrs}
              onChange={setDestinationCrs}
              error={destinationCrs.length > 0 && !destinationValid ? 'Must be a 3-letter station code' : null}
              // NOT the native `required` attribute -- same reasoning as the
              // Origin field's own comment above: a native `required` field
              // would let the browser's own constraint validation intercept
              // the submit event before `handleSubmit` ever runs (confirmed
              // live -- jsdom enforces this too), silently replacing this
              // form's own explanatory `fieldError` message with (at best) a
              // native validation bubble instead. `handleSubmit`'s own
              // `!destinationValid` check already owns this
              // validation.
            />
            <DatePickerInput
              valueFormat={PICKER_DATE_FORMAT}
              label="Date"
              // `windowServiceDate` is seeded with today's real date, so this shows an actual
              // value like pin-mode's default departure; "Today" is only the placeholder if
              // the field is cleared.
              placeholder="Today"
              value={windowServiceDate}
              onChange={setWindowServiceDate}
              clearable
              // Bug: this `clearable` field was the one place in the app
              // missing the `clearButtonProps` aria-label every other
              // `clearable` field already carries (see e.g.
              // `TrainSearchForm.tsx`'s own "Clear the date" and
              // `IncidentSearchForm.tsx`'s comment on the same pattern).
              // Mantine's `clearable` renders an icon-only close button with
              // no accessible name of its own, which axe-core flags as a
              // critical `button-name` violation -- caught by the
              // accessibility suite's `/track, departure picker populated`
              // and route-sweep cases once this field had a value to clear.
              clearButtonProps={{ 'aria-label': 'Clear the date' }}
              // The same horizon as a pin: the backend refuses a window
              // leg dated past `PIN_MAX_DAYS_AHEAD` with `pinTooFarMessage`.
              maxDate={lastPinDate()}
            />
            {/* All four fields below say "(optional)" individually, but `windowHasABound`
                (used by `handleSubmit` above) refuses to submit unless at least one is set,
                so the rule is stated up front rather than only as a post-submit error. */}
            <Text size="sm">At least one of the four times below is required to search.</Text>
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <TimeFilterInput
                clockHint
                label="Earliest departure (optional)"
                name="earliest departure"
                description={`Only trains leaving ${originValid ? originCrs.trim().toUpperCase() : 'the origin above'} at or after this time.`}
                value={departFrom}
                onChange={setDepartFrom}
                onIncompleteChange={(v) => setWindowIncompleteTimes((c) => ({ ...c, departFrom: v }))}
                error={null}
              />
              <TimeFilterInput
                label="Latest departure (optional)"
                name="latest departure"
                description={`Only trains leaving ${originValid ? originCrs.trim().toUpperCase() : 'the origin above'} at or before this time.`}
                value={departTo}
                onChange={setDepartTo}
                onIncompleteChange={(v) => setWindowIncompleteTimes((c) => ({ ...c, departTo: v }))}
                error={null}
              />
            </SimpleGrid>
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <TimeFilterInput
                label="Earliest arrival (optional)"
                name="earliest arrival"
                description={`Only trains reaching ${destinationValid ? destinationCrs.trim().toUpperCase() : 'the destination above'} at or after this time.`}
                value={arriveFrom}
                onChange={setArriveFrom}
                onIncompleteChange={(v) => setWindowIncompleteTimes((c) => ({ ...c, arriveFrom: v }))}
                error={null}
              />
              <TimeFilterInput
                label="Latest arrival (optional)"
                name="latest arrival"
                description={`Only trains reaching ${destinationValid ? destinationCrs.trim().toUpperCase() : 'the destination above'} at or before this time.`}
                value={arriveTo}
                onChange={setArriveTo}
                onIncompleteChange={(v) => setWindowIncompleteTimes((c) => ({ ...c, arriveTo: v }))}
                error={null}
              />
            </SimpleGrid>
          </>
        ) : (
          <>
            {/* `wrap="nowrap"` plus the button's own `flexShrink: 0`: without them this
                `Group` wraps at 390px, orphaning "Now" alone under a full-width picker. */}
            <Group align="flex-end" gap="xs" wrap="nowrap">
              <DateTimePicker
                label="Scheduled departure"
                placeholder="Pick date and time"
                valueFormat={PICKER_DATE_TIME_FORMAT}
                value={scheduledDeparture}
                onChange={setScheduledDeparture}
                // The backend rejects a departure more than 6 hours in the past
                // (`crates/api/src/data/train_tracking.rs`'s `MAX_PIN_AGE`) --
                // this hint is here so a rejection is rare rather than the
                // user's first encounter with the rule.
                description={`Must be within the last 6 hours, or up to ${PIN_MAX_DAYS_AHEAD} days ahead`}
                // The backend's pin horizon (`PIN_MAX_DAYS_AHEAD`), as the
                // last minute of that London day: Mantine clamps the picked
                // date-time against this on close, so a bare date would
                // turn an evening departure on the last day into midnight.
                maxDate={`${lastPinDate()} 23:59:59`}
                // Same reasoning as the Origin field above -- a cleared
                // departure is validated by `handleSubmit` itself now, not by
                // native `required` constraint validation.
                flex="1 1 auto"
              />
              {/* `@mantine/dates`' own `presets` prop (9.5.2) only ever assigns a
                *date* (`DatePickerPreset['value']` is a bare `DateStringValue`,
                like `DatePicker`'s "Today"/"Yesterday" presets) -- it has no
                way to also fill in a time-of-day, so it can't produce "right
                now" on its own; a plain Button next to the picker is the clean
                fit here instead. `nowInLondon().format('YYYY-MM-DD HH:mm:ss')`
                deliberately matches the exact bare-wall-clock string shape
                the picker itself produces (`assign-time.mjs`'s own
                `date.format('YYYY-MM-DD HH:mm:ss')`) -- see this file's own
                `handleSubmit` comment on why that shape, not an ISO string,
                is required to avoid an around-midnight day-off-by-one, and
                why it's anchored to Europe/London rather than `dayjs()`'s
                host zone (2026-09-26 review, finding M8). */}
              <Button
                variant="default"
                flex="none"
                onClick={() => setScheduledDeparture(nowInLondon().format('YYYY-MM-DD HH:mm:ss'))}
              >
                Now
              </Button>
            </Group>
            <StationField
              label="Destination station (optional)"
              placeholder="e.g. Woking or WOK"
              value={destinationCrs}
              onChange={setDestinationCrs}
            />
            <OperatorField label="Operator (optional)" placeholder="e.g. SW" value={operator} onChange={setOperator} />
            {/* Always present, never absent from the DOM (see
                docs/superpowers/specs/2026-09-04-track-a-train-picker-refactor-design.md).
                `mih={72}` blunts the size jump between the
                one/two-line text states; row-list states can legitimately grow
                past the minimum and are deliberately given no maximum -- see
                `DeparturePicker`'s doc comment for why the `mah`-capped
                `ScrollArea` that used to bound them was a clip, not a scroller,
                and why nothing replaced it. */}
            <Stack gap="xs" mih={72}>
              <DeparturePicker
                originValid={originValid}
                loading={pickerLoading}
                picker={picker}
                destinationCrs={destinationCrs}
                operator={operator}
                scheduledDeparture={scheduledDeparture}
                onPickLive={pickDeparture}
                onPickTimetable={pickCifDeparture}
              />
            </Stack>
          </>
        )}
        {fieldError && (
          <Alert color="red" title={mode === 'window' ? "Couldn't search for a train" : "Couldn't track this train"}>
            {fieldError}
          </Alert>
        )}
        <Group>
          {/* Disabled only while a submit is in flight -- see
              `handleSubmit`'s doc comment for why an
              invalid-but-not-yet-submitted form doesn't disable this
              button. */}
          <Button type="submit" disabled={submitting} leftSection={submitting ? <ButtonSpinner /> : undefined}>
            {mode === 'window'
              ? submitting
                ? 'Searching'
                : 'Search for a train'
              : submitting
                ? 'Tracking'
                : 'Track this train'}
          </Button>
        </Group>
      </Stack>
      <TrackDestinationModal
        opened={destinationPromptOpened}
        groups={groups}
        onClose={() => setDestinationPromptOpened(false)}
        onConfirm={(groupId) => void (mode === 'window' ? submitWindow(groupId) : submitTrack(groupId))}
      />
      {/* The modal copy follows the mode: in window mode nothing is tracked yet
          (a window search has no chosen train). */}
      <LoginPromptModal opened={needsLoginState.needsLogin} onClose={needsLoginState.reset}>
        {mode === 'window' ? 'Log in to search for a train.' : 'Log in to track this train.'}
      </LoginPromptModal>
    </Stack>
  );
}
