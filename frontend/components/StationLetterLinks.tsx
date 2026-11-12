import { Group } from '@mantine/core';
import { ButtonLink } from './ButtonLink';
import { stationBrowseHref } from '@/lib/stationBrowse';

/** The A to Z row of `/stations/browse`: one link per letter that has
 * stations, in server-rendered HTML so a crawler follows each. `current`
 * marks the letter's own page. */
export function StationLetterLinks({ letters, current }: { letters: readonly string[]; current?: string }) {
  return (
    <Group component="nav" aria-label="Stations by first letter" gap="xs">
      {letters.map((letter) => (
        <ButtonLink
          key={letter}
          href={stationBrowseHref(letter)}
          variant={letter === current ? 'filled' : 'default'}
          size="sm"
        >
          {letter.toUpperCase()}
        </ButtonLink>
      ))}
    </Group>
  );
}
