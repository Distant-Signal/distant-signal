import { notFound } from 'next/navigation';
import { getIrelandLines, getIrelandStations } from './api';
import {
  IRELAND_ID,
  IRELAND_NETWORKS,
  type IrelandLine,
  type IrelandNetworkInfo,
  type IrelandStation,
  networkBySlug,
} from './ireland';

/** Server-side loading for the island of Ireland pages. Both lists are
 * hour-cached fetches, so each page's metadata and body share them. */

export interface IrelandNetworkData {
  info: IrelandNetworkInfo;
  stations: IrelandStation[];
  lines: IrelandLine[];
}

/** Every network that has any stations, in page order, with its stations
 * and lines; not found when none has (the feeds are off). A failed fetch
 * throws, to the page's error boundary. */
export async function loadIreland(): Promise<IrelandNetworkData[]> {
  const [stations, lines] = await Promise.all([getIrelandStations(), getIrelandLines()]);
  const networks = IRELAND_NETWORKS.map((info) => ({
    info,
    stations: stations.filter((station) => station.network === info.network),
    lines: lines.filter((line) => line.network === info.network),
  })).filter((network) => network.stations.length > 0);
  if (networks.length === 0) notFound();
  return networks;
}

/** One network's data by its path segment; not found for an unknown slug or
 * a network with no stations. */
export async function loadIrelandNetwork(slug: string): Promise<IrelandNetworkData> {
  if (!networkBySlug(slug)) notFound();
  const network = (await loadIreland()).find((candidate) => candidate.info.slug === slug);
  if (!network) notFound();
  return network;
}

/** A path segment as the api's id: Next hands it over still encoded when
 * it holds an encoded `/` (`DUB-DRO%2FDUN`). Not found when it isn't an id. */
export function idFromSegment(segment: string): string {
  let id: string;
  try {
    id = decodeURIComponent(segment);
  } catch {
    notFound();
  }
  if (!IRELAND_ID.test(id)) notFound();
  return id;
}
