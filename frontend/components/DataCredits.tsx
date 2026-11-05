import { Stack, Text } from '@mantine/core';
import type { ReactNode } from 'react';
import { TextLink } from './TextLink';
import { NATIONAL_RAIL_URL } from './NationalRailCredit';
import { TFL_CREDIT, TFL_STOPS_ATTRIBUTION } from '@/lib/tflAttribution';
import { KNOWLEDGEBASE_INCIDENTS_STATEMENT, NRIL_LICENCE_URL, NRIL_STATEMENT, RSP_STATEMENT } from '@/lib/creditText';

export {
  KNOWLEDGEBASE_INCIDENTS_STATEMENT,
  NATIONAL_RAIL_STATEMENT,
  NRIL_LICENCE_URL,
  NRIL_STATEMENT,
  RSP_STATEMENT,
} from '@/lib/creditText';

/** The in-place data credits: each source's statement, in the wording its
 * licence requires, beside the data it covers. Since the site footer
 * stopped carrying the short credit lines (`OpenDataAttribution.tsx` has
 * the reasoning and the per-licence record), every page that shows a
 * provider's data renders that provider's credit here, and
 * `app/dataCredits.test.ts` fails for a page that renders neither this nor
 * one of the other credit notes.
 *
 * `/attribution`'s `DATA_SOURCES` render the same statements, so the
 * wording can't drift between the two. Kept free of server-only imports so
 * client components can render it too. Do not paraphrase a statement. */

export const OGL_V3_URL = 'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/';
export const CC_BY_4_URL = 'https://creativecommons.org/licenses/by/4.0/';
export const RAIL_DELIVERY_GROUP_URL = 'https://www.raildeliverygroup.com';

/** A credit or licence link. `tone="inherit"`: it sits in dimmed or
 * statement text whose wording is licence text, so it keeps that colour
 * and is marked by its underline (docs/style-guide.md "TextLink").
 * `external`: it opens a new tab, so it carries the `ExternalLinkIcon` and
 * "(opens in a new tab)", after the link text, which stays verbatim. */
export function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <TextLink href={href} external underline="always" inline tone="inherit">
      {children}
    </TextLink>
  );
}

/** Every in-place credit, by id. The ids that match a `DATA_SOURCES` entry
 * are that entry's statement. */
export const CREDITS = {
  /** Darwin (live departures, and the samples behind National Rail line
   * status) and Knowledgebase Stations (station information). */
  'national-rail': (
    <>
      <ExternalLink href={NATIONAL_RAIL_URL}>powered by NationalRail</ExternalLink>
      {' (Train Information Services Ltd)'}
    </>
  ),
  /** TRUST train movements (train tracking and full-coverage line status). */
  'network-rail': <ExternalLink href={NRIL_LICENCE_URL}>{NRIL_STATEMENT}</ExternalLink>,
  /** The CIF timetable: scheduled services and calling points. */
  'rsp-timetable': (
    <>
      {RSP_STATEMENT} (<ExternalLink href={RAIL_DELIVERY_GROUP_URL}>Rail Delivery Group</ExternalLink>)
    </>
  ),
  /** TfL's line status and arrivals. */
  tfl: TFL_CREDIT,
  /** TfL's stop names and locations, which also need the mapping
   * statements (`lib/tflAttribution.ts`). */
  'tfl-stops': TFL_STOPS_ATTRIBUTION,
  /** Knowledgebase incidents (Rail Delivery Group). */
  'knowledgebase-incidents': KNOWLEDGEBASE_INCIDENTS_STATEMENT,
  'nta-gtfs': (
    <>
      Irish Rail timetable data ©{' '}
      <ExternalLink href="https://www.nationaltransport.ie">National Transport Authority</ExternalLink>, licensed under{' '}
      <ExternalLink href={CC_BY_4_URL}>CC BY 4.0</ExternalLink>. The GTFS data is provided &quot;as is&quot;, without
      warranty of any kind.
    </>
  ),
  'irish-rail-realtime': (
    <>
      Live Irish Rail data from <ExternalLink href="https://api.irishrail.ie/realtime/">Iarnród Éireann</ExternalLink>,
      provided &quot;as is&quot;.
    </>
  ),
  opendatani: (
    <>
      Contains public sector information licensed under the{' '}
      <ExternalLink href={OGL_V3_URL}>Open Government Licence v3.0</ExternalLink>. Translink data from{' '}
      <ExternalLink href="https://www.opendatani.gov.uk">OpenDataNI</ExternalLink>.
    </>
  ),
  /** OGL v3.0's default statement, for a tram network's data shown outside
   * its own pages (a pinned tram line on the home page). */
  ogl: (
    <>
      Contains public sector information licensed under the{' '}
      <ExternalLink href={OGL_V3_URL}>Open Government Licence v3.0</ExternalLink>.
    </>
  ),
} as const satisfies Record<string, ReactNode>;

export type CreditId = keyof typeof CREDITS;

/** What a train's page shows: its timetable (CIF), its movements (TRUST)
 * and Darwin's live samples (skipped stops, platforms, estimates). */
export const TRAIN_CREDITS = ['national-rail', 'network-rail', 'rsp-timetable'] as const satisfies readonly CreditId[];

/** A journey's credits: its trains', plus TfL's stop statements when an
 * untracked leg starts or ends at a TfL stop picked from TfL's list. */
export function journeyCredits(
  legs: readonly { kind: string; originStopId?: string | null; destinationStopId?: string | null }[],
): CreditId[] {
  const tflStops = legs.some((leg) => leg.kind === 'untracked' && (leg.originStopId || leg.destinationStopId));
  return [...TRAIN_CREDITS, ...(tflStops ? (['tfl-stops'] as const) : [])];
}

/** TfL's lines (`tfl-` ids, as `common::TFL_LINE_ID_PREFIX`). */
export function isTflLine(id: string): boolean {
  return id.startsWith('tfl-');
}

/** The credits a set of lines' status needs: TfL's for a TfL line; for
 * every other line, Darwin's samples and TRUST's movements, which the
 * status is worked out from (the api's Atom feeds credit the same). */
export function lineCredits(lineIds: Iterable<string>): CreditId[] {
  let tfl = false;
  let nationalRail = false;
  for (const id of lineIds) {
    if (isTflLine(id)) tfl = true;
    else nationalRail = true;
  }
  return [...(nationalRail ? (['national-rail', 'network-rail'] as const) : []), ...(tfl ? (['tfl'] as const) : [])];
}

/** The credits for `credits` (deduplicated, in the order given), each on
 * its own line, then a link to the full credits. Renders nothing for an
 * empty list. Placed directly under the data it covers. */
export function DataCredits({ credits }: { credits: readonly (CreditId | false | null | undefined)[] }) {
  const ids = [...new Set(credits.filter((id): id is CreditId => typeof id === 'string'))];
  if (ids.length === 0) return null;
  return (
    <Stack gap={4} data-data-credits>
      {ids.map((id) => (
        <Text key={id} size="xs" c="dimmed" data-credit={id}>
          {CREDITS[id]}
        </Text>
      ))}
      <Text size="xs" c="dimmed">
        <TextLink href="/attribution" tone="inherit" underline="always" inline>
          Data credits
        </TextLink>
      </Text>
    </Stack>
  );
}
