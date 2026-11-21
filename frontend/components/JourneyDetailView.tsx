import { breakRef, isTriggerLeg, legRef, optionalTemplateRef } from '@/lib/publicId';
import { Alert, Box, Group, Stack, Text, Title } from '@mantine/core';
import { AddJourneyLegButton } from './AddJourneyLegButton';
import { DownloadCalendarButton } from './DownloadCalendarButton';
import { RegularJourneyLine } from './RegularJourneyLine';
import { JourneyLeaveBy } from './JourneyLeaveBy';
import { londonCalendarDay } from '@/lib/londonWallClock';
import { RegularPlanCard } from './RegularPlanCard';
import { showsSuggestion } from '@/lib/regularPlan';
import { regularOccurrenceStarted } from '@/lib/regularJourneys';
import { DeleteJourneyButton } from './DeleteJourneyButton';
import { JourneyLegCard } from './JourneyLegCard';
import { JourneyBreakBanner } from './JourneyBreakBanner';
import { JourneySuggestionsUnmute } from './JourneySuggestionsUnmute';
import { JourneyOperatorFilter } from './JourneyOperatorFilter';
import { EarlierPlans } from './EarlierPlans';
import { MissedOfferProvider } from './MissedOfferContext';
import { JourneyStatusBadge } from './JourneyStatusBadge';
import { LastUpdated } from './LastUpdated';
import { SaveAsTemplateButton } from './SaveAsTemplateButton';
import { ShareJourneyButton } from './ShareJourneyButton';
import { ShareJourneyLinkButton } from './ShareJourneyLinkButton';
import { TrackJourneyAgainButton } from './TrackJourneyAgainButton';
import { MoveJourneyButton } from './MoveJourneyButton';
import { canPlanAgain } from '@/lib/journeyRepeat';
import { instantLateDepartureTimes, LateDepartureNote } from './LateDepartureNote';
import {
  connectionText,
  journeyCanAddLeg,
  journeyFirstLegStart,
  journeyPriorArrival,
  journeyPriorDestination,
  journeyPriorDestinationCrs,
  journeyPriorDestinationName,
} from '@/lib/journeyLegChaining';
import { legDestinationArrivalLabel, legEndpointName } from '@/lib/journeyLegLabel';
import {
  journeyDefaultName,
  journeyDisplayName,
  journeyNameInputFromLegs,
  type JourneyNameInput,
} from '@/lib/journeyName';
import type { JourneyDetail, JourneyLegDetail } from '@/lib/types';
import { delayLabel } from '@/lib/serviceStatus';
import { nextTimetabledNote, retimedArrival } from '@/lib/timetabledLeg';
import { formatTime } from '@/lib/dateFormat';
import { isUntrackedLeg, UNTRACKED_STATUS_LABEL } from '@/lib/untrackedLeg';
import { groupCollapsibleLegs, isInertWalkLeg, journeyCollapsedLabel, shownLegs } from '@/lib/legCollapse';
import { CollapsedLegs } from './CollapsedLegs';

/** The page's name for the journey (2026-09-22 UX review finding M18: never
 * the generic "Tracked journey"), by the one journey-naming rule in
 * `lib/journeyName.ts`: the custom name, else the first leg's origin to the
 * LAST leg's destination and the first leg's date, exactly what the Track
 * list row shows for the same journey. Names are the server-resolved
 * `originName`/`destinationName` the list uses too, so the two never
 * disagree; `legEndpointName` (the calling-point table's own name) only
 * fills in where the server had none. */
export function journeyNameInput(journey: JourneyDetail): JourneyNameInput {
  return journeyNameInputFromLegs(
    journey.customName,
    journey.legs.map((leg) => ({
      ...leg,
      trainUid: leg.trackedTrainState?.trainUid ?? null,
      originName:
        leg.originName ??
        legEndpointName(leg.originCrs, leg.trackedTrainState?.journeyStops, leg.trackedTrainState, 'origin'),
      destinationName:
        leg.destinationName ??
        legEndpointName(leg.destinationCrs, leg.trackedTrainState?.journeyStops, leg.trackedTrainState, 'destination'),
    })),
  );
}

/** One short status phrase per leg, for the multi-leg rollup summary line
 * below (2026-09-22 UX review finding I12/2.6). Deliberately NOT built on
 * `lib/journeyStatus.ts::legStatusGroup` -- that function picks a single
 * WORST-status label per leg for ranking purposes (and, per that module's
 * own doc comment, is the one piece of this fix intentionally left
 * untouched here), where this wants the same plain facts
 * (`JourneyStatusBadge`'s own header badge already reduces the whole
 * journey to its single worst leg) restated per leg instead of collapsed
 * to one. "on time", not "on track" -- aligned with `JourneyTimeline.tsx`/
 * `TrainJourney.tsx`'s own existing per-stop/per-leg delay badges, the
 * same M22/2.11 terminology fix `JourneyStatusBadge.tsx`'s own label map
 * makes. */
