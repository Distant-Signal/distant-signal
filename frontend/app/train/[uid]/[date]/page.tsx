import { Stack, Title, Text, Group } from '@mantine/core';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getTrainByUidAndDateForViewer, getMyTrackedTrains, getPreviewTrain, ApiNotFoundError } from '@/lib/api';
import { ShareButton } from '@/components/ShareButton';
import { TrainOperator } from '@/components/TrainOperator';
import { TrainJourneyPanel } from '@/components/TrainJourneyPanel';
import { TrainJourney } from '@/components/TrainJourney';
import { TrackThisTrainButton } from '@/components/TrackThisTrainButton';
import { TrackedTrainOwnerControls } from '@/components/TrackedTrainOwnerControls';
import { TextLink } from '@/components/TextLink';
import { LastUpdated } from '@/components/LastUpdated';
import { REFRESH_INTERVAL_MS } from '@/lib/refresh';
import { TIMES_IN_UK_LOCAL_TIME } from '@/lib/dateFormat';
import { isTimetableOnly, serviceModeLabel } from '@/lib/serviceMode';
import { ServiceModeIcon } from '@/components/ServiceModeIcon';
import { ProvisionalTimetableNote } from '@/components/ProvisionalTimetableNote';
import {
  TimetableStopsNote,
  timetableStopsNoteKind,
  type TimetableStopsNoteFields,
} from '@/components/TimetableStopsNote';
import type { PublicTrainState, TrainJourneyState, TrackedTrainListItem } from '@/lib/types';
import { pageMetadata, previewImageAlt } from '@/lib/pageMetadata';
import { serviceDateLabel, trainPreviewCard, trainPreviewImage } from '@/lib/trainPreview';
import { trainIdentifiers, trainName } from '@/lib/trainName';
import { DataCredits, TRAIN_CREDITS } from '@/components/DataCredits';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// Never prerendered or stored: what this page shows depends on who is
// looking. The api answers a pruned train only to a viewer who may read a
// journey leg that kept it (DS-638), and that answer must not reach anyone
// else through Next's full-route or data cache, a CDN or a browser. `cookies()`
// below already makes the render dynamic; this keeps it so, and Next then
// sends `private, no-cache, no-store, max-age=0, must-revalidate`.
export const dynamic = 'force-dynamic';

/** The meta description of a train held only as a journey leg's private
 * copy: nothing about the train itself. */
export const PRIVATE_TRAIN_DESCRIPTION = 'A train from a journey.';

/** Adapts the PUBLIC, shared-train response into the subset
 * `TrainJourney` renders.
 *
 * Every field here comes from the shared `trains`/`train_current_state`
 * rows. Nothing per-subscriber exists to map: `customName` is always
 * `null` from this function alone (a custom name belongs to one
 * subscriber, and this function only ever sees the shared, subscriber-less
 * response) -- callers that DO know the current visitor's own subscription
 * (this page's own tracking-overlay branch, once it has a `GET /Train/mine`
 * match) overlay their own `customName` back on top of this result rather
 * than calling this function differently. There is deliberately no `id` in
 * the result type at all -- `PublicTrainState.trainsId` is a `trains.id`, NOT a
 * `train_subscriptions.id`, and this page previously fed it straight into
 * `RenameTrainButton`/`DeleteTrainButton` as a `trackingId`.
 * Both are `BIGSERIAL` starting at 1, so a logged-in visitor could rename
 * or delete an unrelated subscription of their own that happened to share
 * the number.
 *
 * `resolutionStatus` is DERIVED, because the shared row has no such column
 * -- `resolution_status` is per-subscription state. `trains.train_id`
 * (TRUST's own daily identifier) is only ever written by a live-TRUST or
 * backlog resolution, and `origin_crs` only by a schedule match, so the
 * two together give the same three-way distinction `TrainJourney` renders.
 * `'unresolved'` is deliberately unreachable here: that status records a
 * subscriber's pin having been given up on, which is meaningless for a
 * shared train. */
