import { SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { DataCredits } from '@/components/DataCredits';
import { StationLetterLinks } from '@/components/StationLetterLinks';
import { TextLink } from '@/components/TextLink';
import { getStationCodes, getStationName } from '@/lib/api';
import { pageMetadata } from '@/lib/pageMetadata';
import {
  groupStationCodes,
  STATION_BROWSE_PATH,
  STATION_INDEX_SEGMENT,
  STATION_LETTER,
  stationBrowseHref,
  stationLetters,
} from '@/lib/stationBrowse';
import { stationLabel } from '@/lib/stationLabel';

/** The A to Z of station pages, rendered by `app/stations/[crs]/page.tsx`
 * for `/stations/a-z` and `/stations/<letter>` (see `lib/stationBrowse.ts`
 * for why they are not routes of their own). */

const REVALIDATE_SECONDS = 6 * 60 * 60;
/** Name lookups in flight at once: a page lists up to a few hundred
 * stations, each named by one hour-cached api call. */
const NAME_BATCH = 25;

const INDEX_TITLE = 'Stations A to Z';
const INDEX_DESCRIPTION =
  'Every UK station we cover, A to Z by station code, with disruptions and departures for each.';

async function nameOrNull(crs: string): Promise<string | null> {
  try {
    return await getStationName(crs);
  } catch {
    return null;
  }
}

async function stationNames(codes: readonly string[]): Promise<Map<string, string | null>> {
  const names = new Map<string, string | null>();
  for (let i = 0; i < codes.length; i += NAME_BATCH) {
    const batch = codes.slice(i, i + NAME_BATCH);
    const found = await Promise.all(batch.map(nameOrNull));
    batch.forEach((code, index) => names.set(code, found[index] ?? null));
  }
  return names;
}

/** `<title>`, description and self-canonical of `/stations/<segment>`. */
export function stationBrowseMetadata(segment: string): Metadata {
  if (segment === STATION_INDEX_SEGMENT)
    return pageMetadata(INDEX_TITLE, INDEX_DESCRIPTION, { path: STATION_BROWSE_PATH });
  if (!STATION_LETTER.test(segment)) notFound();
  const upper = segment.toUpperCase();
  return pageMetadata(
    `Stations starting with ${upper}`,
    `UK stations with a code starting with ${upper}, with disruptions and departures for each.`,
    { path: stationBrowseHref(segment) },
  );
}

/** `/stations/a-z`: the letters, each a page of plain links to stations. */
export async function StationBrowseIndex() {
  let letters: string[] = [];
  try {
    letters = stationLetters(await getStationCodes(REVALIDATE_SECONDS));
  } catch {
    // The page says so below; the nav still works.
  }
  return (
    <Stack p="lg" gap="md">
      <Title order={1}>{INDEX_TITLE}</Title>
      <Text c="dimmed">Pick the first letter of a station&apos;s three-letter code to see its stations.</Text>
      {letters.length > 0 ? (
        <StationLetterLinks letters={letters} />
      ) : (
        <Text c="dimmed">Couldn&apos;t load the station list. Try again shortly.</Text>
      )}
      <TextLink href="/stations" underline="always">
        Search for a station by name
      </TextLink>
      <DataCredits credits={['national-rail']} />
    </Stack>
  );
}

/** `/stations/<letter>`: every station whose code starts with the letter,
 * as plain server-rendered links. Not found for a letter with none. */
export async function StationLetterPage({ letter }: { letter: string }) {
  if (!STATION_LETTER.test(letter)) notFound();
  const groups = groupStationCodes(await getStationCodes(REVALIDATE_SECONDS));
  const codes = groups.get(letter);
  if (!codes) notFound();
  const names = await stationNames(codes);
  const upper = letter.toUpperCase();
  return (
    <Stack p="lg" gap="md">
      <Stack gap={4}>
        <Title order={1}>Stations starting with {upper}</Title>
        <TextLink href={STATION_BROWSE_PATH}>{INDEX_TITLE}</TextLink>
      </Stack>
      <Text c="dimmed">
        {codes.length} {codes.length === 1 ? 'station has' : 'stations have'} a code starting with {upper}.
      </Text>
      <StationLetterLinks letters={[...groups.keys()].sort()} current={letter} />
      <SimpleGrid
        component="ul"
        cols={{ base: 1, xs: 2, md: 3 }}
        spacing="xs"
        className="ds-plain-list"
        aria-label="Stations"
      >
        {codes.map((crs) => (
          <li key={crs}>
            <TextLink href={`/stations/${crs}`} prefetch={false}>
              {stationLabel(crs, names.get(crs))}
            </TextLink>
          </li>
        ))}
      </SimpleGrid>
      <DataCredits credits={['national-rail']} />
    </Stack>
  );
}