function legSummaryPhrase(leg: JourneyLegDetail): string {
  if (isUntrackedLeg(leg)) return UNTRACKED_STATUS_LABEL[leg.untrackedStatus ?? 'planned'].toLowerCase();
  if (leg.trackedTrainState === null) return 'needs a train picked';
  const state = leg.trackedTrainState;
  if (state.status === 'cancelled') return 'cancelled';
  if (state.trackingPhase === 'noTimetable') return 'not in the timetable';
  if (state.trackingPhase === 'planned') return 'planned';
  if (state.status === 'awaiting_activation' || state.status === null) return 'awaiting first report';
  if (state.delayMinutes !== null && state.delayMinutes !== 0) return delayLabel(state.delayMinutes).text;
  return 'on time';
}

/** The slim connector drawn between two consecutive legs (2026-09-22 UX
 * review finding I12/2.6: "the journey is not drawn as a chain"). Reads
 * the DEPARTING leg's own destination row -- never the underlying train's
 * terminus, which may run on past the traveller's own change point --
 * for both the station name and its best-known arrival time. Renders a
 * plain station name with no time when nothing better is known yet (an
 * unmatched or not-yet-reported leg), rather than hiding the connector
 * outright: even without a live buffer computation (explicitly deferred
 * to Phase 3 by the design doc), naming the change point at all is what
 * turns two stacked cards into one journey. */
function LegConnector({ leg, next }: { leg: JourneyLegDetail; next: JourneyLegDetail | null }) {
  const stops = leg.trackedTrainState?.journeyStops;
  // An untracked leg's end is its free-text place, its arrival the planned
  // one (spec 2026-10-20 §2.3).
  const stationName =
    legEndpointName(leg.destinationCrs, stops, leg.trackedTrainState, 'destination') ??
    leg.destinationName ??
    leg.destinationCrs;
  // A timetabled leg the traveller can't make as planned gets in with the
  // timetable's next ride (DS-237).
  const untrackedArrival = isUntrackedLeg(leg) ? (retimedArrival(leg) ?? leg.plannedArrival) : null;
  const arrival = untrackedArrival
    ? `arrive ${formatTime(untrackedArrival)}`
    : legDestinationArrivalLabel(leg.destinationCrs, stops);
  // The gap to the next leg, whatever kind each is, when both times are
  // known: the api's (live times, with the station's minimum change time)
  // when it sent one, else the page's own, which assumes no minimum.
  const gapText = next === null ? null : connectionText(leg, next);
  if (!stationName && !gapText) return null;
  const connector = (
    <Text size="xs" c="dimmed" pl="sm" data-leg-connector>
      <span aria-hidden="true">↓</span> {stationName ? `Change at ${stationName}` : 'Change'}
      {arrival ? `, ${arrival}` : ''}
      {gapText ? `. ${gapText}.` : ''}
    </Text>
  );
  if (!next || !nextLegNotes(next)) return connector;
  return (
    <Stack gap={0}>
      {connector}
      <NextLegNotes next={next} />
    </Stack>
  );
}

/** Whether `NextLegNotes` has anything to say about `next`. */
function nextLegNotes(next: JourneyLegDetail): boolean {
  return Boolean(next.connection?.reliesOnLateDeparture) || nextTimetabledNote(next) !== null;
}

/** What is worth saying about the leg after a connector: the timetable's
 * next ride when the leg can't be made as planned (DS-237), and that the
 * change works only because the next train is running late (DS-141). */
function NextLegNotes({ next }: { next: JourneyLegDetail }) {
  const reliance = next.connection?.reliesOnLateDeparture;
  const retimed = nextTimetabledNote(next);
  return (
    <>
      {retimed && (
        <Text size="xs" c="dimmed" pl="sm" data-next-timetabled>
          {retimed}
        </Text>
      )}
      {reliance && (
        <Box pl="sm">
          <LateDepartureNote {...instantLateDepartureTimes(reliance)} subject="the next train" />
        </Box>
      )}
    </>
  );
}

