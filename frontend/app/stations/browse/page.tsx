import { Stack, Text, Title } from '@mantine/core';
import type { Metadata } from 'next';
import { StationLetterLinks } from '@/components/StationLetterLinks';
import { TextLink } from '@/components/TextLink';
import { DataCredits } from '@/components/DataCredits';
import { getStationCodes } from '@/lib/api';
import { pageMetadata } from '@/lib/pageMetadata';
import { STATION_BROWSE_PATH, stationLetters } from '@/lib/stationBrowse';

const DESCRIPTION = 'Every UK station we cover, A to Z by station code, with disruptions and departures for each.';

export const metadata: Metadata = pageMetadata('Stations A to Z', DESCRIPTION, { path: STATION_BROWSE_PATH });

/** `/stations/browse`: the letters of the station A to Z, each a page of
 * plain links to station pages (`app/stations/browse/[letter]`). */
export default async function StationBrowsePage() {
  let letters: string[] = [];
  try {
    letters = stationLetters(await getStationCodes(6 * 60 * 60));
  } catch {
    // The page says so below; the footer and nav still work.
  }
  return (
    <Stack p="lg" gap="md">
      <Title order={1}>Stations A to Z</Title>
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
