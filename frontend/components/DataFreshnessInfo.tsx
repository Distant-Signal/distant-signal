import { ActionIcon, Stack, Text, Tooltip } from '@mantine/core';
import { InfoIcon } from './InfoIcon';
import { LastUpdated } from './LastUpdated';
import type { DataFreshness } from '@/lib/types';

/** `missing` is what a source with no timestamp yet shows: the polled
 * feeds say "never fetched", a pushed delivery (CORPUS) "not yet received".
 * `undefined` (an older api that doesn't send the field) reads as missing. */
function freshnessRow(label: string, timestamp: string | null | undefined, missing = 'never fetched') {
  if (timestamp === null || timestamp === undefined) {
    return (
      <Text size="xs" c="dimmed" key={label}>
        {label}: {missing}
      </Text>
    );
  }
  return <LastUpdated key={label} timestamp={timestamp} label={`${label}:`} withTooltip={false} />;
}

/** The island-of-Ireland feeds, in display order. Each runs only where an
 * install turns it on, and the api reports `null` until it first reports
 * (`undefined` from an older api that predates the fields), so a missing
 * one is left out rather than shown as "never fetched" for good. */
const IRELAND_SOURCES = [
  ['Irish Rail timetable', 'irish_rail_timetable'],
  ['Irish Rail live', 'irish_rail_live'],
  ['NI Railways stations', 'northern_ireland_stations'],
] as const satisfies readonly (readonly [string, keyof DataFreshness])[];

function groupHeading(label: string) {
  return (
    <Text size="xs" fw={600} key={label}>
      {label}
    </Text>
  );
}

/** Nav-bar info icon for the freshness of the data sources behind
 * `/public/freshness` (the polled reference and status feeds, the CIF
 * schedule feed and the Network Rail CORPUS extract, then, under an
 * "Ireland" heading, whichever island-of-Ireland feeds have reported) (as opposed to `LastUpdated` on each line card, which
 * shows when that line's own status was last computed). Same
 * `ActionIcon` + `Tooltip` pattern as `LineDefinitionTooltip`. Each row
 * reuses `LastUpdated` with `withTooltip={false}` — nesting a
 * `Tooltip`-wrapped element inside this outer `Tooltip`'s own `label`
 * wouldn't be hoverable (the outer tooltip closes as the pointer leaves
 * the icon), so only the outer tooltip shows on hover here. */
export function DataFreshnessInfo({ freshness }: { freshness: DataFreshness }) {
  const irelandRows = IRELAND_SOURCES.flatMap(([label, field]) => {
    // `?? null`: an older api leaves the field out altogether.
    const timestamp = freshness[field] ?? null;
    return timestamp === null ? [] : [freshnessRow(label, timestamp)];
  });
  // Headings only when there is a second group to tell apart: an install
  // without the Irish feeds keeps the single plain list.
  const grouped = irelandRows.length > 0;
  return (
    <Tooltip
      label={
        <Stack gap={2}>
          {grouped && groupHeading('Great Britain')}
          {freshnessRow('Stations', freshness.stations)}
          {freshnessRow('Operators', freshness.tocs)}
          {freshnessRow('Incidents', freshness.incidents)}
          {freshnessRow('TfL', freshness.tfl)}
          {freshnessRow('Schedule feed', freshness.schedule_feed)}
          {freshnessRow('Network Rail CORPUS', freshness.corpus, 'not yet received')}
          {grouped && (
            <Stack gap={2} mt={6} key="ireland">
              {groupHeading('Ireland')}
              {irelandRows}
            </Stack>
          )}
        </Stack>
      }
      multiline
      maw={280}
      events={{ hover: true, focus: true, touch: true }}
      // Same fix as `LineDefinitionTooltip` (open downward, not over the
      // nav), but `bottom-end` rather than `bottom`: this trigger sits in
      // the nav's right-hand group, so a centred tooltip would hang off
      // the right edge of the viewport.
      position="bottom-end"
      zIndex={400}
    >
      {/* Explicit `size="md"` (28px): matches Mantine's own `ActionIcon`
          default already in effect, spelled out so this control's
          conformance with review §2.10's 24px touch-target floor doesn't
          silently depend on that default never changing. */}
      <ActionIcon variant="subtle" aria-label="Data freshness" size="md">
        <InfoIcon />
      </ActionIcon>
    </Tooltip>
  );
}
