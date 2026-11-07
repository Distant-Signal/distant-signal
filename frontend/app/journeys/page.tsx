import { Group, Stack, Text, Title } from '@mantine/core';
import { TrackEmptyState } from '@/components/TrackEmptyState';
import { SectionTitle } from '@/components/SectionTitle';
import { CardTitleLink, ClickableCard, StaticCard } from '@/components/ClickableCard';
import {
  getMyTrackedTrains,
  getMyReliability,
  getSharedGroupTrains,
  getMyJourneys,
  getMyJourneyTemplates,
} from '@/lib/api';
import { SavedRouteLinks } from '@/components/SavedRouteLinks';
import { savedRoutes, type RouteShortcut } from '@/lib/routeShortcuts';
import { LoginControl } from '@/components/LoginControl';
import { TextLink } from '@/components/TextLink';
import { ButtonLink } from '@/components/ButtonLink';
import { StateBadge } from '@/components/StateBadge';
import { pageMetadata } from '@/lib/pageMetadata';
import { PLAN_JOURNEY_HREF, PLAN_JOURNEY_LABEL } from '@/lib/navLinks';
import { FollowJourneyButton } from '@/components/FollowJourneyButton';
import { followedFromLabel } from '@/lib/followedFrom';
import { ReliabilityDigest } from '@/components/ReliabilityDigest';
import { StatusRow } from '@/components/StatusRow';
import { TrackedTrainRowMenu } from '@/components/TrackedTrainRowMenu';
import { TrackedRowStatusBadge } from '@/components/TrackedRowStatusBadge';
import { formatDate, formatTime, londonDayKey } from '@/lib/dateFormat';
import { publicTrainHref, trackedTrainDisplayName, trackedTrainHref, trackedTrainRouteLabel } from '@/lib/trackingName';
import { mergeSharedTrains, type MergedSharedTrain } from '@/lib/sharedTrains';
import { splitJourneyTrains } from '@/lib/journeyTrains';
import { memberLabel, MEMBER_PLACEHOLDER_INLINE } from '@/lib/memberLabel';
import type { TrackedRowStatus } from '@/lib/trackedRowStatus';
import { journeysPageSections, type JourneysPageEntry } from '@/lib/journeyHistory';
import { journeyDisplayName, journeyListItemNameInput, journeyPreviewLine } from '@/lib/journeyName';
import type { TrackedTrainListItem, JourneyListItem } from '@/lib/types';
import type { Metadata } from 'next';
import { DataCredits, TRAIN_CREDITS } from '@/components/DataCredits';

// See app/page.tsx's own `revalidate = 0` comment for the rationale: this
// route has no dynamic segment, so without this Next.js treats it as
// eligible for static generation and tries to prerender it during `next
// build`, which fails since the `api` service only exists on the compose
// network at runtime.
export const revalidate = 0;

export const metadata: Metadata = {
  ...pageMetadata('Journeys', 'Your journeys, upcoming and past, with your tracked trains and how they ran.'),
  robots: { index: false },
};

