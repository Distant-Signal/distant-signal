import { SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { DataCredits } from '@/components/DataCredits';
import { StationLetterLinks } from '@/components/StationLetterLinks';
import { TextLink } from '@/components/TextLink';
import { getStationCodes, getStationName } from '@/lib/api';
import { pageMetadata } from '@/lib/pageMetadata';
import { groupStationCodes, STATION_BROWSE_PATH, STATION_LETTER, stationBrowseHref } from '@/lib/stationBrowse';
import { stationLabel } from '@/lib/stationLabel';

interface Params {
  params: Promise<{ letter: string }>;
}

const REVALIDATE_SECONDS = 6 * 60 * 60;
/** Name lookups in flight at once: a page lists up to a few hundred
 * stations, each named by one hour-cached api call. */
const NAME_BATCH = 25;

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

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { letter } = await params;
  if (!STATION_LETTER.test(letter)) notFound();
  const upper = letter.toUpperCase();
  return pageMetadata(
    `Stations starting with ${upper}`,
    `UK stations with a code starting with ${upper}, with disruptions and departures for each.`,
    { path: stationBrowseHref(letter) },
  );
}

/** `/stations/browse/[letter]`: every station whose three-letter code
 * starts with the letter, as plain server-rendered links. */
export default async function StationLetterPage({ params }: Params) {
  const { letter } = await params;
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
        <TextLink href={STATION_BROWSE_PATH}>Stations A to Z</TextLink>
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
