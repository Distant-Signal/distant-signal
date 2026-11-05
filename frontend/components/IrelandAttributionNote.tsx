import { DataCredits } from '@/components/DataCredits';
import type { IslandOfIrelandNetwork } from '@/lib/ireland';

/** Which credits cover each kind of Irish data (LEG-20, LEG-21): the NTA's
 * timetable for Iarnród Éireann's stations and lines, Iarnród Éireann's
 * own realtime data for its live boards, and Translink's data via
 * OpenDataNI for NI Railways'. Each id is also its `/attribution` entry's. */
export const IRELAND_CREDIT_IDS = {
  'republic-of-ireland': 'nta-gtfs',
  'northern-ireland': 'opendatani',
  live: 'irish-rail-realtime',
} as const;

export type IrelandCredit = keyof typeof IRELAND_CREDIT_IDS;

/** The data credits at the foot of an island of Ireland page: each
 * source's statement exactly as `/attribution` gives it (the same
 * `CREDITS` entry, so the licence wording can't drift), then a link to the
 * full credits. */
export function IrelandAttributionNote({ credits }: { credits: readonly (IslandOfIrelandNetwork | 'live')[] }) {
  return <DataCredits credits={credits.map((credit) => IRELAND_CREDIT_IDS[credit])} />;
}
