import { Alert, Stack, Text, Title } from '@mantine/core';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getJourney, getJourneyByShareToken, ApiNotFoundError, ApiUnauthorizedError } from '@/lib/api';
import { JourneyDetailView } from '@/components/JourneyDetailView';
import { FollowJourneyButton } from '@/components/FollowJourneyButton';
import { getSiteOrigin } from '@/lib/siteOrigin';
import { createLogger } from '@/lib/logger';
import { formatDate } from '@/lib/dateFormat';
import { journeyDefaultName, journeyNameInputFromLegs } from '@/lib/journeyName';
import { journeyDetailSummary, type JourneySummaryGroup } from '@/lib/journeyStatus';
import type { JourneyDetail, JourneyLegDetail } from '@/lib/types';
import { NOINDEX_NOFOLLOW, pageMetadata, previewImageAlt } from '@/lib/pageMetadata';
import {
  sharedJourneyPreviewCard,
  sharedJourneyPreviewImage,
  sharedJourneySummary,
  sharedJourneySummarySentences,
} from '@/lib/sharedJourneyPreview';
import { DataCredits, journeyCredits } from '@/components/DataCredits';
import { renderTrainPage, PRIVATE_TRAIN_DESCRIPTION } from '@/app/train/[uid]/[date]/page';

export const revalidate = 0;
// What this page shows depends on the viewer (the train view below is read
// with the share token or a session), so it is never stored or shared.
export const dynamic = 'force-dynamic';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TRAIN_UID_PATTERN = /^[A-Za-z0-9]{1,16}$/;

/** `?train={uid}&date={date}`: a leg's train, read through this share link
 * (DS-638). Only the train and day are in the query; the token stays in the
 * path. `null` for anything else, which is the journey page as before. */
function sharedTrainFrom(searchParams: Record<string, string | string[] | undefined>) {
  const { train, date } = searchParams;
  return typeof train === 'string' &&
    typeof date === 'string' &&
    TRAIN_UID_PATTERN.test(train) &&
    DATE_PATTERN.test(date)
    ? { uid: train, date }
    : null;
}

const log = createLogger('app/journeys/shared/[token]');

/** `/journeys/shared/{token}` -- the unlisted-share-link landing page
 * (2026-09-23 unlisted-links plan, Task 6): resolves an unlisted share
 * token to a `JourneyDetail` via `getJourneyByShareToken` (Task 3, genuinely
 * unauthenticated -- no cookie required) and renders it read-only through
 * `JourneyDetailView` (Task 5). Follows the exact shape
 * `app/groups/join/[token]/page.tsx` already uses for its own token
 * resolution: an invalid/expired/revoked token gets its own explanatory
 * "Link not found" copy, never a bare `notFound()` -- the same reasoning
 * that page's own doc comment gives (`notFound()` 404s the WHOLE route,
 * which would prevent this friendly render from ever showing for a real
 * visitor).
 *
 * `journey.isOwner` on the object `getJourneyByShareToken` returns is always
 * `false` server-side (Task 2's own guarantee) -- `JourneyDetailView`
 * already hides every owner-only affordance
 * (`AddJourneyLegButton`/`ShareJourneyButton`/`ShareJourneyLinkButton`/
 * `SaveAsTemplateButton`, `JourneyLegCard`'s "Change train"/candidate
 * picker) on that flag alone, so this page adds no second, hand-written
 * gate on top of it -- its only job is resolving the token, deciding
 * redirect-vs-render, and rendering. */
/** A real share token is `crate::auth::generate_session_token()`'s own
 * shape -- 32 random bytes, base64url (`URL_SAFE_NO_PAD`) encoded -- the
 * same generator every other opaque token in this app uses (session ids,
 * group ids, invite-link tokens). Checked BEFORE `token` ever reaches
 * `getJourneyByShareToken`/`getJourney` below, which build their target URL
 * by interpolating it unencoded (`lib/api.ts`) -- a malformed value could
 * otherwise redirect that fetch somewhere this route never intended.
 * Treated exactly like an unknown/expired/revoked token (the same friendly
 * "Link not found" copy below, not a bare `notFound()`) rather than as a
 * distinct case -- from a visitor's perspective a malformed token and one
 * that just doesn't resolve are the same fact: this link doesn't work. */
