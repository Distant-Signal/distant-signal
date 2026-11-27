import { Paper, Stack, Text } from '@mantine/core';
import { getLineDailyStats, getLineHalfHourlyStats, getLineHourlyStats, getLineSixHourlyStats } from '@/lib/api';
import { londonDayKey } from '@/lib/dateFormat';
import type { TrendGranularity } from '@/lib/history';
import { TrendsCharts } from './TrendsCharts';
import type { ChartPoint } from './chartPoint';

// Placeholders, not validated numbers. See
// docs/superpowers/specs/2026-09-05-configurable-trend-granularity-design.md. `day`/`halfHour` keep their
// earlier standalone values; `hour`/`sixHour` follow the same "~third of the bucket's max possible
// poll-cycle coverage" rule.
export const SPARSE_FLOOR: Record<TrendGranularity, number> = {
  halfHour: 10,
  hour: 20,
  sixHour: 120,
  day: 20,
};

// One honesty-copy sentence per granularity. The commitment (never draw a misleading flat line over data
// too sparse to trust) must not be softened or dropped. This short plain-language sentence stays inline
// next to the charts; the fuller mechanical explanation is `HONESTY_COPY_DETAILS` below, behind a
// collapsed disclosure in `TrendsResults`'s own render.
export const HONESTY_COPY: Record<TrendGranularity, string> = {
  day: 'Each train counts once a day, by its status when first seen. Gaps mean too little data.',
  halfHour: 'Each train counts once per half hour, by its status when first seen. Gaps mean too little data.',
  hour: 'Each train counts once an hour, by its status when first seen. Gaps mean too little data.',
  sixHour: 'Each train counts once per six hours, by its status when first seen. Gaps mean too little data.',
};

/** The rest of what `HONESTY_COPY` used to say in one paragraph -- same
 * facts, same "must not be softened" commitment, just moved behind a
 * collapsed disclosure rather than printed in full every time (review
 * §3.3's recommendation). Plain `<details>`/`<summary>`, not Mantine's
 * `Spoiler`: this codebase already chose that for exactly this "collapsed
 * extra detail" shape (`app/chat/callback/page.tsx`'s "Show error
 * details") over `Spoiler`, whose own measured-height-gated control and
 * "hidden but still mounted" content are the wrong fit here too (see
 * `components/StationAccessibilitySection.tsx`'s `Disclosure` doc comment
 * for the fuller reasoning against `Spoiler` specifically). */
export const HONESTY_COPY_DETAILS: Record<TrendGranularity, string> = {
  day: 'A train that leaves on time and runs late later still counts as on time: this is the status we saw first. The trains-counted chart shows every train seen in each day, even when there were too few to give a rate. It counts trains seen, not trains running at once.',
  halfHour:
    'A train that leaves on time and runs late later still counts as on time: this is the status we saw first. The trains-counted chart shows every train seen in each half hour, even when there were too few to give a rate. It counts trains seen, not trains running at once.',
  hour: 'A train that leaves on time and runs late later still counts as on time: this is the status we saw first. The trains-counted chart shows every train seen in each hour, even when there were too few to give a rate. It counts trains seen, not trains running at once.',
  sixHour:
    'A train that leaves on time and runs late later still counts as on time: this is the status we saw first. The trains-counted chart shows every train seen in each six-hour period, even when there were too few to give a rate. It counts trains seen, not trains running at once.',
};

interface StatsRow {
  sampleCycles: number;
  total: number;
  delayRate: number;
  cancellationRate: number;
  skipRate: number;
  avgDelayMinutes: number;
}

