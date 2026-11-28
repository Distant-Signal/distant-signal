import { Suspense } from 'react';
import { Group, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { SectionTitle } from '@/components/SectionTitle';
import type { Metadata } from 'next';
import { getLineStatusForMode } from '@/lib/api';
import { withStaleFallback } from '@/lib/liveDataCache';
import { DISPLAYED_MODES_PARAM, type Country } from '@/lib/modes';
import { buildNetworkStatusOverview } from '@/lib/networkStatusOverview';
import {
  isGoodSeverity,
  SEVERITY_GROUPS_BY_RANK,
  severityGroupLabel,
  severityRank,
  type SeverityGroup,
  worstStatus,
} from '@/lib/severity';
import { TextLink } from '@/components/TextLink';
import { LineStatusCard } from '@/components/LineStatusCard';
import { LastUpdated } from '@/components/LastUpdated';
import { RecentlyCleared } from '@/components/RecentlyCleared';
import type { LineStatusReport } from '@/lib/types';
import { OWN_PREVIEW_IMAGE, pageMetadata } from '@/lib/pageMetadata';
import { feedTarget, NETWORK_FEED_PATH } from '@/lib/feeds';
import { FeedLink } from '@/components/FeedLink';
import { StatusBadge } from '@/components/StatusBadge';
import { StatusCard } from '@/components/StatusCard';
import { StatusTile } from '@/components/StatusTile';
import { DataCredits, lineCredits } from '@/components/DataCredits';

// Same rationale as every other dynamic route in this app (see
// app/lines/page.tsx's own comment): without this, `next build` treats the
// route as eligible for static generation and tries to prerender it, which
// fails since the `api` service only exists on the compose network at
// runtime.
export const revalidate = 0;

const METADATA_TITLE = 'Status';
const METADATA_DESCRIPTION = 'Live status of every National Rail and TfL line: how many have problems, and which ones.';

export const metadata: Metadata = pageMetadata(METADATA_TITLE, METADATA_DESCRIPTION, {
  ...OWN_PREVIEW_IMAGE,
  path: '/status',
  feed: feedTarget(NETWORK_FEED_PATH, 'Every line'),
});

const COUNTRY_LABELS: Record<Country, string> = {
  Gb: 'GB',
  NorthernIreland: 'Northern Ireland',
  RepublicOfIreland: 'Republic of Ireland',
};

/** Worst-first, the order the tiles render in: a traveller asking "is anything wrong?" should reach the
 * answer first, but `SEVERITY_GROUPS_BY_RANK` is ascending (Good first). Reversing that shared rank order,
 * rather than hand-listing the five groups, keeps this from drifting from it and from `AllLinesTable`'s
 * filter chip order if a group is ever added or reordered there. */
const SEVERITY_GROUPS_WORST_FIRST: readonly SeverityGroup[] = [...SEVERITY_GROUPS_BY_RANK].reverse();

export default async function NetworkStatusPage() {
  // Deliberately the SAME cache key `app/page.tsx`/`app/lines/page.tsx`
  // already use (`lineStatusForMode:${DISPLAYED_MODES_PARAM}`) -- it is the
  // same request, so all three pages share one stale-fallback cache entry.
  const allReports = await withStaleFallback(`lineStatusForMode:${DISPLAYED_MODES_PARAM}`, () =>
    getLineStatusForMode(DISPLAYED_MODES_PARAM),
  );
  const overview = buildNetworkStatusOverview(allReports);

  // Honest about which modes are present: the subtitle must not say "across National Rail and TfL" when
  // TfL has zero lines tracked, contradicting the "By mode" card below. Falls back to naming both when the
  // snapshot is itself empty (nothing to be dishonest about yet).
  const activeModes = [
    overview.byMode.nationalRail.length > 0 ? 'National Rail' : null,
    overview.byMode.tfl.length > 0 ? 'TfL' : null,
  ].filter((mode): mode is string => mode !== null);
  const modesDescription = activeModes.length > 0 ? activeModes.join(' and ') : 'National Rail and TfL';

  // One timestamp per request, so the "Was expected until" check agrees
  // between SSR and hydration.
  // eslint-disable-next-line react-hooks/purity -- server component: one timestamp per request, passed down so SSR and hydration agree
  const now = Date.now();

  return (
    <Stack p="lg" gap="xl">
      <Stack gap="xs">
        <Title order={1}>Status</Title>
        <Text c="dimmed">
          {overview.totalLines} line{overview.totalLines === 1 ? '' : 's'} tracked across {modesDescription} right now.
        </Text>
        {/* `/network/history` shipped with no inbound `href` anywhere in
            the app -- a repo-wide grep found none outside its own
            `basePath` constant -- while its own back-link pointed at
            `/lines`, a page that had never heard of it (2026-09-22 UX
            review, C2). This page is its natural parent: it is the same
            question ("how is the whole network doing?") asked over time
            instead of right now, and `/network/history`'s back-link is
            repointed here in the same change so the pair agrees. */}
        <Group gap="md">
          <TextLink href="/network/history">Network history and trends</TextLink>
          <FeedLink href={NETWORK_FEED_PATH} label="every line's status changes and incidents" />
        </Group>
        {/* The data is served through `withStaleFallback`, so "right now" can legitimately be several
            minutes old: say when it was last updated. Omitted for an empty snapshot, where there is no
            real timestamp to show yet. */}
        {overview.lastUpdated && <LastUpdated timestamp={overview.lastUpdated} />}
      </Stack>

      {/* Five tiles: one compact row each on a phone, five across from
          `sm` up, so no tile is ever left alone on a row (StatusTile). */}
      <SimpleGrid cols={{ base: 1, sm: 5 }} spacing={{ base: 'xs', sm: 'md' }} data-counter-tiles>
        {SEVERITY_GROUPS_WORST_FIRST.map((group) => (
          <SeverityCounterTile key={group} group={group} count={overview.counts[group]} />
        ))}
      </SimpleGrid>

      <WorstLinesSection worstFirst={overview.worstFirst} />

      {/* Info only: cleared incidents never count towards the tiles above.
          Hidden when empty. */}
      <Suspense fallback={null}>
        <RecentlyCleared scope={{}} now={now} showLines />
      </Suspense>

      <Stack gap="md">
        <SectionTitle>By mode</SectionTitle>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <ModeCard label="National Rail" reports={overview.byMode.nationalRail} />
          <ModeCard label="TfL" reports={overview.byMode.tfl} />
        </SimpleGrid>
      </Stack>

      {/* Self-hides below two countries present: `MODE_TO_COUNTRY` is still empty today (lib/modes.ts's
          own doc comment), so every report is 'Gb' and a one-entry breakdown would say nothing a visitor
          doesn't already know. Mirrors AllLinesTable's own self-hiding country filter. */}
      {Object.keys(overview.byCountry).length > 1 && (
        <Stack gap="md">
          <SectionTitle>By country</SectionTitle>
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
            {(Object.entries(overview.byCountry) as [Country, LineStatusReport[]][]).map(([country, reports]) => (
              <ModeCard key={country} label={COUNTRY_LABELS[country]} reports={reports} />
            ))}
          </SimpleGrid>
        </Stack>
      )}
      <DataCredits credits={lineCredits(allReports.map((report) => report.id))} />
    </Stack>
  );
}

/** One of the five top-strip counters. Links to `/lines` pre-filtered to this bucket: the query param name
 * and values are `SeverityGroup` itself, so this link and `AllLinesTable`'s own filter chips can never
 * drift on what a value means. Page-local, not a new `components/` file: this is the only page that
 * renders a "count + label" tile, mirroring `app/page.tsx`'s `RightNowModule` in staying local until a
 * second page wants the same shape.
 *
 * `ClickableCard` gives each tile the app's clickable-card treatment (`app/globals.css`): a hover/focus
 * border-colour change plus a visible focus ring, since Mantine's own focus ring only applies to Mantine
 * interactive components, not a bare `<a>`. Sizes come from `tokens.statusTile`.
 *
 * Each linked tile's count is in its group's colour (`StatusTile`'s `severity`): the style guide bans
 * coloured left-border accents, so the colour lives on the count itself. */
function SeverityCounterTile({ group, count }: { group: SeverityGroup; count: number }) {
  const label = severityGroupLabel(group);
  if (count === 0) return <StatusTile count={0} label={label} severity={group} />;
  return (
    <StatusTile
      count={count}
      label={label}
      severity={group}
      href={`/lines?statusGroup=${group}`}
      ariaLabel={`${count} line${count === 1 ? '' : 's'} with ${label.toLowerCase()}, view in Lines`}
    />
  );
}

/** The unbounded worst-lines-first list: the same "affected lines, worst first" content `app/page.tsx`'s
 * `RightNowModule` shows, but without its `RIGHT_NOW_LIMIT` cap, since this page's point is the full
 * picture, not a five-row teaser.
 *
 * Rows use `LineStatusCard`, the shared primitive for this "line status" card shape (`app/page.tsx`'s
 * "Your Lines"/`RightNowModule` use it too), for its hover/focus affordance, shrink guard, sample summary
 * and freshness line. */
function WorstLinesSection({ worstFirst }: { worstFirst: LineStatusReport[] }) {
  return (
    <Stack gap="md">
      <SectionTitle>Lines to watch</SectionTitle>
      {worstFirst.length === 0 ? (
        <Text>Every line is running a Good Service.</Text>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
          {worstFirst.map((report) => (
            <LineStatusCard key={report.id} report={report} showUpdated={false} />
          ))}
        </SimpleGrid>
      )}
    </Stack>
  );
}

/** The worst severity across a slice of reports, by true rank (not the raw
 * `statusSeverity` number -- see `severityRank`'s own doc comment on why
 * that matters for TfL codes). Starts from Good Service (10) so an empty
 * slice reads as "nothing wrong" rather than needing a separate branch;
 * `ModeCard` below never actually calls this on an empty slice (it renders
 * its own "no lines tracked" state first), but the fallback is still the
 * honest answer if it ever did. */
function worstSeverityAcross(reports: LineStatusReport[]): number {
  return reports.reduce((worst, report) => {
    const candidate = worstStatus(report).statusSeverity;
    return severityRank(candidate) > severityRank(worst) ? candidate : worst;
  }, 10);
}

/** One row of the mode/country breakdown: a label plus how many of its lines are affected (not Good
 * Service) out of how many total. Reused for both the mode breakdown (National Rail/TfL) and the country
 * breakdown (GB/NI/RoI), which answer the same question sliced differently.
 *
 * Zero lines in a slice says "No lines tracked", with no badge: an empty set is not "all good service".
 * Otherwise the badge is the worst severity actually present in the slice (`worstSeverityAcross`), the
 * same filled `StatusBadge` a line shows, and the count of affected lines is in the reason line, where it
 * reads as a sentence ("2 of 120 lines affected."). */
function ModeCard({ label, reports }: { label: string; reports: LineStatusReport[] }) {
  if (reports.length === 0) {
    return <StatusCard title={label} reason="No lines tracked." />;
  }

  const affected = reports.filter((report) => !isGoodSeverity(worstStatus(report).statusSeverity));
  const lines = `${reports.length} line${reports.length === 1 ? '' : 's'}`;

  return (
    <StatusCard
      title={label}
      badge={<StatusBadge severity={worstSeverityAcross(reports)} />}
      reason={affected.length === 0 ? `${lines}, all running normally.` : `${affected.length} of ${lines} affected.`}
    />
  );
}
