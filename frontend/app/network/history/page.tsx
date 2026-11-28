import { Suspense } from 'react';
import { Alert, Stack, Text, Title } from '@mantine/core';
import { LoadingPlaceholder } from '@/components/LoadingPlaceholder';
import { getHistoryRetention } from '@/lib/api';
import { createLogger } from '@/lib/logger';
import { TextLink } from '@/components/TextLink';
import { availableGranularities, granularityShortfallDays, resolveGranularity, resolveRange } from '@/lib/history';
import { GranularityControl } from '@/app/lines/[id]/history/GranularityControl';
import { HistoryRangePicker } from '@/app/lines/[id]/history/HistoryRangePicker';
import { NetworkTrendsResults } from './NetworkTrendsResults';
import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/pageMetadata';
import { DataCredits } from '@/components/DataCredits';

const log = createLogger('app/network/history');

export const revalidate = 0;

async function resolveRetention(): Promise<{
  dailyStatsRetentionDays: number;
  halfHourlyStatsRetentionHours: number;
}> {
  try {
    const retention = await getHistoryRetention();
    return {
      dailyStatsRetentionDays: retention.dailyStatsRetentionDays,
      halfHourlyStatsRetentionHours: retention.halfHourlyStatsRetentionHours,
    };
  } catch (err) {
    log.warn('Could not resolve retention ceilings; offering only Daily.', { error: err });
    return { dailyStatsRetentionDays: 0, halfHourlyStatsRetentionHours: 0 };
  }
}

export const metadata: Metadata = pageMetadata(
  'Network history',
  'Delays and cancellations across every National Rail line, day by day.',
  // A date-range view: worth following, not worth indexing.
  { noindex: true },
);

export default async function NetworkHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; range?: string; granularity?: string }>;
}) {
  const query = await searchParams;
  // eslint-disable-next-line react-hooks/purity -- server component: one timestamp per request, passed down so SSR and hydration agree
  const now = Date.now();
  const ceilings = await resolveRetention();
  const range = resolveRange(query, now);
  const rangeWidthMs = Date.parse(range.to) - Date.parse(range.from);
  const available = availableGranularities(rangeWidthMs, ceilings);
  const granularity = resolveGranularity(query, rangeWidthMs, ceilings);
  const granularityShortfall = granularityShortfallDays(range, granularity, ceilings, now);
  const retentionDaysForGranularity =
    granularity === 'day' ? ceilings.dailyStatsRetentionDays : Math.floor(ceilings.halfHourlyStatsRetentionHours / 24);
  const basePath = '/network/history';

  return (
    <Stack p="lg" gap="md">
      {/* Points at `/status`, not `/lines`: `/status` links here and asks the same network-wide question
          about right now rather than over time. */}
      <TextLink href="/status" underline="always">
        Back to network status
      </TextLink>
      {/* Same title pattern as the line and operator history pages. */}
      <Title order={1}>Network history</Title>
      {/* Says the scope, like the operator history page does under its own title. */}
      <Text c="dimmed" size="sm">
        Every National Rail line (TfL not included)
      </Text>
      <HistoryRangePicker basePath={basePath} preset={range.preset} from={range.from} to={range.to} />
      <GranularityControl
        basePath={basePath}
        preset={range.preset}
        from={range.from}
        to={range.to}
        granularity={granularity}
        available={available}
      />
      {granularityShortfall !== null && (
        <Alert color="yellow" variant="light" title="Some of this range isn't available at this granularity">
          We keep {retentionDaysForGranularity} {retentionDaysForGranularity === 1 ? 'day' : 'days'} of data at this
          detail, so the first {granularityShortfall} {granularityShortfall === 1 ? 'day' : 'days'} of this range may
          look empty.
        </Alert>
      )}
      <Suspense
        key={`${granularity}-${range.preset ?? `${range.from}-${range.to}`}`}
        fallback={<LoadingPlaceholder label="Loading trends" height={320} />}
      >
        <NetworkTrendsResults from={range.from} to={range.to} granularity={granularity} />
      </Suspense>
      <DataCredits credits={['national-rail', 'network-rail', 'tfl']} />
    </Stack>
  );
}
