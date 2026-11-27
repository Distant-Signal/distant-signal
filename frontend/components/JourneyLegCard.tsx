'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, Group, Stack, Text } from '@mantine/core';
import { TrainJourney } from './TrainJourney';
import { TrainOperator } from './TrainOperator';
import { JourneyLegCandidates } from './JourneyLegCandidates';
import { LegSearchForm } from './LegSearchForm';
import { TrainNotificationsSwitch } from './TrainNotificationsSwitch';
import { TextLink } from './TextLink';
import { RemoveJourneyLegButton } from './RemoveJourneyLegButton';
import { LegReplanActions, type LegReplanContext } from './LegReplanActions';
import { UntrackedLegCard } from './UntrackedLegCard';
import { legActionLabel, removeLegLabel, type LegPlace } from '@/lib/legActionLabel';
import { LegDelayRepay } from './LegDelayRepay';
import { LegTicketDetails } from './LegTicketDetails';
import { useRemindPick } from './UsualTrainContext';
import { isUntrackedLeg, type UntrackedLegNeighbours } from '@/lib/untrackedLeg';
import { legRouteAndTime } from '@/lib/journeyLegLabel';
import { formatDate } from '@/lib/dateFormat';
import { routeLabel, stationLabel } from '@/lib/stationLabel';
import { legSearchPrefill, remindPickSearch, type LegSearch } from '@/lib/legSearch';
import { legRef, trackingRef } from '@/lib/publicId';
import type { JourneyLegDetail } from '@/lib/types';
import { irishTrainHref } from '@/lib/ireland';

/** Decorative "needs attention" glyph for the open-leg card (review
 * §2.3/I15). `@tabler/icons-react` isn't a project dependency (see
 * `InfoIcon.tsx`'s own note) -- inline SVG in the same house style: 16px,
 * `currentColor`, `aria-hidden` (the card's own text already says "pick a
 * train"/"waiting for the owner", so this adds no information a screen
 * reader needs). */
function AlertIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

/** `"HH:MM:SS"` -> `"HH:MM"` -- these are bare wall-clock bounds
 * (`common::TimeWindow` on the wire), never full RFC3339 instants, so
 * there is no timezone conversion to do (unlike `lib/dateFormat.ts`'s
 * formatters, which all pin `Europe/London` for a real instant) -- just
 * trimming the seconds a passenger never entered. */
function formatWindowTime(value: string): string {
  return value.slice(0, 5);
}

/** "Departing at or after 18:00 · Arriving at or before 09:00"-shaped
 * summary of an open leg's own search window, shown back to the traveller
 * (spec §4: the open-leg card shows "the search parameters (origin,
 * destination, windows)"). Phrased to match
 * field descriptions exactly ("Only trains departing at or after this
 * time.", etc.) rather than inventing new wording for the same facts.
 * `null` when the leg has no window at all (a `pin`/`knownTrain`-mode
 * leg is never `trackedTrainState === null` in the first place, so this
 * realistically never returns `null` at this call site, but it's a
 * plain function of the four fields, not leg-mode-aware, so it stays
 * honest for any future caller). */
/** One side's (depart or arrive) contribution to `windowSummary`, given
 * that side's own after/before bounds. Collapses to a single "between X
 * and Y" phrase when BOTH bounds on this side are set, rather than the
 * literal "departing at or after 19:00 · departing at or before 21:00"
 * the naive per-field join used to produce -- the same verb repeated back
 * to back reads as a copy-paste bug even though it isn't one. `null` when
 * neither bound on this side is set. */
function windowSideSummary(verb: 'departing' | 'arriving', after: string | null, before: string | null): string | null {
  if (after && before) return `${verb} between ${formatWindowTime(after)} and ${formatWindowTime(before)}`;
  if (after) return `${verb} at or after ${formatWindowTime(after)}`;
  if (before) return `${verb} at or before ${formatWindowTime(before)}`;
  return null;
}

function windowSummary(
  leg: Pick<JourneyLegDetail, 'departAfter' | 'departBefore' | 'arriveAfter' | 'arriveBefore'>,
): string | null {
  const parts = [
    windowSideSummary('departing', leg.departAfter, leg.departBefore),
    windowSideSummary('arriving', leg.arriveAfter, leg.arriveBefore),
  ].filter((part): part is string => part !== null);
  const [first, ...rest] = parts;
  if (first === undefined) return null;
  const capitalised = first.charAt(0).toUpperCase() + first.slice(1);
  return [capitalised, ...rest].join(' · ');
}

