import { Text } from '@mantine/core';
import { RecentlyClearedList } from '@/components/RecentlyCleared';
import { StationFold } from '@/components/StationFold';
import { getRecentlyCleared } from '@/lib/api';
import { describeFailure } from '@/lib/failure';
import type { RecentlyClearedIncident } from '@/lib/types';

/** `RecentlyCleared` for a station page with the departures board: the same
 * section, folded, and no fold at all when nothing has cleared (the fold is
 * not the section's, so it can't hide itself). A failed read says so inside
 * the fold. Render inside its own `Suspense`. */
export async function FoldedRecentlyCleared({ crs, now }: { crs: string; now: number }) {
  let items: RecentlyClearedIncident[];
  try {
    items = await getRecentlyCleared({ station: crs });
  } catch {
    return (
      <StationFold title="Recently cleared">
        <Text c="dimmed">{describeFailure('load', 'recently cleared incidents')}</Text>
      </StationFold>
    );
  }
  if (items.length === 0) return null;
  return (
    <StationFold title="Recently cleared">
      <RecentlyClearedList items={items} now={now} showLines />
    </StationFold>
  );
}