export function toJourneyState(train: PublicTrainState): TrainJourneyState {
  return {
    serviceDate: train.serviceDate,
    pinOriginCrs: train.originCrs,
    pinOriginName: train.originName,
    pinDestinationCrs: train.destinationCrs,
    pinDestinationName: train.destinationName,
    pinScheduledDeparture: train.scheduledDeparture,
    // `GET /Train/by-uid` is GB-only.
    irishTrain: null,
    // A snapshot is a pruned train a journey leg still holds a copy of, so
    // it is a resolved one whatever its (possibly absent) live id says.
    resolutionStatus:
      train.trainDetail === 'snapshot' || train.trainId ? 'resolved' : train.originCrs ? 'schedule_matched' : 'pending',
    trainUid: train.trainUid,
    trainId: train.trainId,
    scheduleDestinationCrs: train.destinationCrs,
    scheduleDestinationName: train.destinationName,
    scheduleCallingPoints: train.callingPoints,
    status: train.status,
    lastReportedLocation: train.lastReportedLocation,
    lastEventType: train.lastEventType,
    delayMinutes: train.delayMinutes,
    nextCallingPoint: train.nextCallingPoint,
    etaNext: train.etaNext,
    etaSource: train.etaSource,
    customName: null,
    journeyStops: train.journeyStops,
    mayHaveArrived: train.mayHaveArrived,
    predictedStart: train.predictedStart,
    serviceMode: train.serviceMode,
    liveTracking: train.liveTracking,
    // Planned / not in the timetable (spec 2026-10-20 §3, §4), computed by
    // the api for the shared train the same way as for a tracked one.
    trackingPhase: train.trackingPhase,
    firstReportExpectedAt: train.firstReportExpectedAt,
    // What is cancelled and why (DS-181), with the older reason fields for
    // a backend that predates it (`lib/cancellation.ts`).
    cancelled: train.cancelled,
    cancelReasonCode: train.cancelReasonCode,
    cancelReason: train.cancelReason,
    changeOfOriginReasonCode: train.changeOfOriginReasonCode,
    changeOfOriginReason: train.changeOfOriginReason,
    cancellation: train.cancellation,
    delayBasis: train.delayBasis,
    delayProvisional: train.delayProvisional,
    operatorCode: train.operatorCode,
    operatorName: train.operatorName,
  };
}

/** "Train" for a train (or an older backend), else the mode's own label:
 * "Rail replacement bus", "Bus service", "Ferry". */
/** "08:42 Woking to London Waterloo" for the public train page and its
 * title, or null without both ends of the route. */
export function publicTrainName(
  train: Pick<
    PublicTrainState,
    'scheduledDeparture' | 'originName' | 'originCrs' | 'destinationName' | 'destinationCrs'
  >,
): string | null {
  return trainName({
    departure: train.scheduledDeparture,
    origin: train.originName ?? train.originCrs,
    destination: train.destinationName ?? train.destinationCrs,
  });
}

export function serviceHeading(train: Pick<PublicTrainState, 'serviceMode'>): string {
  return serviceModeLabel(train.serviceMode) ?? 'Train';
}

/** The button's noun for a service. */
function trackNoun(train: Pick<PublicTrainState, 'serviceMode'>): 'train' | 'bus' | 'ferry' {
  if (train.serviceMode === 'ferry') return 'ferry';
  if (train.serviceMode === 'bus' || train.serviceMode === 'replacementBus') return 'bus';
  return 'train';
}

/** The page's meta description: evergreen, since the live part of a shared
 * link's preview is its card image (`card.png`, docs/style-guide.md "Live
 * link previews"). A chat app shows the unfurl for hours, so a delay or a
 * "last reported" location here would go stale while the card's band moves
 * on. Says what the page has: "13:42 Woking to London Waterloo, Sat 1 Nov:
 * calling points, platforms and live running." A bus or ferry, never
 * tracked live, has its timetable only; a live train with no stops yet
 * (`TimetableStopsNote`) has its live running only. */
export function trainPageDescription(
  title: string,
  train: Pick<PublicTrainState, 'serviceDate'> & TimetableStopsNoteFields,
): string {
  const what = isTimetableOnly(train)
    ? 'calling points and timetabled times'
    : timetableStopsNoteKind(train) === 'noStops'
      ? 'live running'
      : 'calling points, platforms and live running';
  return `${title}, ${serviceDateLabel(train.serviceDate)}: ${what}.`;
}