/** `/journeys` -- the Journeys page, the nav's one tracking entry
 * (`JOURNEYS_DESTINATION` in `lib/navLinks.ts`). It was the Track page at
 * `/track/mine` until DS-115, which renamed it and split the list into
 * Upcoming and Past (`lib/upcomingPast.ts`) with "Your reliability"
 * between them. Its header starts everything tracking-shaped: "Plan a
 * journey" (`/plan`, no longer a nav entry since DS-194), "Find a train",
 * and regular journeys. Below that, a logged-in user's own journeys and
 * tracked trains. Tickets used to be listed here too, attached to a train
 * or standalone; since 2026-11-06 a ticket is a few details on a journey
 * leg, edited on the journey's own page, and "Your reliability" comes from
 * `getMyReliability()` (the trains each journey actually took, and Delay
 * Repay once per journey, no ticket needed).
 *
 * `getMyTrackedTrains()` returning `null` on a `401` is the COMPLETE "not
 * logged in" signal for this page -- there's no second party to
 * disambiguate on a route with no id in its path, so no separate
 * `getSession()` call is needed. `getMyReliability()` is auxiliary, so it
 * gets `.catch(() => null)` like the shared lists below: a failure only
 * hides the digest.
 *
 * `getSharedGroupTrains()` is the third call, gated and null-on-401 in
 * exactly the same way, and is what makes this "my trains" rather than
 * "trains I personally pressed Track on": a train someone shared into a
 * group the caller belongs to belongs in this list too, tagged with where
 * it came from. Before this, sharing a train had no effect whatsoever on
 * the recipient's own tracked-trains page -- the only place a shared train
 * appeared at all was `/groups/{id}`, which a member had to already think
 * to open.
 *
 * `.catch(() => null)` on that third call alone: unlike the other two, it
 * is AUXILIARY to this page -- the caller's own trains and tickets are
 * what the page is for, and losing the group-shared half for the duration
 * of a backend hiccup is materially better than losing the whole page to
 * the error boundary, the same trade-off `app/page.tsx` already states for
 * its own non-essential fetches. `null` is a value this page already
 * handles (it's `getSharedGroupTrains()`'s own 401 return), so the failure
 * collapses into the existing "nothing shared with you" branch rather than
 * needing one of its own.
 *
 * `getMyJourneys()` is the fourth call, added for the 2026-09-22 UX
 * review's C1. Before it, a journey created by time-window search was
 * unreachable the moment the user left its page: this list was built from
 * `trains`/`shared` alone, an unmatched leg has
 * `train_subscription_id IS NULL` and so could never produce a row here,
 * `navLinks.ts` has no journey entry, and the journey page itself is
 * reached only by a `router.push`. Every other private object in this app
 * -- trains, tickets, groups, custom lines -- has a list page; the one
 * whose whole status is "needs you to come back and pick a train" did not.
 * Gated and null-on-401 exactly like the first two, and `.catch(() => null)`
 * for the same "auxiliary, don't lose the whole page over it" reason as
 * `getSharedGroupTrains()`.
 *
 * Since DS-178 that one call also brings every journey shared with the
 * caller, followed or shared into one of their groups
 * (`include=followed,shared`), merged with their own by the api in travel
 * order under one cap. It replaced a separate `getSharedGroupJourneys()`
 * whose rows were listed in a block after the caller's own. */