// Generalized from the original day-only toChartPoints: same null-all-four-fields-together gap logic (see
// docs/superpowers/specs/2026-08-31-line-history-graphics-design.md), now
// parameterized over which row field supplies `bucketKey` and which floor
// applies, so one function serves all four granularities' differently-shaped
// row types (LineDailyStats.day, LineHalfHourlyStats.halfHourStart,
// LineHourlyStats/LineSixHourlyStats.bucketStart).
export function toChartPoints<T extends StatsRow>(
  stats: T[],
  bucketKeyOf: (row: T) => string,
  floor: number,
): ChartPoint[] {
  return stats.map((row) => {
    const sparse = row.sampleCycles < floor;
    return {
      bucketKey: bucketKeyOf(row),
      delayRate: sparse ? null : row.delayRate,
      cancellationRate: sparse ? null : row.cancellationRate,
      skipRate: sparse ? null : row.skipRate,
      avgDelayMinutes: sparse ? null : row.avgDelayMinutes,
      total: row.total,
      sampleCycles: row.sampleCycles,
    };
  });
}

// Dispatches to the right fetch + floor + bucket-key field for the
// selected tier. `day` still converts its
// RFC3339 `from`/`to` to London calendar-day keys first, exactly as
// before -- the only granularity whose route takes NaiveDate path segments.
async function fetchPoints(id: string, granularity: TrendGranularity, from: string, to: string): Promise<ChartPoint[]> {
  switch (granularity) {
    case 'day': {
      const stats = await getLineDailyStats(id, londonDayKey(from), londonDayKey(to));
      return toChartPoints(stats, (row) => row.day, SPARSE_FLOOR.day);
    }
    case 'halfHour': {
      const stats = await getLineHalfHourlyStats(id, from, to);
      return toChartPoints(stats, (row) => row.halfHourStart, SPARSE_FLOOR.halfHour);
    }
    case 'hour': {
      const stats = await getLineHourlyStats(id, from, to);
      return toChartPoints(stats, (row) => row.bucketStart, SPARSE_FLOOR.hour);
    }
    case 'sixHour': {
      const stats = await getLineSixHourlyStats(id, from, to);
      return toChartPoints(stats, (row) => row.bucketStart, SPARSE_FLOOR.sixHour);
    }
  }
}

export async function TrendsResults({
  id,
  from,
  to,
  granularity = 'day',
}: {
  id: string;
  from: string;
  to: string;
  /** Defaults to `'day'` -- the existing, always-safe behavior, unchanged
   * for any call site that doesn't pass this. */
  granularity?: TrendGranularity;
}) {
  // Degrade gracefully, like the line-info page's HalfHourlyTrendsResults: an unhandled rejection would
  // propagate to app/error.tsx and blank the whole page over a secondary chart.
  let points: ChartPoint[];
  try {
    points = await fetchPoints(id, granularity, from, to);
  } catch {
    return (
      <Paper withBorder p="md">
        <Text c="dimmed">Trend data isn&apos;t available right now.</Text>
      </Paper>
    );
  }

  if (points.length === 0) {
    // The reported "dead whitespace below the footer" is a transient Suspense loading flash, not a
    // persistent layout bug. A bounded `Paper` still makes this read as a finished component rather than
    // a chart that failed to render.
    return (
      <Paper withBorder p="md">
        <Text c="dimmed">Not enough sampled data yet for this line.</Text>
      </Paper>
    );
  }

  return (
    <Stack gap="lg">
      <Text size="sm" c="dimmed">
        {HONESTY_COPY[granularity]}
      </Text>
      {/* Both charts (including their `valueFormatter`) live in TrendsCharts,
          a Client Component -- see its own doc comment for why: a plain
          function prop can't cross the Server-to-Client boundary straight
          out of this `async` Server Component. */}
      {/* order={2}: this sits directly under /lines/[id]/history's only
          h1 ("History: {name}"), with nothing between -- h2 keeps the
          chart titles one level below that h1, with no skip. */}
      <TrendsCharts points={points} granularity={granularity} order={2} showVolume />
      {/* The data leads; the fuller mechanical explanation is collapsed below it. */}
      <details>
        <summary>How this is calculated</summary>
        <Text size="sm" c="dimmed" mt="xs">
          {HONESTY_COPY_DETAILS[granularity]}
        </Text>
      </details>
    </Stack>
  );
}