/** Per-page Open Graph/Twitter/`<title>` metadata for a shared train link: this is one of the four pages
 * `ShareButton` renders on. Fetches the same `getPublicTrainByUidAndDate(uid, date)` call the page
 * component makes; Next.js's fetch request memoization dedupes the two into a single network call per
 * request (every `lib/api.ts` fetcher goes through the real `fetch()`, so memoization applies despite
 * their `cache: 'no-store'`; see https://nextjs.org/docs/app/api-reference/functions/fetch), so no extra
 * `cache()` wrapper is needed.
 *
 * Mirrors the page component's `notFound()`-on-`ApiNotFoundError` handling: `generateMetadata` runs
 * before and independently of the page component, so it needs its own try/catch (Next.js supports
 * calling `notFound()` from within it). The malformed-date check mirrors the page's pre-fetch validation
 * for the same reason (no network call for a URL segment that can never resolve). */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ uid: string; date: string }>;
}): Promise<Metadata> {
  const { uid, date } = await params;

  if (!DATE_PATTERN.test(date)) {
    notFound();
  }

  let train: PublicTrainState;
  try {
    train = await getTrainByUidAndDateForViewer(uid, date);
  } catch (err) {
    if (err instanceof ApiNotFoundError) {
      notFound();
    }
    throw err;
  }

  // A pruned train is only here because this viewer may read a journey leg
  // that kept it. Nothing of that private copy goes into the title,
  // description or a preview image: generic text, no card, never indexed.
  if (train.trainDetail === 'snapshot') {
    return pageMetadata(`${serviceHeading(train)} ${uid}`, PRIVATE_TRAIN_DESCRIPTION, { capability: true });
  }

  const title = publicTrainName(train) ?? `${serviceHeading(train)} ${uid}`;
  const description = trainPageDescription(title, train);

  // One train on one day: worth following, not worth indexing. Its preview
  // image is its own (`card.png`), its URL versioned by what the card
  // shows. Read through the image route's own shared, minute-cached entry
  // (`getPreviewTrain`), so the version and the image come from the same
  // data; an outage leaves the URL unversioned rather than failing the
  // page's metadata.
  const preview = await getPreviewTrain(uid, date).catch(() => null);
  const card = preview === null ? null : trainPreviewCard(preview, Date.now());
  return pageMetadata(title, description, {
    noindex: true,
    image: trainPreviewImage(uid, date, card, previewImageAlt(title)),
  });
}

/** `/train/[uid]/[date]` -- the PUBLIC page for a real-world train,
 * readable by anyone (the backing route dropped its `AuthenticatedUser`
 * extractor and its ownership check as part of the shared-train-identity
 * change).
 *
 * `PublicTrainState` itself carries no owner actions: Rename/Delete/tickets
 * all operate on a `train_subscriptions.id`, which that response doesn't
 * carry. This page now closes that gap itself rather than leaving it to
 * `/train/by-id/[trackingId]`: alongside the public fetch, it also asks
 * `getMyTrackedTrains()` whether the current visitor already tracks this
 * exact `(trainUid, serviceDate)` pair, and if so overlays the same owner
 * controls the by-id page renders (`TrackedTrainOwnerControls`) in place
 * of the generic `TrackThisTrainButton`. An
 * anonymous visitor, or a logged-in one tracking some other train, sees
 * exactly today's read-only view -- see the "tracking overlay" describe
 * block in this file's test for the full case split.
 *
 * Deliberately does NOT also fetch `getTrackedTrainById(match.id)` for a
 * `TrackedTrainState` once a match is found -- an earlier version of this
 * page did, purely to get fields already present on `match` itself
 * (`TrackedTrainListItem`, from `getMyTrackedTrains()`): `id`, `customName`,
 * and the `pin*`/`serviceDate` fields `TrackedTrainOwnerControls` needs.
 * Dropping that redundant fetch also removes the race window it opened (the
 * subscription existing when the list was read but being deleted before a
 * follow-up detail fetch landed) -- there is no second fetch left to race
 * on. The one field `TrackedTrainListItem` genuinely lacks that
 * `TrainJourney` wants -- live movement data (`trainId`,
 * `lastReportedLocation`, `scheduleCallingPoints`, `journeyStops`, ...) --
 * is already fully covered by `train`, the public fetch this page makes
 * unconditionally anyway; see `journeyState` below.
 *
 * There is likewise no `401` branch: the route is public, so
 * `ApiUnauthorizedError` is not a reachable outcome from
 * `getPublicTrainByUidAndDate` itself. The branch that used to be here (a
 * "log in to view this tracked train" prompt) was dead code after that
 * change. */
export default async function TrackedTrainByUidPage({ params }: { params: Promise<{ uid: string; date: string }> }) {
  const { uid, date } = await params;
  return renderTrainPage(uid, date, null);
}