export default async function JourneysPage() {
  const [trains, reliability, sharedTrains, journeys, templates] = await Promise.all([
    getMyTrackedTrains(),
    getMyReliability().catch(() => null),
    getSharedGroupTrains().catch(() => null),
    // The caller's own journeys, the ones they follow and the ones other
    // members shared into their groups (since DS-124 a shared tracked
    // train is its one-leg journey, so most shares arrive here): one list.
    getMyJourneys({ includeFollowed: true, includeShared: true }).catch(() => null),
    // Saved routes, to start a journey from.
    getMyJourneyTemplates().catch(() => null),
  ]);

  if (trains === null) {
    return (
      // No auto-opening login modal: this is the nav's Journeys entry, so
      // every logged-out visitor who taps it lands here. The header offers
      // what they can start without logging in first: planning a journey
      // (it asks them to log in when they save it) and a train search.
      <Stack p="lg" gap="md" maw={640}>
        <JourneysHeader />
        <Text>Log in to see your journeys and how your trains ran.</Text>
        <LoginControl variant="button" title="Log in (needs a Distant Signal account)">
          Log in
        </LoginControl>
      </Stack>
    );
  }

  // De-duplicated per train, and filtered against the caller's own rows --
  // see `mergeSharedTrains`' own doc comment for why both halves of that
  // are the frontend's job rather than the query's.
  const shared = mergeSharedTrains(sharedTrains ?? [], new Set(trains.map((t) => t.id)));

  // Split deliberately. `hasOwnContent` is the OLD `!nothingToShow`, and
  // still gates the reliability digest alone: that card is the caller's
  // own punctuality/Delay Repay record ("Your reliability"), computed from
  // their own journeys, so a shared train is not evidence about
  // it and must not make an otherwise-empty digest appear.
  //
  // `nothingToShow` now also accounts for shared trains: a member who
  // tracks nothing themselves but has trains shared with them has
  // something to show, and the empty state ("you haven't tracked any
  // trains") would be both wrong and -- since it's the branch that hides
  // the list entirely -- the very bug this page had.
  const journeyRows = journeys ?? [];
  // A train a journey leg is bound to is also one of this user's own
  // tracked trains, so `getMyTrackedTrains()` returns it too. Showing both
  // would put the same service on screen twice under two different nouns
  // (the review's I22). The journey row wins, for EVERY leg's train, not
  // only the current leg's: it links to `/journeys/{id}` and knows about
  // the journey's other legs, which a bare train row does not. See
  // `splitJourneyTrains` for the rule and its fallbacks.
  const { standalone: standaloneTrains } = splitJourneyTrains(trains, journeys);

  // `hasOwnContent` still gates the reliability digest ALONE: the caller's
  // own trains, or a finished journey the digest already knows about (a
  // journey with no train picked yet is not evidence about the caller's
  // punctuality record). `nothingToShow` does count
  // journeys: a user whose only tracked object is an unmatched journey has
  // something to show, and the "you haven't tracked any trains" empty
  // state would both be wrong and (since it's the branch that hides the
  // list) hide the very row C1 exists to add.
  const hasOwnContent =
    trains.length > 0 || (reliability !== null && (reliability.trains.length > 0 || reliability.journeys.length > 0));
  const nothingToShow = !hasOwnContent && shared.length === 0 && journeyRows.length === 0;

  // Two lists with one cut-off: Upcoming (still to come, or under way now)
  // and Past (travelled), by the same "is it over" rule the home page and
  // the api share. Each is ONE list in one order (DS-178,
  // `lib/journeyHistory.ts`): Upcoming soonest first, Past newest first,
  // by when the travel happens. The caller's own journeys and every
  // journey shared with them come merged and ordered from the api; trains
  // with no journey (a lone train of the caller's, a bare train shared
  // into a group) are merged in by the same key, not given a block of
  // their own. Each shared or followed row carries its "From <group>" /
  // "Shared by <who>" tags, since in a merged list a row with no
  // attribution reads as one the caller tracked themselves.
  const today = londonDayKey(new Date());
  const sections = journeysPageSections(
    { journeys: journeyRows, trains: standaloneTrains, sharedTrains: shared },
    today,
  );
  const upcomingCount = sections.upcoming.length;
  const pastCount = sections.past.length;
  const renderEntry = (entry: JourneysPageEntry) => {
    switch (entry.kind) {
      case 'journey':
        return <JourneyListRow key={entry.key} journey={entry.journey} status={entry.status} />;
      case 'train':
        return <TrackedTrainListRow key={entry.key} train={entry.train} status={entry.status} />;
      case 'sharedTrain':
        return <SharedTrainListRow key={entry.key} row={entry.row} status={entry.status} />;
    }
  };

  return (
    <Stack p="lg" gap="xl">
      <JourneysHeader authenticated savedRoutes={savedRoutes(templates)} />
      {nothingToShow ? (
        <Text c="dimmed">
          You have no journeys yet. Plan a journey, or find a train first, and it will show here.
          <TrackEmptyState kind="journeys_none" />
        </Text>
      ) : (
        <>
          {(upcomingCount > 0 || pastCount > 0) && (
            // Upcoming leads even when it is empty, so the cut-off is
            // always in the same place.
            <Stack component="section" aria-labelledby="upcoming-heading" gap="xs">
              <SectionTitle id="upcoming-heading">Upcoming</SectionTitle>
              {upcomingCount === 0 && <Text c="dimmed">No upcoming journeys.</Text>}
              {sections.upcoming.map(renderEntry)}
            </Stack>
          )}
          {/* Below Upcoming and above Past (DS-115): the caller's own record
              matters less than what is coming up, and more than the list of
              what is over. */}
          {hasOwnContent && <ReliabilityDigest reliability={reliability ?? { trains: [], journeys: [] }} />}
          {pastCount > 0 && (
            // Travelled, newest first, own and shared together. A
            // cancelled one keeps its red badge here.
            <Stack component="section" aria-labelledby="past-heading" gap="xs">
              <SectionTitle id="past-heading">Past</SectionTitle>
              {sections.past.map(renderEntry)}
            </Stack>
          )}
          <DataCredits credits={TRAIN_CREDITS} />
        </>
      )}
    </Stack>
  );
}