/** One leg's card on `/journeys/[id]` (design doc §4). Two branches:
 *
 * - **Open** (`trackedTrainState === null`): the search parameters plus,
 *   for the journey's OWNER only, a "Remove leg" action (top-right of the
 *   card, same convention as the matched branch below) and a
 *   `JourneyLegCandidates` picker -- a non-owning group member (reachable
 *   here via `journey_readable_by`'s group-shared read path) sees a plain
 *   "waiting for the owner"
 *   message instead of the picker, since picking a train for someone
 *   else's leg is a 404 the backend correctly refuses; it never sees
 *   "Remove leg" either, for the same reason.
 * - **Matched**: `TrainJourney` (reused unmodified, per the design doc's
 *   own explicit direction) plus, for the journey's OWNER only, up to two
 *   INDEPENDENT actions, not a mutually-exclusive either/or: "Remove leg"
 *   is always offered (backed by `DELETE
 *   /Journeys/{journeyId}/legs/{legId}`,
 *   `crates/api/src/routes/journeys.rs::delete_journey_leg` -- that route
 *   has never cared what created the leg or whether it carries a window,
 *   so gating the BUTTON on `hasWindow` was a frontend-only restriction
 *   with no backend reason behind it), and "Change train", on every
 *   train leg, revealing the SAME `LegTrainPicker` (candidates and "Edit
 *   search"), re-scoped to this leg: a window-searched leg searches its
 *   own persisted window (`crates/api/src/routes/journeys.rs::get_leg_candidates`);
 *   a pinned, "I know the train" or planner-saved leg, which has none,
 *   starts from a search made from its stations, date and timetabled
 *   departure (`legSearchPrefill`, mid-journey changes spec 2026-10-22
 *   Phase 0). Until then those legs had no way to pick another train
 *   except removing the leg and adding a new one.
 *
 * Every action lives in the card's OWN title row, top-right: actions live at
 * the top-right of the thing they act on, the same rule `page.tsx`'s header
 * already applies to "Add a leg". */
/** An open train leg's route. A leg saved with no origin (its train was
 * released, or never had a timetable) is a "Train leg", never "Unknown
 * station" (DS-144). */
function openLegRouteLabel(leg: JourneyLegDetail): string {
  if (leg.originCrs) return routeLabel(leg.originCrs, leg.originName, leg.destinationCrs, leg.destinationName);
  return leg.destinationCrs ? `Train leg to ${stationLabel(leg.destinationCrs, leg.destinationName)}` : 'Train leg';
}

