import { Paper, Stack, Text, Title } from '@mantine/core';
import { getLineHalfHourlyCoverageStats } from '@/lib/api';
import type { LineHalfHourlyCoverageStats } from '@/lib/types';
import { TrendsCharts } from './TrendsCharts';
import type { ChartPoint } from './chartPoint';

// Placeholder, not a validated number: half of CoverageTrendsResults.tsx's SPARSE_DATA_FLOOR_WINDOWS (20),
// the same halving HalfHourlyTrendsResults.tsx applies to its cycle floor, to hold the same ~33% coverage bar.
// Doubly unvalidated, and there is no real full-coverage producer yet to observe a distribution from.
// See docs/superpowers/specs/2026-09-03-half-hourly-coverage-trends-design.md.
const SPARSE_DATA_FLOOR_WINDOWS_HALF_HOURLY = 10;

/** Half-hourly sibling of `CoverageTrendsResults.tsx`'s own
 * `toCoverageChartPoints` -- same sparse-gap-as-null shape,
 * `resolvedWindows` as the coverage/gap signal, `halfHourStart` (an
 * RFC3339 instant) as `bucketKey`, the same shape
 * `toHalfHourlyChartPoints` already uses for its own `bucketKey`. */
export function toHalfHourlyCoverageChartPoints(stats: LineHalfHourlyCoverageStats[]): ChartPoint[] {
  return stats.map((row) => {
    const sparse = row.resolvedWindows < SPARSE_DATA_FLOOR_WINDOWS_HALF_HOURLY;
    return {
      bucketKey: row.halfHourStart,
      delayRate: sparse ? null : row.delayRate,
      cancellationRate: sparse ? null : row.cancellationRate,
      skipRate: sparse ? null : row.skipRate,
      avgDelayMinutes: sparse ? null : row.avgDelayMinutes,
      total: row.total,
      sampleCycles: row.resolvedWindows,
    };
  });
}

/** Half-hourly full-coverage Trends chart, parallel to `HalfHourlyTrendsResults.tsx` the way
 * `CoverageTrendsResults.tsx` is parallel to `TrendsResults.tsx`. A separate component rather than a
 * `granularity` branch, since the fetch, sparse floor and honesty copy are granularity-specific; only
 * `TrendsCharts` is shared, rendered with `granularity="halfHour"`.
 * See docs/superpowers/specs/2026-09-03-half-hourly-coverage-trends-design.md. */
export async function HalfHourlyCoverageTrendsResults({ id, from, to }: { id: string; from: string; to: string }) {
  // Same unreachable-backend posture as HalfHourlyTrendsResults.tsx: this
  // component is rendered inside its own <Suspense> on /lines/[id]
  // (page.tsx), which catches suspension but not errors -- an unhandled
  // rejection here would propagate to app/error.tsx and blank the whole
  // page. Deliberately NOT stale-served: this is a secondary, decorative
  // panel, and a wrong-but-plausible trend chart is worse than an honest
  // absence.
  // The "Full coverage" heading is shared by every branch below, so the empty and failure boxes are
  // still labelled as a separate series from the sample chart above them.
  const heading = (
    <Title order={3} size="h6">
      Every train
    </Title>
  );

  let stats: LineHalfHourlyCoverageStats[];
  try {
    stats = await getLineHalfHourlyCoverageStats(id, from, to);
  } catch {
    return (
      <Stack gap="xs">
        {heading}
        <Paper withBorder p="md">
          <Text c="dimmed">Coverage trend data isn&apos;t available right now.</Text>
        </Paper>
      </Stack>
    );
  }

  if (stats.length === 0) {
    return (
      <Stack gap="xs">
        {heading}
        <Paper withBorder p="md">
          <Text c="dimmed">Not enough data for every train on this line yet.</Text>
        </Paper>
      </Stack>
    );
  }

  const points = toHalfHourlyCoverageChartPoints(stats);

  return (
    <Stack gap="lg">
      {/* Reused verbatim from CoverageTrendsResults.tsx: this sentence states a population fact (every
          scheduled service is cross-referenced regardless of bucket size), not a per-bucket counting rule,
          so a granularity change has nothing to reword. */}
      <Text size="sm" c="dimmed">
        Rates shown cover every scheduled service on this line, cross-referenced against real train-movement data, not a
        sample of live departures at a handful of stations.
      </Text>
      {/* order={3}: this sits under /lines/[id]'s h1 line name -> h2
          "Recent trends (last 24 hours)" -> HalfHourlyTrendsResults' own
          two h3 chart titles -- this section's own h3 keeps the same
          level, no skip. */}
      {heading}
      <TrendsCharts points={points} granularity="halfHour" order={4} />
    </Stack>
  );
}
