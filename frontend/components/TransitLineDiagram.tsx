import { Stack, Text } from '@mantine/core';
import { LinkSentence } from '@/components/LinkSentence';
import { TextLink } from '@/components/TextLink';
import { type DiagramSpur, type DiagramStop, type LineDiagram, spurLabel } from '@/lib/transitLineDiagram';
import { transitStopHref } from '@/lib/transitStops';
import classes from './TransitLineDiagram.module.css';

/** A line's stops drawn once, as a route strip (`buildLineDiagram`): the
 * main run top to bottom, each branch an indented strip under the stop
 * where it splits or joins, named ("Branch to Mill Hill East", "Via
 * Waterloo, rejoining at Euston"). Trains run both ways along it, so there
 * is no second list for the other direction.
 *
 * Markup: an ordered list of stops, each a link to the stop's page; a
 * branch is a group (named by its visible label) holding its own ordered
 * list, nested in the stop's item. The strip itself is CSS decoration.
 * Stations only a few trips call at, too few to draw, are listed after it. */
export function TransitLineDiagram({
  network,
  stopHref,
  diagram,
  colour,
  label,
  idPrefix,
}: {
  /** The transit network whose stop pages the stops link to. */
  network?: string;
  /** A stop's page, for a line that isn't a transit network's (an island
   * of Ireland line); overrides `network`. */
  stopHref?: (id: string) => string;
  diagram: LineDiagram;
  /** The line's colour, for the strip. */
  colour: string;
  /** The main list's accessible name ("Victoria stops, Brixton to Walthamstow Central"). */
  label: string;
  /** Unique on the page: the branch labels' ids start with it. */
  idPrefix: string;
}) {
  const hrefOf = stopHref ?? ((id: string) => transitStopHref(network ?? '', id));
  return (
    <Stack gap="sm" __vars={{ '--line-colour': colour }}>
      <Strip hrefOf={hrefOf} stops={diagram.stops} label={label} idPath={idPrefix} />
      {diagram.separate.map((spur, index) => (
        <Spur key={index} hrefOf={hrefOf} spur={spur} idPath={`${idPrefix}-s${index}`} />
      ))}
      <LinkSentence
        lead="Some trips also call at "
        links={diagram.others.map((station) => ({ href: hrefOf(station.id), label: station.name }))}
      />
    </Stack>
  );
}

function Strip({
  hrefOf,
  stops,
  label,
  idPath,
}: {
  hrefOf: (id: string) => string;
  stops: readonly DiagramStop[];
  label?: string;
  idPath: string;
}) {
  return (
    <ol className={classes.strip} aria-label={label}>
      {stops.map((stop, index) => (
        // A loop line passes a stop twice: the index keeps the keys apart.
        <li key={`${stop.station.id}-${index}`} className={classes.stop} data-terminus={stop.terminus || undefined}>
          <TextLink href={hrefOf(stop.station.id)}>
            {stop.terminus ? (
              <Text span fw={600} inherit>
                {stop.station.name}
              </Text>
            ) : (
              stop.station.name
            )}
          </TextLink>
          {stop.spurs.map((spur, spurIndex) => (
            <Spur key={spurIndex} hrefOf={hrefOf} spur={spur} idPath={`${idPath}-${index}-${spurIndex}`} />
          ))}
        </li>
      ))}
    </ol>
  );
}

function Spur({ hrefOf, spur, idPath }: { hrefOf: (id: string) => string; spur: DiagramSpur; idPath: string }) {
  const labelId = `${idPath}-label`;
  return (
    <div className={classes.spur} role="group" aria-labelledby={labelId} data-spur={spur.kind}>
      <Text id={labelId} size="sm" c="dimmed" fs="italic" className={classes.spurLabel}>
        {spurLabel(spur)}
      </Text>
      <Strip hrefOf={hrefOf} stops={spur.stops} idPath={idPath} />
    </div>
  );
}