/** The reusable body of `/journeys/[id]` -- extracted verbatim (2026-09-23
 * unlisted-links plan, Task 5) from `app/journeys/[id]/page.tsx` so a
 * later `/journeys/shared/[token]` page (Task 6, same plan) can render the
 * identical journey detail view for an anonymous share-link viewer, minus
 * the page-specific "Back to journeys" link -- there is
 * nothing for an anonymous viewer to go back to, so that link stays
 * page-specific and is NOT part of this component. Every owner-only
 * control below (`AddJourneyLegButton`, `ShareJourneyButton`,
 * `ShareJourneyLinkButton`, `SaveAsTemplateButton`) stays gated on
 * `journey.isOwner`, same as before this extraction -- a share-link
 * viewer is never the owner, so those simply won't render there.
 *
 * Renders a Fragment, not its own `Stack`, so it stays a transparent set
 * of direct children of whichever `<Stack gap="md">` the caller wraps it
 * in (both current callers use `p="lg" gap="md"`, matching this view's
 * former in-page position exactly) -- the caller's flex `gap` therefore
 * still applies between every one of this view's top-level elements
 * exactly as it did before the extraction. */
export function JourneyDetailView({
  journey,
  fetchedAt,
  origin,
  openBreakOnLoad = false,
  fromPush = false,
  viaShareLink = false,
  calendarDownload = false,
}: {
  journey: JourneyDetail;
  fetchedAt: string;
  origin: string;
  /** Open the open break's suggestions at once (the push deep link). */
  openBreakOnLoad?: boolean;
  /** The page was opened from the break's push notification. */
  fromPush?: boolean;
  /** Opened through a share link, with no session (`/journeys/shared`). */
  viaShareLink?: boolean;
  /** Offer "Download calendar file", this journey as an `.ics` download (the
   * owner's, while the api's calendar feed is on). */
  calendarDownload?: boolean;
}) {
  // Review §2.5/M16: "Add a leg" used to be offered at the same visual
  // weight as the status badge even while the CURRENT leg still needs a
  // train picked -- there is nothing to chain a new leg onto yet, and it
  // competed for attention with the one action that actually matters on
  // this page. Hidden until the last leg is matched. Both helpers now live
  // in `lib/journeyLegChaining.ts`, shared with `JourneyCreationFlow.tsx`'s
  // own inline "Add a leg" during initial creation -- see that module's own
  // doc comment for why this moved out of being private to this page.
  const priorDestinationCrs = journeyPriorDestinationCrs(journey);
  const priorArrival = journeyPriorArrival(journey);
  const priorPlaceName = journeyPriorDestinationName(journey);
  const priorStopId = journeyPriorDestination(journey)?.stopId ?? null;
  const firstLegStart = journeyFirstLegStart(journey);
  const canAddLeg = journeyCanAddLeg(journey);
  const openBreak = journey.openBreak ?? null;
  const sourceTemplate = optionalTemplateRef(journey.sourceTemplatePublicId, journey.sourceTemplateId);
  // Walks and transfers with nothing to act on fold into one row each
  // (DS-590): the journey reads as its trains, and "Leg N of M" counts only
  // the legs shown.
  const groups = groupCollapsibleLegs(journey.legs, (leg) => isInertWalkLeg(leg, openBreak));
  const shown = shownLegs(groups);
  const multiLeg = shown.length > 1;
  const name = journeyNameInput(journey);
  // Mid-journey changes (spec 2026-10-22 §8.2): which leg can be missed,
  // and the open break, for the owner's leg actions.

  // The position "Leg N of M" shows, for naming a leg's buttons; none for a
  // folded leg or a lone one.
  const legPlace = (leg: JourneyLegDetail) => {
    const position = shown.indexOf(leg);
    return multiLeg && position !== -1 ? { position: position + 1, total: shown.length } : null;
  };

  const renderLegCard = (leg: JourneyLegDetail, index: number) => (
    <JourneyLegCard
      place={legPlace(leg)}
      journeyId={journey.publicId}
      leg={leg}
      isOwner={journey.isOwner}
      isOnlyLeg={journey.legs.length === 1}
      neighbours={{ previous: journey.legs[index - 1], next: journey.legs[index + 1] }}
      replan={{
        openBreakId: openBreak ? breakRef(openBreak) : null,
        isBreakTrigger: openBreak !== null && isTriggerLeg(leg, openBreak),
        suggestionsMuted: journey.suggestionsMuted ?? false,
      }}
    />
  );

  return (
    <MissedOfferProvider legs={journey.legs} initialNow={fetchedAt}>
      <Group justify="space-between" align="baseline">
        <Title order={1}>{journeyDisplayName(name)}</Title>
        <Group gap="xs">
          {/* Phase 2's status badge is a pure read -- shown to every viewer,
              owner or shared-group member alike. */}
          <JourneyStatusBadge legs={journey.legs} />
          {/* Both ACTIONS are owner-only. "Share" was already gated by
              Phase 4; "Add leg" is gated here for the same reason -- POST
              /Journeys/{id}/legs answers 404 for a non-owner (see
              `post_journey_leg_a_journey_owned_by_someone_else_is_404_not_403`),
              so offering the button to a shared-group viewer would only
              produce a dead end. Also gated on `canAddLeg` (M16, above). */}
          {journey.isOwner && canAddLeg && (
            <AddJourneyLegButton
              journeyId={journey.publicId}
              priorDestinationCrs={priorDestinationCrs}
              priorStopId={priorStopId}
              priorArrival={priorArrival}
              priorPlaceName={priorPlaceName}
            />
          )}
          {/* Insert before the first leg (spec 2026-10-20 §2.3): a Tube
              ride or walk to the station, added after the trains. */}
          {journey.isOwner && firstLegStart && (
            <AddJourneyLegButton
              journeyId={journey.publicId}
              priorDestinationCrs={null}
              beforeLegId={firstLegStart.legRef}
              nextLegStart={firstLegStart}
              label="Add a leg at the start"
            />
          )}
          {journey.isOwner && <ShareJourneyButton journeyId={journey.publicId} />}
          {journey.isOwner && (
            <ShareJourneyLinkButton journeyId={journey.publicId} shareLink={journey.shareLink} origin={origin} />
          )}
          {journey.isOwner && calendarDownload && <DownloadCalendarButton journeyId={journey.publicId} />}
          {journey.isOwner && <SaveAsTemplateButton journeyId={journey.publicId} />}
          {/* Feature request: "journeys should be mutable ... you should
              be able to ... delete parts or even the whole journey."
              Owner-only, same reasoning as every other action above --
              `DELETE /Journeys/{id}` 404s a non-owner identically to a
              nonexistent journey, so offering this to a shared-group
              viewer (or an anonymous share-link viewer, now that this
              view is shared between both) would only be a dead end.
              Placed last among the owner-only controls, immediately
              before the always-visible `TrackJourneyAgainButton`, so the
              one destructive action on this page sits at the end of the
              owner-only run rather than between two non-destructive
              ones. */}
          {/* Move: the owner's, until the journey starts, for a journey
              whose route can be planned again. */}
          {journey.isOwner && canPlanAgain(journey) && !regularOccurrenceStarted(journey.legs, new Date(fetchedAt)) && (
            <MoveJourneyButton journeyId={journey.publicId} serviceDate={journey.legs[0]?.serviceDate ?? null} />
          )}
          {journey.isOwner && <DeleteJourneyButton journeyId={journey.publicId} />}
          {/* Deliberately NOT gated on journey.isOwner -- see
              docs/superpowers/plans/2026-09-22-reusable-journeys-phaseA-track-again-plan.md's
              Judgment Call 7. Placed last so the owner-only controls
              above stay visually adjacent to each other. */}
          <TrackJourneyAgainButton journey={journey} viaShareLink={viaShareLink} />
        </Group>
      </Group>
      {/* Made from a regular journey: a link to it, and "Skip" while
          this journey hasn't started (regular journeys design §4.4). */}
      {journey.isOwner && sourceTemplate !== null && journey.legs[0] && (
        <RegularJourneyLine
          templateId={sourceTemplate}
          date={journey.legs[0].serviceDate}
          canSkip={!regularOccurrenceStarted(journey.legs, new Date(fetchedAt))}
          afterSkipHref="/journeys"
        />
      )}
      {/* When to leave (regular journeys design §5.4), the owner's only;
          gone once the train it is for has left. "Change" on the day. */}
      {journey.isOwner && journey.leaveBy && (
        <JourneyLeaveBy
          journeyId={journey.publicId}
          leaveBy={journey.leaveBy}
          stationBufferMinutes={journey.stationBufferMinutes}
          delayMinutes={journey.legs.find((leg) => !isUntrackedLeg(leg))?.trackedTrainState?.delayMinutes ?? null}
          canChange={journey.legs[0]?.serviceDate === londonCalendarDay(fetchedAt)}
          initialNow={fetchedAt}
        />
      )}
      {/* Remind mode: the day's train we picked, and the others (regular
          journeys design §6.6). Gone once one is tracked or it has
          started. */}
      {journey.isOwner &&
        showsSuggestion(journey.regularPlan) &&
        journey.legs[0] &&
        !regularOccurrenceStarted(journey.legs, new Date(fetchedAt)) && (
          <RegularPlanCard
            journeyId={journey.publicId}
            serviceDate={journey.legs[0].serviceDate}
            plan={journey.regularPlan}
          />
        )}
      {/* A custom name hides the route and date, so they come back here,
          as on every journey row (`journeyPreviewLine`). The per-leg
          summary below already says how many legs there are. */}
      {name.customName?.trim() && (
        <Text size="sm" c="dimmed">
          {journeyDefaultName(name)}
        </Text>
      )}
      {/* 2026-09-22 UX review finding I12/2.6: the header badge above shows
          only the single WORST leg's status -- `LEG_STATUS_RANK` puts
          `unmatched` above `delayed`, so "Needs a train picked" from one
          leg fully hid a real 22-minute delay on another, matched leg.
          This line restates every leg's own status so a delay is never
          invisible above the fold. Single-leg journeys skip this line --
          the header badge already says the whole story when there's only
          one leg to summarise. */}
      {multiLeg && (
        <Text size="sm" c="dimmed">
          {shown.map((leg, index) => `Leg ${index + 1} ${legSummaryPhrase(leg)}`).join(' · ')}
        </Text>
      )}
      <LastUpdated timestamp={fetchedAt} label="Data as of" />
      {journey.isOwner && journey.suggestionsMuted === true && (
        <JourneySuggestionsUnmute journeyId={journey.publicId} />
      )}
      {journey.isOwner && journey.operatorFilter && (
        <JourneyOperatorFilter journeyId={journey.publicId} filter={journey.operatorFilter} />
      )}
      {/* A share-link visitor gets no break (its cause and the owner's
          alternatives are the owner's), only that the journey has one. */}
      {!openBreak && journey.disrupted && (
        <Alert color="grape" variant="light" role="region" aria-label="Journey disrupted" data-journey-break>
          This journey has been disrupted.
        </Alert>
      )}
      {openBreak && (
        <JourneyBreakBanner
          journeyId={journey.publicId}
          openBreak={openBreak}
          legs={journey.legs}
          isOwner={journey.isOwner}
          suggestionsMuted={journey.suggestionsMuted ?? false}
          initialOpen={openBreakOnLoad}
          fromPush={fromPush}
        />
      )}
      {groups.map((group, groupIndex) => {
        if (group.kind === 'collapsed') {
          const previous = groups[groupIndex - 1];
          const following = groups[groupIndex + 1];
          const before = previous?.kind === 'leg' ? previous.leg : undefined;
          const after = following?.kind === 'leg' ? following.leg : undefined;
          // The change is from the train before to the train after, whatever
          // lies between: the page's own gap, not the api's to the first walk.
          const gap = before && after ? connectionText(before, { ...after, connection: null }) : null;
          return (
            <Stack key={`walks-${legRef(group.legs[0] as JourneyLegDetail)}`} gap={4}>
              <CollapsedLegs
                label={journeyCollapsedLabel(group.legs, { previous: before, next: after })}
                detail={gap ? `${gap}.` : null}
              >
                {group.legs.map((leg, offset) => {
                  const index = group.startIndex + offset;
                  return (
                    <Stack key={legRef(leg)} id={`leg-${legRef(leg)}`} gap={4}>
                      {renderLegCard(leg, index)}
                      {offset < group.legs.length - 1 && (
                        <LegConnector leg={leg} next={journey.legs[index + 1] ?? null} />
                      )}
                    </Stack>
                  );
                })}
              </CollapsedLegs>
              {after && <NextLegNotes next={after} />}
            </Stack>
          );
        }
        const { leg, index } = group;
        const shownPosition = shown.indexOf(leg);
        const next = groups[groupIndex + 1];
        return (
          // 2026-09-22 UX review finding I12/2.6: "the journey is not drawn
          // as a chain" -- two cards with a bare 16px gap and no
          // relationship between them. The "Leg N of M" label (multi-leg
          // journeys only -- a single-leg journey has nothing to number)
          // plus the connector after every leg but the last are what turn a
          // list of unrelated cards into one readable journey.
          // `id="leg-{id}"` (2026-09-22 UX review finding I15/2.3): the
          // scroll target `JourneyStatusBadge`'s own anchor points at when
          // the worst status is `unmatched` -- see that component's doc
          // comment.
          <Stack key={legRef(leg)} id={`leg-${legRef(leg)}`} gap={4}>
            {multiLeg && (
              <Text size="xs" fw={700} c="dimmed" tt="uppercase">
                Leg {shownPosition + 1} of {shown.length}
              </Text>
            )}
            {renderLegCard(leg, index)}
            {next?.kind === 'leg' && <LegConnector leg={leg} next={next.leg} />}
          </Stack>
        );
      })}
      {journey.isOwner && <EarlierPlans journeyId={journey.publicId} revisionCount={journey.revisionCount} />}
    </MissedOfferProvider>
  );
}