export function JourneyLegCard({
  journeyId,
  leg,
  isOwner,
  shareToken,
  isOnlyLeg,
  replan,
  neighbours,
  place = null,
}: {
  journeyId: string;
  leg: JourneyLegDetail;
  isOwner: boolean;
  /** The token of the share link this journey is being read through, if
   * any. A leg whose train was pruned (`trainDetail` `snapshot`) links to the
   * train page under the share link's own path, so the api can read the
   * leg's copy for a viewer with no session (DS-638). */
  shareToken?: string | undefined;
  /** Whether this is the journey's only remaining leg -- threaded from
   * `page.tsx`'s own `journey.legs.length`, and passed straight through to
   * `RemoveJourneyLegButton` so it can warn (and, on success, redirect
   * instead of refresh) when removing this leg also removes the whole
   * journey. See that component's own doc comment. */
  isOnlyLeg: boolean;
  /** Mid-journey actions ("I missed this train", "Find another way"). */
  replan?: LegReplanContext | undefined;
  /** The legs either side, for an untracked leg's place names (DS-239). */
  neighbours?: UntrackedLegNeighbours | undefined;
  /** The leg's shown position ("Leg 2 of 3"), to name its buttons. */
  place?: LegPlace | null;
}) {
  const router = useRouter();
  // A Remind-me regular day (DS-398): the pick looks around the usual train.
  const remindPick = useRemindPick();
  const [changingTrain, setChangingTrain] = useState(false);
  // Backend security/bug review fix (journeys area, Medium finding 1): this
  // used to be derived from the four window bounds directly (`departAfter
  // !== null || ...`), which could never tell "this leg was deliberately
  // created with a fully-open, any-train-any-time search window" apart
  // from "this leg was never window-searched at all" -- both leave every
  // bound `null`. A time-flexible template leg (all four bounds
  // intentionally left unset -- see
  // `journey_templates::validate_template_leg`'s own doc comment) used to
  // permanently lose "Change train" the moment it was first matched, with
  // no recovery except removing the leg outright. `windowSearched` is now
  // recorded server-side, at leg-creation time, precisely to make that
  // distinction -- see `JourneyLegDetail.windowSearched`'s own doc comment.
  const hasWindow = leg.windowSearched;

  // A Tube ride, bus or walk: no train to pick or show (spec 2026-10-20
  // §2.3). Checked before `trackedTrainState === null`, which it also is.
  if (isUntrackedLeg(leg)) {
    return (
      <UntrackedLegCard
        journeyId={journeyId}
        leg={leg}
        isOwner={isOwner}
        isOnlyLeg={isOnlyLeg}
        neighbours={neighbours}
        place={place}
      />
    );
  }

  if (leg.trackedTrainState === null) {
    // Uses the shared `routeLabel`/`formatDate` formatters `TrainJourney` and
    // `/journeys` use, so this card and the matched card one row down agree on
    // naming and date format. There is no `journeyStops` to read names from, but
    // the leg carries `originName`/`destinationName` (resolved server-side from
    // the `stations` reference table), so this degrades to bare codes only when
    // the reference row genuinely doesn't exist.
    const header = `${openLegRouteLabel(leg)}, ${formatDate(leg.serviceDate)}`;
    // Shows the window the traveller typed back to them. The copy mirrors
    // `AddJourneyLegButton.tsx`'s own field descriptions ("Only trains departing
    // at or after this time.") and says "at or after" rather than "after"
    // because that is what the bound means. It does NOT repeat the station
    // names: the header directly above already carries the route.
    const criteria = windowSummary(leg);
    return (
      // The matched card (below) is dense, while THIS card, the one that needs
      // the user to do something, must not look like a plain white box. Four
      // non-colour-alone cues (WCAG 1.4.1): a left accent border, a tinted
      // surface, a bold title, and a leading glyph -- all in grape, the app's
      // action colour, matching `JourneyStatusBadge`'s own `unmatched` colour
      // (blue is kept for planned or changed arrangements -- docs/style-guide.md
      // "Semantic roles"). The glyph uses the light variant's text colour, which
      // is measured AA against this same `grape-light` surface in both schemes.
      <Card withBorder data-needs-action className="openLegCard">
        <Stack gap="sm">
          <Group justify="space-between" align="flex-start" wrap="wrap" gap="xs">
            <Group gap="xs" wrap="nowrap" align="flex-start">
              <span className="openLegCard__icon">
                <AlertIcon />
              </span>
              <Text fw={700}>{header}</Text>
            </Group>
            {/* An open leg is just as removable as a matched one -- the
                backend's `delete_journey_leg` never cared whether the leg
                had a train bound yet, only who owns the journey. This was
                previously offered only on the matched branch, leaving an
                open (never-yet-matched) leg with no delete affordance at
                all. */}
            {isOwner && (
              <RemoveJourneyLegButton
                journeyId={journeyId}
                legId={legRef(leg)}
                isOnlyLeg={isOnlyLeg}
                ariaLabel={removeLegLabel(header, place)}
              />
            )}
          </Group>
          {isOwner ? (
            // "Edit search" re-searches THIS leg in place (`LegTrainPicker`).
            // It used to link to `/track`, whose form starts a new journey
            // (and asks personal or group), and carried only the origin.
            <LegTrainPicker
              journeyId={journeyId}
              leg={leg}
              criteria={criteria}
              editSearchLabel={legActionLabel('Edit search', header, place)}
              initialSearch={remindPick ? remindPickSearch(leg) : null}
              onPicked={() => router.refresh()}
            />
          ) : (
            <>
              {criteria && (
                <Text size="sm" c="dimmed">
                  {criteria}
                </Text>
              )}
              <Text size="sm" c="dimmed">
                Waiting for the owner to pick a train.
              </Text>
            </>
          )}
        </Stack>
      </Card>
    );
  }

  const state = leg.trackedTrainState;

  // Leg-scoped skip signal: at most the leg's own origin/destination CRS, from
  // the `legSkip` wire field. `TrainJourney`/`JourneyTimeline` treat `undefined`
  // and `[]` identically, but this is always a concrete (possibly empty) array
  // here since `leg.legSkip` is only `null` when there's nothing to report.
  const skippedCrs = [
    leg.legSkip?.originSkipped ? leg.originCrs : null,
    leg.legSkip?.destinationSkipped ? leg.destinationCrs : null,
  ].filter((crs): crs is string => crs !== null);

  const title = legRouteAndTime(leg.originCrs, leg.destinationCrs, state.journeyStops, state);

  return (
    <Card withBorder>
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start" wrap="wrap" gap="xs">
          <Stack gap={2}>
            <Text fw={600} size="lg">
              {title}
            </Text>
            {/* Who runs the train, name and code (a leg's tracked train
                carries both). Nothing for an unknown operator. */}
            <TrainOperator name={state.operatorName} code={state.operatorCode} size="xs" />
            {/* Feature request: "journey view legs [should] have link
                throughs to the train entries for each leg" -- this was
                previously a plain, unlinked `Text`, even though every
                other per-train reference in the app (the `ServiceRow` links
                of `JourneyLegCandidates`/`TrainSearchForm`/
                `LineTrainsResults`) already points here. Gated on
                `state.trainUid` alone, same as the plain-text version this
                replaces: `trackedTrainState !== null` (the branch this card
                is already in) does NOT by itself mean a train has been
                identified yet -- `resolutionStatus === 'pending'` leaves
                `trainUid` `null` until Network Rail's first live report
                names the actual service, and there is no `/train/[uid]/...`
                page to link to before that happens. `leg.serviceDate`, not
                `state.serviceDate`: this mirrors every other call site
                below on this card (`JourneyLegCandidates`' own
                `serviceDate={leg.serviceDate}` prop) that treats the LEG's
                own service date, not the matched train's, as the source of
                truth for this URL segment -- the two agree in practice, but
                the leg is what this card is rendering. `/train/[uid]/[date]`
                is a fully public route (no auth, no share token), so this
                is safe to render identically on both the owner's own
                `/journeys/[id]` view and the anonymous `/journeys/shared/
                [token]` view -- it discloses nothing beyond what following
                the link itself already would, and adds nothing to the
                share-link page's own metadata (see that page's
                `generateMetadata` doc comment on why the token/journey id
                stay out of public metadata; a per-leg link to an
                already-public train page is a different, unrelated
                concern). */}
            {state.irishTrain ? (
              // An Iarnród Éireann train's own page (its code, not the
              // internal `ie:` uid).
              <TextLink href={irishTrainHref(state.irishTrain)} size="xs">
                Train {state.irishTrain.trainCode}
              </TextLink>
            ) : (
              state.trainUid && (
                <TextLink href={trainPageHref(state.trainUid, leg.serviceDate, leg.trainDetail, shareToken)} size="xs">
                  Train {state.trainUid}
                </TextLink>
              )
            )}
          </Stack>
          {/* `isOwner` is Phase 4's sharing gate -- a shared-group viewer
              sees the leg but must not be offered "Change train"/"Remove
              leg", either of which the API would reject anyway. Below
              that, both actions are always available to the owner, on
              every train leg (mid-journey phase 0). */}
          {isOwner && (
            <Group gap="xs">
              {replan && <LegReplanActions journeyId={journeyId} leg={leg} context={replan} />}
              <Button
                size="xs"
                variant="default"
                onClick={() => setChangingTrain((c) => !c)}
                aria-label={legActionLabel(changingTrain ? 'Cancel changing train' : 'Change train', title, place)}
              >
                {changingTrain ? 'Cancel' : 'Change train'}
              </Button>
              <RemoveJourneyLegButton
                journeyId={journeyId}
                legId={legRef(leg)}
                isOnlyLeg={isOnlyLeg}
                ariaLabel={removeLegLabel(title, place)}
              />
            </Group>
          )}
        </Group>
        <TrainJourney
          state={state}
          trainDetail={leg.trainDetail}
          skippedCrs={skippedCrs}
          legOriginCrs={leg.originCrs}
          legDestinationCrs={leg.destinationCrs}
          suppressTrainUidHeading
        />
        {isOwner && state.notificationsEnabled !== undefined && (
          <TrainNotificationsSwitch
            trackingId={trackingRef(state)}
            initiallyEnabled={state.notificationsEnabled}
            legName={title}
            place={place}
          />
        )}
        {/* The owner's Delay Repay estimate (no ticket needed) and ticket
            details (2026-11-06). Delay Repay is a GB scheme: an Irish
            train has neither. */}
        {isOwner && leg.delayRepay && <LegDelayRepay delayRepay={leg.delayRepay} />}
        {isOwner && !state.irishTrain && (
          <LegTicketDetails
            journeyId={journeyId}
            legId={legRef(leg)}
            ticket={leg.ticket}
            operatorName={state.operatorName}
            place={place}
            legName={title}
          />
        )}
        {isOwner && changingTrain && (
          <LegTrainPicker
            journeyId={journeyId}
            leg={leg}
            // A leg never window-searched has no search of its own: one is
            // made from what it knows (`legSearchPrefill`).
            initialSearch={hasWindow ? (remindPick ? remindPickSearch(leg) : null) : legSearchPrefill(leg)}
            criteria={hasWindow ? windowSummary(leg) : null}
            editSearchLabel={legActionLabel('Edit search', title, place)}
            onPicked={() => {
              setChangingTrain(false);
              router.refresh();
            }}
          />
        )}
      </Stack>
    </Card>
  );
}

