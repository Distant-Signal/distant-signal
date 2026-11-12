import type { StationIndexEntry } from './types';

/** The A to Z of station pages (`/stations/a-z`): a station's CRS code is
 * three letters, so its first letter splits ~2,600 stations into 26 pages
 * of at most a few hundred links each (`/stations/k`). These pages exist
 * so every station page is reachable by plain links, not only by the
 * sitemap or the search box.
 *
 * They are served by `app/stations/[crs]/page.tsx` (a CRS is never one
 * letter, nor `a-z`) rather than routes of their own: every page route is
 * on the api's usage-event allowlist (`lib/usageEvents.ts`), which the api
 * owns, so a new route needs an api release first. */

/** A letter segment of `/stations/[letter]`: one lower-case letter. */
export const STATION_LETTER = /^[a-z]$/;

/** The index's segment under `/stations`. */
export const STATION_INDEX_SEGMENT = 'a-z';

/** The A to Z index. */
export const STATION_BROWSE_PATH = `/stations/${STATION_INDEX_SEGMENT}`;

export function stationBrowseHref(letter: string): string {
  return `/stations/${letter.toLowerCase()}`;
}

/** Whether `/stations/<segment>` is one of the A to Z pages, not a station. */
export function isStationBrowseSegment(segment: string): boolean {
  return segment === STATION_INDEX_SEGMENT || STATION_LETTER.test(segment);
}

/** The stations grouped by the first letter of their code (`a` to `z`),
 * each group sorted by code. Entries whose code is not three letters (the
 * api lists only CRS codes, but a stray one must not make a page that has no
 * station) are dropped, and a repeated code keeps its first entry. Codes are
 * upper-cased. */
export function groupStations(stations: readonly StationIndexEntry[]): Map<string, StationIndexEntry[]> {
  const groups = new Map<string, StationIndexEntry[]>();
  const seen = new Set<string>();
  for (const station of stations) {
    const crs = station.crs.toUpperCase();
    if (!/^[A-Z]{3}$/.test(crs) || seen.has(crs)) continue;
    seen.add(crs);
    const letter = crs.slice(0, 1).toLowerCase();
    const entry = { ...station, crs };
    const group = groups.get(letter);
    if (group) group.push(entry);
    else groups.set(letter, [entry]);
  }
  for (const group of groups.values()) group.sort((a, b) => (a.crs < b.crs ? -1 : 1));
  return groups;
}

/** The letters that have stations, A to Z. */
export function stationLetters(stations: readonly StationIndexEntry[]): string[] {
  return [...groupStations(stations).keys()].sort();
}