function isValidShareToken(token: string): boolean {
  return /^[A-Za-z0-9_-]+$/.test(token);
}

/** Coarse, non-numeric phrasing for a journey's worst-leg status, built on
 * `lib/journeyStatus.ts::journeyDetailSummary` -- the same whole-journey
 * summary `JourneyStatusBadge` already renders on-page as
 * its single header badge. This page's preview card
 * (`card.png`, `lib/sharedJourneyPreview.ts`) shows only the timetable side
 * of the journey, never a live status, so its description is the only
 * status a pasted link's unfurl can show; a train
 * page (`app/train/[uid]/[date]/page.tsx`) has one, so its description is
 * evergreen (`trainPageDescription`) and its card image quotes the exact
 * delay and where the train is. That page is fully public (no token gates
 * it), so its card reveals nothing a URL-guesser couldn't already get. A
 * journey share link is different --
 * its whole security model is a bearer token (2026-09-23 unlisted-links
 * design §3/§5), and a pasted link's unfurled preview card is seen by
 * EVERYONE who can see that chat message, not only the person the owner
 * actually chose to share the link with. A live delay figure or a
 * signalling-level "last reported at X" is a materially bigger, more
 * precisely time-stamped disclosure to that wider, passive audience than
 * the coarse "delayed"/"on time"/"cancelled" rollup this app already
 * treats as the public-facing summary of a journey's status elsewhere.
 * Someone who actually opens the link with the token still sees the full
 * detail (`JourneyLegCard`'s own per-leg delay/location, `JourneyStatusBadge`
 * itself) exactly as before -- this function only governs what a passer-by
 * sees without clicking anything. */
function journeyStatusPhrase(legs: JourneyLegDetail[]): string {
  const summary = journeyDetailSummary(legs);
  if (summary === null) return 'has no legs yet';
  const PHRASE: Record<JourneySummaryGroup, string> = {
    // A journey of untracked legs only (spec 2026-10-20 §2.3).
    untrackedDone: 'done',
    untrackedPlanned: 'planned',
    untrackedInProgress: 'in progress',
    good: 'on time',
    noRecord: 'with no live record kept',
    planned: 'planned',
    awaiting: 'awaiting its first movement report',
    noTimetable: 'not matched to a timetable',
    unmatched: 'still needs a train picked',
    delayed: 'running delayed',
    skipped: 'not stopping at one of its own stations',
    severe: 'cancelled',
    partCancelled: 'part cancelled',
    connectionAtRisk: 'at risk of missing a connection',
    connectionMissed: 'missing a connection',
  };
  return PHRASE[summary.group];
}

/** What a link that doesn't resolve says to a crawler: nothing of its own
 * (the root layout's site-wide cards), and not to be indexed. */
const NO_LINK_METADATA: Metadata = { robots: NOINDEX_NOFOLLOW };