/** The Journeys page's h1 and its ways to start. "Plan a journey" leads,
 * as a button, for everyone: `/plan` needs no account to search and asks a
 * logged-out visitor to log in when they save, and is reached from here and
 * the home page, not the nav (DS-194). The rest are links: a train search
 * for everyone and, logged in, regular journeys. */
function JourneysHeader({
  authenticated = false,
  savedRoutes: saved = [],
}: {
  authenticated?: boolean;
  /** Logged in: the saved routes to start from. */
  savedRoutes?: RouteShortcut[];
}) {
  return (
    <Stack gap="sm">
      <Title order={1}>Journeys</Title>
      <Group gap="md" align="center">
        <ButtonLink href={PLAN_JOURNEY_HREF}>{PLAN_JOURNEY_LABEL}</ButtonLink>
        <TextLink href="/trains">Find a train</TextLink>
        {authenticated && (
          <>
            <TextLink href="/journeys/regular">Regular journeys</TextLink>
          </>
        )}
      </Group>
      <SavedRouteLinks routes={saved} />
    </Stack>
  );
}

/** One row of `GET /Journeys/mine`, linking to `/journeys/{id}` -- the
 * page the user was pushed to when they created it, and until this row
 * existed the only way back to it (2026-09-22 UX review, C1).
 *
 * Named by `lib/journeyName.ts`, the one journey-naming rule: the custom
 * name, else the whole journey's route (first leg's origin to LAST leg's
 * destination) and its first day. It used to build the route from the
 * row's current-leg fields, so a planned multi-leg journey read as ending
 * at its first change. The secondary line brings back the route and date a
 * custom name hides, and a multi-leg journey's leg count.
 *
 * Built on `StatusRow` rather than a hand-rolled
 * `Group justify="space-between"`, for the shrink-safe title/trailing
 * behaviour the primitive encodes (review P2) -- the same reason
 * `ScheduleRow` is built on it. */
function JourneyListRow({ journey, status }: { journey: JourneyListItem; status: TrackedRowStatus }) {
  const name = journeyListItemNameInput(journey);
  const preview = journeyPreviewLine(name);
  // A followed journey is labelled as followed (below) even when it is
  // also shared into one of the caller's groups, as before DS-178.
  const sharedVia = journey.followedFrom ? [] : (journey.sharedVia ?? []);
  const firstShare = sharedVia[0];

  return (
    <ClickableCard>
      <Stack gap={4}>
        <StatusRow
          align="flex-start"
          title={
            <Text fw={500} lineClamp={2} miw={0}>
              <CardTitleLink href={`/journeys/${journey.id}`}>{journeyDisplayName(name)}</CardTitleLink>
            </Text>
          }
          trailing={<TrackedRowStatusBadge status={status} />}
        />
        {preview && (
          <Text size="sm" c="dimmed">
            {preview}
          </Text>
        )}
        {/* A journey shared into one or more of the caller's groups
            (DS-178): where it came from and who shared it, as the group's
            own row says, and the way to follow it. Read-only. */}
        {firstShare && (
          <>
            <Group gap="xs" wrap="wrap">
              {sharedVia.map((via) => (
                <StateBadge key={via.groupId} tone="action">
                  From {via.groupName}
                </StateBadge>
              ))}
              <Text size="sm" c="dimmed">
                Shared by {memberLabel(firstShare.addedByName, firstShare.addedByTag, MEMBER_PLACEHOLDER_INLINE)}
              </Text>
            </Group>
            <FollowJourneyButton journeyId={journey.id} following={false} groupId={firstShare.groupId} />
          </>
        )}
        {/* A journey the caller follows (DS-146): whose it is, and the way
            to stop. It is read-only. */}
        {journey.followedFrom && (
          <Group gap="xs" wrap="wrap" justify="space-between">
            <Text size="sm" c="dimmed">
              {followedFromLabel(journey.followedFrom)}
            </Text>
            <FollowJourneyButton journeyId={journey.id} following />
          </Group>
        )}
      </Stack>
    </ClickableCard>
  );
}