/** The page's body, shared with the share-link page
 * (`app/journeys/shared/[token]`, `?train=..&date=..`), which passes the
 * journey's share token so a pruned train on that journey can be read
 * without a session. `null` here. */
export async function renderTrainPage(uid: string, date: string, shareToken: string | null) {
  // Validated before the fetch fires: a malformed URL segment 404s directly, as on the by-id page
  // (docs/superpowers/specs/2026-08-29-train-tracking-frontend-design.md, Error handling section).
  if (!DATE_PATTERN.test(date)) {
    notFound();
  }

  let train: PublicTrainState;
  let myTrackedTrains: TrackedTrainListItem[] | null;
  try {
    // Concurrent, not sequential: `getMyTrackedTrains()` has no data
    // dependency on the public fetch, and every visitor pays for both
    // (not just the rare tracking owner) -- running them one after another
    // would add serial latency to this page for everyone.
    //
    // `getMyTrackedTrains().catch(() => null)`: this is an auxiliary "am I
    // tracking this?" check, not this page's primary content -- same
    // fail-closed posture `app/page.tsx` already takes for its own
    // `getMyTrackedTrains()` call. A transient failure of it (network
    // blip, a non-401 backend error) must degrade to the plain public
    // view for every visitor, not take down this whole page.
    //
    // Also worth noting: there is no lighter, single-item "do I track
    // (uid, date)?" endpoint today, so this fetches the visitor's ENTIRE
    // tracked list just to test membership of one pair -- accepted for
    // now (a dedicated endpoint would be a backend change, out of scope
    // for this pass); revisit if this membership check becomes a real
    // cost.
    [train, myTrackedTrains] = await Promise.all([
      getTrainByUidAndDateForViewer(uid, date, shareToken),
      getMyTrackedTrains().catch(() => null),
    ]);
  } catch (err) {
    if (err instanceof ApiNotFoundError) {
      notFound();
    }
    throw err;
  }

  // Both fetches above are `cache: 'no-store'` (`lib/api.ts`), and this
  // page re-renders from scratch on every `AutoRefresh` cycle (`router.
  // refresh()`, `components/AutoRefresh.tsx`) -- so "now, at render time"
  // IS "when this data was last fetched", the same reasoning
  // `ServiceWorkerRegister`'s `loadedAt` and `RootLayout`'s
  // `ConnectivityMonitor observedAt` props already document for their own
  // fresh-per-render ISO timestamps. There is no separate "fetched at"
  // field on `PublicTrainState` to read instead.
  const renderedAt = new Date().toISOString();

  // `myTrackedTrains` is `null` for an anonymous visitor, or when the
  // fetch above failed and was caught -- `myTrackedTrains?.find(...)`
  // below covers "not logged in", "logged in, nothing matches", and "the
  // check itself failed" identically; all three fall through to the plain
  // public render below.
  const match = myTrackedTrains?.find((item) => item.trainUid === uid && item.serviceDate === date) ?? null;

  // `toJourneyState(train)` alone always has `customName: null` (see its
  // own doc comment) -- overlay the visitor's own custom name from `match`
  // once they're the owner. Deliberately not `match` on its own as the
  // whole journey state: `TrackedTrainListItem` has no live-movement
  // fields (`trainId`, `lastReportedLocation`, `scheduleCallingPoints`,
  // `journeyStops`, ...) that `TrainJourney` needs, while `train` (the
  // public fetch above) already has them in full.
  const snapshot = train.trainDetail === 'snapshot';
  const journeyState: TrainJourneyState = match
    ? { ...toJourneyState(train), customName: match.customName }
    : toJourneyState(train);

  return (
    <Stack p="lg" gap="md">
      <Group justify="space-between">
        <Group gap="xs" wrap="nowrap">
          {train.serviceMode !== 'train' && <ServiceModeIcon mode={train.serviceMode} size={28} />}
          <Stack gap={2}>
            <Title order={1}>{publicTrainName(train) ?? `${serviceHeading(train)} ${uid}`}</Title>
            <Text size="sm" c="dimmed">
              {[
                train.serviceMode !== 'train' ? serviceHeading(train) : null,
                trainIdentifiers({ headcode: train.headcode, uid }),
              ]
                .filter((part): part is string => part !== null)
                .join(' · ')}
            </Text>
            <TrainOperator name={train.operatorName} code={train.operatorCode} />
          </Stack>
        </Group>
        <Group gap="sm">
          {match ? (
            // `afterDelete="refresh"` -- unlike `/train/by-id/[trackingId]`
            // (`TrackedTrainOwnerControls`'s default `'redirect'` caller),
            // THIS page's URL (the train's real `(uid, date)` identity)
            // stays perfectly valid once the tracking subscription is
            // deleted: it should stay put and re-run this Server
            // Component's own `getMyTrackedTrains()` fetch, which will no
            // longer include this row, flipping `match` back to `null` and
            // swapping this branch for `TrackThisTrainButton` below -- see
            // `DeleteTrainButton`'s own doc comment for why this is a plain
            // prop rather than an `onDeleted` callback.
            <TrackedTrainOwnerControls train={match} afterDelete="refresh" />
          ) : snapshot ? null : (
            // Shown to EVERY visitor, logged in or not -- the shared
            // "show the control to everyone, prompt on the real 401"
            // posture `PinToggle`/`TrackTrainForm` already establish via
            // useNeedsLogin/LoginPromptModal.
            <TrackThisTrainButton uid={uid} date={date} noun={trackNoun(train)} variant="light" />
          )}
          {/* Independent of ownership -- shown regardless of which branch
              above rendered. */}
          {/* A pruned train's page answers only the viewer who may read the
              journey that kept it, so a copied link would be a 404 for
              anyone else, and on a share-link route it would carry the
              journey's token. */}
          {!snapshot && !shareToken && <ShareButton />}
        </Group>
      </Group>
      {/* `TrainJourneyPanel` bundles `TrainJourney` with its Real Time
          Trains cross-reference link (a well-known third-party UK train
          tracker with more granular signalling-level detail than this app
          shows) -- both are driven by the same `journeyState` and gated
          identically on `trainUid` being known. Shared with
          `app/train/by-id/[trackingId]` so the two pages can't drift on
          this pairing again -- see that component's own doc comment.
          `suppressTrainUidHeading`: this page's own `<h1>` above already
          reads "Train {uid}" -- see `TrainJourney.tsx`'s own doc comment
          on that prop. `by-id`'s own `<h1>` reads "Tracking
          Train {trackingId}" instead (a different identifier), so it
          omits this prop and keeps its own "Train {trainUid}" line. */}
      {/* Far-ahead service dates only (`provisional`, see
          `ProvisionalTimetableNote`): late timetable changes may still land. */}
      {snapshot ? (
        // A pruned train, from a journey leg's own copy (DS-638): its
        // booked timetable and recorded outcome, with the same note the
        // journey legs carry. No live board, estimates, reasons or
        // operator exist to show, and nothing here refreshes.
        <TrainJourney state={journeyState} trainDetail="snapshot" suppressTrainUidHeading />
      ) : (
        <>
          <ProvisionalTimetableNote provisional={train.provisional} />
          {/* A live train with no stops (added at short notice): says why only
              its position and delay show. */}
          <TimetableStopsNote train={train} />
          <TrainJourneyPanel state={journeyState} suppressTrainUidHeading />
          <Group gap={4}>
            <LastUpdated timestamp={renderedAt} />
            <Text size="xs" c="dimmed">
              · refreshes every {REFRESH_INTERVAL_MS / 1000}s · {TIMES_IN_UK_LOCAL_TIME}
            </Text>
          </Group>
        </>
      )}
      {/* `inline`/`underline="always"`: this link sits mid-sentence in
          body text rather than in a nav or beside a heading, so (a) colour
          alone can't be what marks it (WCAG 1.4.1) and (b) it must render as
          a `<span>`, not `TextLink`'s default `<p>`, or the rest of the
          sentence gets forced onto its own line. See `TextLink`'s own doc
          comment. The way back to the timetable, the Trains section, is the
          page's next step; tracking is the secondary action above. */}
      <Text size="sm" c="dimmed">
        {match
          ? "You're already tracking this service. "
          : snapshot
            ? ''
            : isTimetableOnly(train)
              ? 'This is the public view of this service. Track it above to keep its scheduled times in your list (there are no live alerts for buses and ferries). '
              : 'This is the public view of this service. Track it above to get updates. '}
        <TextLink href="/trains" inline underline="always">
          Look up another train
        </TextLink>
        .
      </Text>
      <DataCredits credits={TRAIN_CREDITS} />
    </Stack>
  );
}