/** Per-page Open Graph/Twitter/`<title>` metadata for a journey's unlisted
 * share link -- so pasting one into Discord/Slack/iMessage/etc. shows a
 * journey-specific preview rather than generic site metadata. Fetches the
 * same unauthenticated `getJourneyByShareToken(token)` call the page
 * component itself makes below; Next's fetch request memoization dedupes
 * the two into one network call per request (see the more detailed
 * comment on `app/train/[uid]/[date]/page.tsx`'s own `generateMetadata`;
 * the reasoning is identical here). The unauthenticated call is
 * deliberate, same as the page component's own: link-unfurler bots never
 * carry a session cookie, so this is the only way they ever see a real
 * preview instead of a fallback.
 *
 * Falls back to the site-wide metadata plus `noindex` (`NO_LINK_METADATA`) on
 * `ApiNotFoundError` -- the same error the page component's own "link not
 * found" branch below handles -- **not** `notFound()`, for the exact
 * reason `app/groups/join/[token]/page.tsx`'s own `generateMetadata` gives
 * for the identical choice: calling `notFound()` here would 404 the WHOLE
 * route, not just the metadata, pre-empting the page component's own
 * friendly "link not found" render for every real visitor of an
 * expired/revoked link, not only unfurler bots. Same malformed-token
 * short-circuit as the page component's own `isValidShareToken` check,
 * for the same reason that page's doc comment gives.
 *
 * Never includes the journey's own numeric `id`, nor puts the token in a title, description or `og:url`: it is the
 * bearer secret, and text a search index or a chat quotes is the wrong
 * place for it. The one exception is the preview image's own URL
 * (`/journeys/shared/{token}/card.png`), which a chat app can only fetch
 * with the token in its path; whoever's crawler reads this page was already
 * given that same token in the link, and the page is `noindex`
 * (`NOINDEX_NOFOLLOW`; robots.txt keeps indexing crawlers off `/journeys/`
 * altogether, `lib/robots.ts` lets link-preview fetchers in). Nor does it include the
 * journey's own `customName` (an owner-chosen free-text label, unlike a
 * group's `groupName` in `groups/join`'s own equivalent function) -- title
 * and description are built from the route and a coarse status only, the
 * same default name (`journeyDefaultName`, `lib/journeyName.ts`) every
 * journey surface falls back to for a journey with no custom name, kept
 * unconditional here rather than conditional on one being set. `JourneyDetail` carries no owner name/id at all to leak
 * in the first place (`journey_readable_by`'s own read-only, ownership-
 * blind contract). */
export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: SearchParams;
}): Promise<Metadata> {
  const { token } = await params;

  // A leg's train, which may be only a journey leg's private copy: generic
  // text, no fetch, no card, never indexed.
  const sharedTrain = sharedTrainFrom(await searchParams);
  if (sharedTrain) {
    return pageMetadata(`Train ${sharedTrain.uid}`, PRIVATE_TRAIN_DESCRIPTION, { capability: true });
  }

  if (!isValidShareToken(token)) {
    return NO_LINK_METADATA;
  }

  let journey: JourneyDetail;
  try {
    journey = await getJourneyByShareToken(token);
  } catch (err) {
    if (err instanceof ApiNotFoundError) {
      return NO_LINK_METADATA;
    }
    throw err;
  }

  const firstLeg = journey.legs[0];
  const lastLeg = journey.legs.at(-1);
  // The one journey-naming rule's DEFAULT name (`lib/journeyName.ts`), with
  // the custom name deliberately left out (see above): the same route and
  // date the owner's own Track list shows when no custom name is set.
  const hasRoute =
    !!(firstLeg?.originCrs || firstLeg?.originName) && !!(lastLeg?.destinationCrs || lastLeg?.destinationName);
  const title = hasRoute ? journeyDefaultName(journeyNameInputFromLegs(null, journey.legs)) : 'Shared journey';
  const summary = sharedJourneySummary(journey.legs);
  const description =
    firstLeg && summary
      ? `A journey on ${formatDate(firstLeg.serviceDate)}, ${journeyStatusPhrase(journey.legs)}. ${sharedJourneySummarySentences(summary)}`
      : 'A shared journey on Distant Signal.';

  // The card (`card.png`, `lib/sharedJourneyPreview.ts`) is the timetable
  // side of the same summary; a journey with no legs keeps the site image.
  const card = sharedJourneyPreviewCard(journey.legs);
  return pageMetadata(title, description, {
    capability: true,
    ...(card ? { image: sharedJourneyPreviewImage(token, card, previewImageAlt(title)) } : {}),
  });
}