/** How many trains from before the search "Change train" lists. */
const EARLIER_TRAINS = 3;

/** A train leg's candidates and its search, for the owner: the search
 * the leg was made with (`criteria`, its times in words), "Edit search"
 * to change any of it in place (`LegSearchForm`, opened with everything
 * the leg stores), and the trains it finds (`JourneyLegCandidates`). An
 * edited search is only listed until a train is picked from it; the pick
 * saves both to this leg (`POST .../legs/{id}/train` with `search`), the
 * same route as a first pick or "Change train", which releases the old
 * train's subscription. The traveller never leaves the journey page. */
function LegTrainPicker({
  journeyId,
  leg,
  criteria,
  editSearchLabel,
  initialSearch = null,
  onPicked,
}: {
  journeyId: string;
  leg: JourneyLegDetail;
  criteria: string | null;
  /** The accessible name of "Edit search", naming the leg. */
  editSearchLabel: string;
  /** A search to start from instead of the leg's stored one: "Change
   * train" on a leg that was never window-searched (`legSearchPrefill`).
   * Like an edited search, it is saved to the leg with the pick. */
  initialSearch?: LegSearch | null;
  onPicked: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [search, setSearch] = useState<LegSearch | null>(initialSearch);
  const edited = search !== null && search !== initialSearch;
  const shownCriteria = search ? windowSummary(search) : criteria;

  if (editing) {
    return (
      <LegSearchForm
        leg={leg}
        initial={search}
        onSearch={(edited) => {
          setSearch(edited);
          setEditing(false);
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }
  return (
    <Stack gap="sm">
      <Group justify="space-between" wrap="wrap" gap="xs">
        <Stack gap={2}>
          {search && (
            <Text size="sm" fw={600}>
              {edited ? 'New search' : 'Other trains'}:{' '}
              {routeLabel(search.originCrs, null, search.destinationCrs, null)}, {formatDate(search.serviceDate)}
            </Text>
          )}
          {shownCriteria && (
            <Text size="sm" c="dimmed">
              {shownCriteria}
            </Text>
          )}
          {search && (
            <Text size="xs" c="dimmed">
              Saved to this leg when you pick a train.
            </Text>
          )}
        </Stack>
        <Button size="xs" variant="default" onClick={() => setEditing(true)} aria-label={editSearchLabel}>
          Edit search
        </Button>
      </Group>
      <JourneyLegCandidates
        journeyId={journeyId}
        legId={legRef(leg)}
        serviceDate={leg.serviceDate}
        search={search}
        storedFilters={leg.searchFilters ?? null}
        // "Change train" (a train is picked) also lists the trains just
        // before the search, marking the one the leg is on.
        currentUid={leg.trackedTrainState?.trainUid ?? null}
        earlier={leg.trackedTrainState ? EARLIER_TRAINS : 0}
        onEditSearch={() => setEditing(true)}
        onPicked={onPicked}
      />
    </Stack>
  );
}

/** The leg's train page. A pruned train on a shared journey goes through
 * the share link's own page (`/journeys/shared/{token}?train=..&date=..`:
 * the token stays in the path, where the share link already has it, under
 * its `no-referrer` policy; the query holds only the train and day), the one
 * place a viewer with no session can read it; everything else is the public
 * `/train/{uid}/{date}`. */
export function trainPageHref(
  trainUid: string,
  serviceDate: string,
  trainDetail: JourneyLegDetail['trainDetail'],
  shareToken: string | undefined,
): string {
  if (shareToken && trainDetail === 'snapshot') {
    const query = new URLSearchParams({ train: trainUid, date: serviceDate });
    return `/journeys/shared/${encodeURIComponent(shareToken)}?${query.toString()}`;
  }
  return `/train/${encodeURIComponent(trainUid)}/${serviceDate}`;
}