function TrackedTrainListRow({ train, status }: { train: TrackedTrainListItem; status: TrackedRowStatus }) {
  // Canonical, shareable URL once resolved; the by-id detail route
  // otherwise, rather than always sending the user through the by-id
  // redirect hop. The home page's lone-train rows link the same way.
  const href = trackedTrainHref(train);

  const route = trackedTrainRouteLabel(train);
  const displayName = trackedTrainDisplayName(train);
  // `pinScheduledDeparture` is `null` for an NR-primary subscription whose
  // train has no schedule data yet -- degrade to a date-only label rather
  // than rendering `Invalid Date`. Kept identical to
  // `trackedTrainDisplayName`'s own fallback so the rename dialog's
  // placeholder always matches the label it would replace.
  const when = train.pinScheduledDeparture
    ? `${formatDate(train.serviceDate)} · ${formatTime(train.pinScheduledDeparture)}`
    : formatDate(train.serviceDate);
  const defaultName = `${route}, ${when}`;

  return (
    <ClickableCard>
      <Stack gap="sm">
        {/* The train's name is the card's link, stretched over the card
            (`ClickableCard`). The row menu sits beside the title, lifted
            above the stretched link, so it never nests inside it. */}
        <StatusRow
          align="flex-start"
          title={
            <Stack gap={4}>
              <StatusRow
                title={
                  <Text fw={500} lineClamp={2} miw={0}>
                    <CardTitleLink href={href}>{displayName}</CardTitleLink>
                  </Text>
                }
                trailing={<TrackedRowStatusBadge status={status} />}
              />
              {/* Task 3.6.8: `displayName` (`trackedTrainDisplayName`)
                    already falls back to `${route}, ${when}` -- the exact
                    same `when` string -- whenever no custom name is set,
                    so printing this dimmed line unconditionally repeated
                    the date/time on screen twice for every train without
                    one. It's only new information once a custom name has
                    replaced the default title above. */}
              {train.customName && (
                <Text size="sm" c="dimmed">
                  {when}
                </Text>
              )}
            </Stack>
          }
          trailing={
            // Task 3.6.7: one overflow kebab instead of a standalone
            // "Rename" button with no "stop tracking" affordance at all on
            // this row (that action previously only existed on the detail
            // page) -- also relieves Task 1.5's space contest on this same
            // trailing slot, which otherwise stacks the status badge
            // alongside an ever-growing set of per-row controls.
            //
            // The Menu/trigger composition itself lives in
            // TrackedTrainRowMenu (a Client Component): this page is a
            // Server Component, and RenameTrainButton/DeleteTrainButton's
            // `trigger` prop is a function -- functions cannot cross the
            // Server->Client boundary as a prop, only serializable values
            // can, so the closures that build each Menu.Item have to be
            // constructed client-side, not passed in from here.
            <TrackedTrainRowMenu
              displayName={displayName}
              trackingId={train.id}
              customName={train.customName}
              defaultName={defaultName}
              sharedGroupCount={train.sharedGroupCount}
            />
          }
        />
      </Stack>
    </ClickableCard>
  );
}