export default async function SharedJourneyPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: SearchParams;
}) {
  const { token } = await params;

  // A leg's train, read through this link: the train page's own body with
  // the share token, so a pruned train can show without a session.
  const sharedTrain = sharedTrainFrom(await searchParams);
  if (sharedTrain && isValidShareToken(token)) {
    return renderTrainPage(sharedTrain.uid, sharedTrain.date, token);
  }

  if (!isValidShareToken(token)) {
    return (
      <Stack p="lg" gap="md">
        <Title order={1}>Link not found</Title>
        <Alert color="red">This share link is invalid or has been revoked. Ask whoever shared it for a new one.</Alert>
      </Stack>
    );
  }

  let journey;
  try {
    journey = await getJourneyByShareToken(token);
  } catch (err) {
    if (err instanceof ApiNotFoundError) {
      return (
        <Stack p="lg" gap="md">
          <Title order={1}>Link not found</Title>
          <Alert color="red">
            This share link is invalid or has been revoked. Ask whoever shared it for a new one.
          </Alert>
        </Stack>
      );
    }
    throw err;
  }

  // Already-authorized probe -- exact same shape as
  // `app/groups/join/[token]/page.tsx`'s own "alreadyMember" check: try the
  // normal, cookie-forwarding fetch this viewer would use on any other route
  // into the journey. Success means they're the owner or a member of a
  // group it's shared to (`journey_readable_by`, unchanged) -- send them to
  // the real page, never a second, degraded rendering of the same data.
  // A logged-in visitor who can't open it otherwise (the probe's 404) can
  // follow it with the link's token (DS-146), and is then sent to the real
  // page; a logged-out one (401) is not offered it.
  //
  // Any other probe failure (a 5xx, a timeout, a 403) is treated as "not a
  // member" too, with no follow offer since it says nothing of a login: the
  // token already resolved, so a transient api error on this second call
  // still shows the shared journey rather than the error page.
  let loggedIn = false;
  let readable = false;
  try {
    await getJourney(journey.publicId);
    readable = true;
  } catch (err) {
    if (!(err instanceof ApiNotFoundError) && !(err instanceof ApiUnauthorizedError)) {
      log.warn('shared journey membership probe failed; showing the shared view', { error: err });
    }
    loggedIn = err instanceof ApiNotFoundError;
    // Falls through: this viewer is relying on the token itself, either
    // because they aren't logged in at all (`ApiUnauthorizedError`) or
    // because they're logged in but neither own this journey nor belong to
    // a group it's shared to (`ApiNotFoundError`) -- `journey_readable_by`'s
    // own two negative outcomes, indistinguishable by design (see that
    // function's doc comment), and indistinguishable here for the same
    // reason: the token is what's carrying their access regardless of which
    // case they're in.
  }
  // Outside the `try`: `redirect()` works by throwing.
  if (readable) redirect(`/journeys/${journey.publicId}`);

  const fetchedAt = new Date().toISOString();
  // `JourneyDetailView` requires `origin` to build `ShareJourneyLinkButton`'s
  // link -- but that button only ever renders when `journey.isOwner` is
  // true, which `getJourneyByShareToken` never returns (Task 2's own
  // guarantee, see the doc comment above), so this value is never actually
  // read on this page. Resolved anyway, same unconditional pattern
  // `app/journeys/[id]/page.tsx` uses for its own identical prop, for the
  // same reason given there: a cheap header/env read, and keeping it
  // unconditional means this can't silently start passing a stale/undefined
  // origin if a future edit reorders things.
  const origin = await getSiteOrigin();

  return (
    <Stack p="lg" gap="md">
      <Text size="xs" c="dimmed">
        You&apos;re viewing this journey via a shared link.
      </Text>
      {loggedIn && (
        <FollowJourneyButton
          journeyId={journey.publicId}
          following={false}
          shareToken={token}
          afterFollowHref={`/journeys/${journey.publicId}`}
        />
      )}
      <JourneyDetailView journey={journey} fetchedAt={fetchedAt} origin={origin} viaShareLink shareToken={token} />
      <DataCredits credits={journeyCredits(journey.legs)} />
    </Stack>
  );
}
