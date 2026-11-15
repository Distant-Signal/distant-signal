import { TFL_CREDIT } from './tflAttribution';

/** The data credits as plain text, for where no link can be drawn: the
 * live link-preview images (`renderStatusPreviewImage`). The page's own
 * credits (`components/DataCredits.tsx`) use the same strings. Do not
 * paraphrase. */

/** Darwin's and Knowledgebase Stations' prescribed strings, joined: they
 * share "NationalRail", so both stay intact (`OpenDataAttribution.tsx`). */
export const NATIONAL_RAIL_STATEMENT = 'powered by NationalRail (Train Information Services Ltd)';

/** Knowledgebase incidents carry no prescribed wording; their publisher is
 * credited by name, as the api's responses and feeds do. */
export const KNOWLEDGEBASE_INCIDENTS_STATEMENT = 'Incidents from the Knowledgebase, published by Rail Delivery Group.';

/** Network Rail's prescribed statement (LEG-19), and the licence its
 * wording points to: linked on the page, written out where no link can be
 * drawn (decision of 2026-11-05, DS-367). */
export const NRIL_STATEMENT =
  'Contains Information of Network Rail Infrastructure Limited licensed under the following licence';
export const NRIL_LICENCE_URL =
  'https://www.networkrail.co.uk/who-we-are/transparency-and-ethics/transparency/open-data-feeds/network-rail-infrastructure-limited-data-feeds-licence/';

/** The CIF timetable's credit (LEG-22). */
export const RSP_STATEMENT = 'Source: RSP';

/** The island of Ireland's credits (`IrelandAttributionNote`): the NTA's
 * timetable, Iarnród Éireann's realtime boards, and Translink's data via
 * OpenDataNI, with each licence's address written out. */
const NTA_STATEMENT =
  'Irish Rail timetable data © National Transport Authority, licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). The GTFS data is provided "as is", without warranty of any kind';
const IRISH_RAIL_REALTIME_STATEMENT = 'Live Irish Rail data from Iarnród Éireann, provided "as is"';
const OPENDATANI_STATEMENT =
  'Contains public sector information licensed under the Open Government Licence v3.0 (https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/). Translink data from OpenDataNI';

/** The credits a preview image can carry as text. Network Rail's statement
 * carries its licence's address written out, since an image can't link it
 * (the api's Atom feeds write it the same way). */
export const PLAIN_CREDITS = {
  'national-rail': NATIONAL_RAIL_STATEMENT,
  'network-rail': `${NRIL_STATEMENT}: ${NRIL_LICENCE_URL}`,
  'rsp-timetable': RSP_STATEMENT,
  tfl: TFL_CREDIT,
  'nta-gtfs': NTA_STATEMENT,
  'irish-rail-realtime': IRISH_RAIL_REALTIME_STATEMENT,
  opendatani: OPENDATANI_STATEMENT,
  'knowledgebase-incidents': KNOWLEDGEBASE_INCIDENTS_STATEMENT,
} as const;

export type PlainCreditId = keyof typeof PLAIN_CREDITS;

/** `ids` as one run of text, each once, in the order given, split by
 * " · " (a full stop after a written-out address would read as part of it). */
export function plainCredits(ids: readonly PlainCreditId[]): string {
  return [...new Set(ids)].map((id) => PLAIN_CREDITS[id].replace(/\.$/, '')).join(' · ');
}