/** A train another member shared into a group the caller belongs to,
 * rendered in the same list as the caller's own rows above.
 *
 * Deliberately NOT a `TrackedTrainListRow` with extra props: none of that
 * row's controls apply to a train the caller doesn't own. There's no
 * rename (`POST /Train/{id}/name` is owner-scoped), no ticket sub-list
 * (spec §4 forbids a shared train ever carrying ticket data at all), and
 * no delete. What's left in common -- the display name, the when line, the
 * status/delay badges -- is shared directly (`trackedTrainDisplayName`,
 * `TrackedRowStatusBadge`) rather than duplicated.
 *
 * The header links exactly when a `trainUid` is known, and not otherwise.
 * `/train/[uid]/[date]` is public and unscoped, so a uid is the whole
 * precondition -- deliberately a WEAKER test than the own-row's
 * `resolutionStatus === 'resolved' && trainUid`, because `trains_id` (and
 * so `trainUid`) is populated well before the status reaches `resolved`
 * (`schedule_matched`, and an NR-primary subscription created by
 * `create_subscription_for_train`, both have one while still short of
 * `resolved`). The own row can afford the stricter test because it falls
 * back to `/train/by-id/{id}`; this row can't, since that route
 * (`GET /Train/{id}`) is owner-scoped and 404s for everyone else -- which
 * is also why a uid-less shared train is rendered as plain text here
 * rather than linked, the same dead-end reasoning that leaves
 * `/groups/{id}`'s own shared rows unlinked entirely. */
function SharedTrainListRow({ row, status }: { row: MergedSharedTrain; status: TrackedRowStatus }) {
  const { train, groupNames } = row;
  const displayName = trackedTrainDisplayName({
    customName: train.customName,
    pinOriginCrs: train.pinOriginCrs,
    pinOriginName: train.pinOriginName,
    pinDestinationCrs: train.pinDestinationCrs,
    pinDestinationName: train.pinDestinationName,
    trainUid: train.trainUid,
    serviceDate: train.serviceDate,
    pinScheduledDeparture: train.pinScheduledDeparture,
  });
  // Same date-only degradation as the own-train row directly above, for
  // the same reason (a pin with no schedule data yet has no departure
  // time, and `Invalid Date` is never an acceptable label).
  const when = train.pinScheduledDeparture
    ? `${formatDate(train.serviceDate)} · ${formatTime(train.pinScheduledDeparture)}`
    : formatDate(train.serviceDate);
  const href = publicTrainHref(train);
  const heading = (
    <Text fw={500} lineClamp={2} miw={0}>
      {href ? <CardTitleLink href={href}>{displayName}</CardTitleLink> : displayName}
    </Text>
  );
  // Clickable only when it links somewhere: a uid-less row stays flat.
  const Frame = href ? ClickableCard : StaticCard;

  return (
    <Frame>
      <Stack gap={4}>
        <StatusRow align="flex-start" title={heading} trailing={<TrackedRowStatusBadge status={status} />} />
        {/* Task 3.6.8: same fix as the caller's own row above -- `heading`
            already falls back to `${route}, ${when}` whenever this
            sharer never set a custom name, so print the dimmed line only
            when a custom name replaced it in the heading. */}
        {train.customName && (
          <Text size="sm" c="dimmed">
            {when}
          </Text>
        )}
        <Group gap="xs" wrap="wrap">
          {/* One badge per group this train reached the caller through --
              a train shared into two of their groups is two tags, not an
              arbitrarily-picked one. `addedByName` is `null` when the
              sharer has neither a name nor a username on their account --
              never their email, which is not something to show the rest
              of a group (`crates/api/src/data/users.rs`'s
              `display_label`). "a member" then, never a raw user id,
              suffixed with the sharer's `addedByTag` so two such sharers
              don't read identically -- same helper and same wording as
              `/groups/{id}`'s shared rows (`lib/memberLabel.ts`). */}
          {groupNames.map((groupName) => (
            <StateBadge key={groupName} tone="action">
              From {groupName}
            </StateBadge>
          ))}
          <Text size="sm" c="dimmed">
            Shared by {memberLabel(train.addedByName, train.addedByTag, MEMBER_PLACEHOLDER_INLINE)}
          </Text>
        </Group>
      </Stack>
    </Frame>
  );
}
