import { List, ListItem, Stack, Text } from '@mantine/core';
import { LinkSentence, type SentenceLink } from '@/components/LinkSentence';
import { SectionTitle } from '@/components/SectionTitle';
import { TextLink } from '@/components/TextLink';
import { stationDeparturesHref } from '@/lib/stationDepartures';
import {
  factSentences,
  timetableSentences,
  type PlaceCount,
  type StationFacts,
  type TimetableSummary,
} from '@/lib/stationSummary';

/** How many places the where-trains-go sentences name. */
const PLACE_LIMIT = 8;

function placeLinks(places: PlaceCount[]): SentenceLink[] {
  return places.slice(0, PLACE_LIMIT).map((place) => ({ href: `/stations/${place.crs}`, label: place.name }));
}

/** "About X": what the station's reference data says (platforms, step-free
 * category, facilities), as short prose. The lines that cover the station
 * are the status list below it, already links, so they are not repeated
 * here. Server-rendered, so it is in the HTML a search engine reads.
 * Nothing when there is nothing to say: no empty heading. */
export function StationAbout({ name, facts }: { name: string; facts: StationFacts | null }) {
  const sentences = facts === null ? [] : factSentences(name, facts);
  if (sentences.length === 0) return null;
  return (
    <Stack gap="xs" id="about">
      <SectionTitle>About {name}</SectionTitle>
      <Text>{sentences.join(' ')}</Text>
    </Stack>
  );
}

/** "Trains from X today": today's timetable (not live running) as prose,
 * the train companies, where trains go and where they start, with links to
 * those stations; a station with only a few trains lists them all. Nothing
 * without a timetable. */
export function StationTimetableSection({
  crs,
  name,
  timetable,
  nameOf,
}: {
  crs: string;
  name: string;
  timetable: TimetableSummary | null;
  nameOf: (code: string) => string | undefined;
}) {
  if (timetable === null) return null;
  const sentences = timetableSentences(name, timetable, nameOf);
  // A read that stopped short, or a list cut to the busiest places, is only
  // some of them: said as "include", not as the whole.
  const some = (places: PlaceCount[]) => timetable.truncated || places.length > PLACE_LIMIT;
  return (
    <Stack gap="xs" id="timetable">
      <SectionTitle>Trains from {name} today</SectionTitle>
      {sentences.length > 0 && <Text>{sentences.join(' ')}</Text>}
      {timetable.departures !== null && (
        <List spacing={4} aria-label={`Departures from ${name} today`}>
          {timetable.departures.map((departure, index) => {
            const company = departure.operator === null ? undefined : nameOf(departure.operator);
            return (
              <ListItem key={`${departure.time}-${departure.dayOffset}-${index}`}>
                <Text span fw={600}>
                  {departure.time}
                </Text>
                {departure.dayOffset > 0 ? ' after midnight' : ''}
                {departure.destinationName !== null && departure.destinationCrs !== null && (
                  <>
                    {' to '}
                    <TextLink href={`/stations/${departure.destinationCrs}`} inline underline="always">
                      {departure.destinationName}
                    </TextLink>
                  </>
                )}
                {company !== undefined && <Text span c="dimmed">{` (${company})`}</Text>}
              </ListItem>
            );
          })}
        </List>
      )}
      {timetable.departures === null && (
        <>
          <LinkSentence
            lead={some(timetable.destinations) ? 'Destinations include ' : 'Trains go to '}
            links={placeLinks(timetable.destinations)}
          />
          <LinkSentence
            lead={some(timetable.origins) ? 'Starting points include ' : 'Trains start from '}
            links={placeLinks(timetable.origins)}
          />
        </>
      )}
      <TextLink href={stationDeparturesHref(crs)}>Search trains from {name}</TextLink>
    </Stack>
  );
}
