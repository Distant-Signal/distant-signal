/** The A to Z of station pages (`/stations/browse`): a station's CRS code
 * is three letters, so its first letter splits ~2,800 stations into 26
 * pages of at most a few hundred links each. These pages exist so every
 * station page is reachable by plain links, not only by the sitemap or the
 * search box. */

/** A letter segment of `/stations/browse/[letter]`: one lower-case letter. */
export const STATION_LETTER = /^[a-z]$/;

/** The A to Z index. */
export const STATION_BROWSE_PATH = '/stations/browse';

export function stationBrowseHref(letter: string): string {
  return `${STATION_BROWSE_PATH}/${letter.toLowerCase()}`;
}

/** Station codes grouped by first letter (`a` to `z`), each group sorted.
 * Codes that are not three letters (the api lists only CRS codes, but a
 * stray one must not make a page that has no station) are dropped. */
export function groupStationCodes(codes: readonly string[]): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  for (const code of new Set(codes.map((raw) => raw.toUpperCase()))) {
    if (!/^[A-Z]{3}$/.test(code)) continue;
    const letter = code.slice(0, 1).toLowerCase();
    const group = groups.get(letter);
    if (group) group.push(code);
    else groups.set(letter, [code]);
  }
  for (const group of groups.values()) group.sort();
  return groups;
}

/** The letters that have stations, A to Z. */
export function stationLetters(codes: readonly string[]): string[] {
  return [...groupStationCodes(codes).keys()].sort();
}
