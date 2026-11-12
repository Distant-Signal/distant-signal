import type { StationAccessibilityData, TrainSearchPage } from './types';
import type { JsonValue } from './api-types';
import { joinNames } from './plannerOperators';

/** Facts for a station page's prose and description, worked out from reads
 * the page already makes or can make through the api's cached public
 * routes. Nothing here is invented: every field is `null`, empty or absent
 * unless the source says it, and the prose builders skip what is absent. */

/** How many departures one timetable read asks for: the search's own
 * ceiling (`MAX_SEARCH_LIMIT`). A station with more has a `nextCursor`, and
 * the facts then say "more than" instead of counting. */
export const STATION_TIMETABLE_LIMIT = 200;

/** A day with this many departures or fewer is listed in full on the page;
 * a busier one gets the where-to summary instead. */
export const SMALL_STATION_DEPARTURES = 12;

export interface TimetableDeparture {
  /** Public departure, `HH:MM`. */
  time: string;
  /** Days after the service date (`1`: after midnight). */
  dayOffset: number;
  destinationCrs: string | null;
  destinationName: string | null;
  operator: string | null;
}

export interface PlaceCount {
  crs: string;
  name: string;
  count: number;
}

export interface TimetableSummary {
  /** The service date the timetable is for, `YYYY-MM-DD`. */
  date: string;
  /** Passenger train departures read (at most `STATION_TIMETABLE_LIMIT`). */
  trainCount: number;
  /** More departures exist than were read, so counts are lower bounds and
   * there is no known last train. */
  truncated: boolean;
  first: TimetableDeparture;
  /** `null` when the read stopped short of the day's end. */
  last: TimetableDeparture | null;
  operators: { code: string; count: number }[];
  /** Where those trains terminate, most trains first, this station left out. */
  destinations: PlaceCount[];
  /** Where they start, most trains first, this station left out. */
  origins: PlaceCount[];
  /** Every departure, only while the day is small enough to list. */
  departures: TimetableDeparture[] | null;
}

function tally(counts: Map<string, number>): [string, number][] {
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

/** Reduces one day's search page for `crs` (`GET /public/trains/search`
 * with just `station`, from midnight) to what the page says. Only passenger
 * train departures count: a row with no public departure time is a working
 * stop, and rail replacement buses and ferries are not trains. `null` when
 * nothing is left. */
export function summariseTimetable(page: TrainSearchPage, crs: string): TimetableSummary | null {
  const here = crs.toUpperCase();
  const departures: TimetableDeparture[] = [];
  const operators = new Map<string, number>();
  const destinations = new Map<string, { name: string; count: number }>();
  const origins = new Map<string, { name: string; count: number }>();

  for (const row of page.results) {
    if (row.serviceMode !== 'train' || row.publicDeparture === null || row.scheduled === null) continue;
    departures.push({
      time: row.scheduled,
      dayOffset: row.dayOffset ?? 0,
      destinationCrs: row.destinationCrs,
      destinationName: row.destinationName,
      operator: row.operator,
    });
    if (row.operator) operators.set(row.operator, (operators.get(row.operator) ?? 0) + 1);
    const places: [Map<string, { name: string; count: number }>, string | null, string | null][] = [
      [destinations, row.destinationCrs, row.destinationName],
      [origins, row.originCrs, row.originName],
    ];
    for (const [map, code, name] of places) {
      if (!code || !name || code.toUpperCase() === here) continue;
      const existing = map.get(code);
      map.set(code, { name, count: (existing?.count ?? 0) + 1 });
    }
  }

  const first = departures[0];
  if (first === undefined) return null;
  const truncated = page.nextCursor !== null;
  const ranked = (map: Map<string, { name: string; count: number }>): PlaceCount[] =>
    [...map.entries()]
      .map(([code, value]) => ({ crs: code, name: value.name, count: value.count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  return {
    date: page.serviceDate,
    trainCount: departures.length,
    truncated,
    first,
    last: truncated ? null : (departures[departures.length - 1] ?? null),
    operators: tally(operators).map(([code, count]) => ({ code, count })),
    destinations: ranked(destinations),
    origins: ranked(origins),
    departures: !truncated && departures.length <= SMALL_STATION_DEPARTURES ? departures : null,
  };
}

// ---------------------------------------------------------------------------
// Facilities and accessibility
// ---------------------------------------------------------------------------

export interface StationFacts {
  /** The step-free category the feed gives: `B2`, and its own wording. */
  stepFree: { code: string; description: string | null } | null;
  platforms: number | null;
  /** Facilities the feed says are there (never one it says are absent). */
  facilities: string[];
}

function record(value: JsonValue | undefined): Record<string, JsonValue> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function available(value: JsonValue | undefined): boolean {
  const node = record(value);
  return node !== null && node.available === true;
}

/** `A, Compliant step-free access to all platform(s)` -> code `A` and the
 * description, with the feed's `(s)` hedge written out. A string with no
 * leading code gives no category. */
export function parseStepFreeCategory(raw: string): { code: string; description: string | null } | null {
  const match = /^([A-Z][0-9]?)\s*(?:[,:.-]\s*(.*))?$/s.exec(raw.trim());
  if (match === null) return null;
  const code = match[1];
  if (code === undefined) return null;
  const text = (match[2] ?? '').replace(/platform\(s\)/gi, 'platforms').trim();
  const description = text !== '' && text.length <= 120 ? text.charAt(0).toLowerCase() + text.slice(1) : null;
  return { code, description };
}

export function stationFacts(data: StationAccessibilityData): StationFacts {
  const access = record(data.stationAccessibility);
  const category = record(access?.stepFreeCategory);
  const rawCategory = category?.category;
  const stepFree = typeof rawCategory === 'string' ? parseStepFreeCategory(rawCategory) : null;

  const platformCount = record(data.platformFacilities)?.numberOfPlatforms;
  const platforms =
    typeof platformCount === 'number' && Number.isInteger(platformCount) && platformCount > 0 ? platformCount : null;

  const facilities: string[] = [];
  if (available(data.lifts)) facilities.push('lifts');
  const toilets = record(record(data.toiletsAndChanging)?.toilets);
  if (toilets?.available === true)
    facilities.push(toilets.accessibleToiletsAvailable === true ? 'accessible toilets' : 'toilets');
  if (available(record(data.stationFacilities)?.wifi)) facilities.push('Wi-Fi');
  if (record(data.cycling)?.cycleStorageAvailable === true) facilities.push('cycle storage');
  if (record(data.carParks)?.parkingSpacesAvailable === true) facilities.push('a car park');
  const links = record(data.transportLinks);
  if (available(links?.underground)) facilities.push('an Underground connection');
  if (available(links?.airport)) facilities.push('an airport link');
  if (available(links?.bus)) facilities.push('a bus link');
  return { stepFree, platforms, facilities };
}

// ---------------------------------------------------------------------------
// Prose
// ---------------------------------------------------------------------------

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** `after midnight` for a departure on the next service-day morning. */
function clock(departure: TimetableDeparture): string {
  return departure.dayOffset > 0 ? `${departure.time} after midnight` : departure.time;
}

/** "A runs 143 of them and B 57", "A runs 90 of them, B 40 and C 12, and
 * three other train companies run the rest"; from a read that stopped
 * short, a plain "include" list instead, since the counts would be of a
 * part of the day. */
function operatorSentence(summary: TimetableSummary, nameOf: (code: string) => string | undefined): string | null {
  const named = summary.operators.flatMap((entry) => {
    const name = nameOf(entry.code);
    return name === undefined ? [] : [{ name, count: entry.count }];
  });
  if (named.length === 0) return null;
  if (summary.truncated) {
    const top = named.slice(0, 4).map((entry) => entry.name);
    return named.length === 1
      ? `They include trains run by ${top[0]}.`
      : `Train companies calling here include ${joinNames(top)}.`;
  }
  const [lead] = named;
  if (lead === undefined) return null;
  if (named.length === 1) {
    return lead.count === summary.trainCount
      ? `${summary.trainCount === 1 ? 'It is' : 'All of them are'} run by ${lead.name}.`
      : `${lead.name} runs ${lead.count} of them.`;
  }
  const shown = named.slice(0, 3);
  const rest = summary.operators.length - shown.length;
  const parts = shown.map((entry, index) =>
    index === 0 ? `${entry.name} runs ${entry.count} of them` : `${entry.name} ${entry.count}`,
  );
  const list = joinNames(parts);
  return rest > 0
    ? `${list}, and ${plural(rest, 'other train company runs', 'other train companies run')} the rest.`
    : `${list}.`;
}

/** The "Trains from X today" paragraph's sentences. Wording follows the
 * data (a day that is one train, a short day, a long one, a read that
 * stopped short). `nameOf` resolves a train company code to its name, or
 * `undefined` for an unknown one, which is then left out. */
export function timetableSentences(
  stationName: string,
  summary: TimetableSummary,
  nameOf: (code: string) => string | undefined,
): string[] {
  const { first, last, trainCount, truncated } = summary;
  const sentences: string[] = [];
  if (truncated) {
    sentences.push(
      `Today's timetable lists more than ${trainCount} departures from ${stationName}, the first at ${clock(first)}.`,
    );
  } else if (trainCount === 1) {
    sentences.push(`Only one train is timetabled to leave ${stationName} today, at ${clock(first)}.`);
  } else if (last !== null && summary.departures !== null) {
    sentences.push(
      `${stationName} has ${trainCount} departures in today's timetable, from ${clock(first)} to ${clock(last)}.`,
    );
  } else if (last !== null) {
    sentences.push(
      `${trainCount} trains are timetabled to leave ${stationName} today, the first at ${clock(first)} and the last at ${clock(last)}.`,
    );
  }
  const operators = operatorSentence(summary, nameOf);
  if (operators !== null) sentences.push(operators);
  return sentences;
}

/** The "About" paragraph's sentences from the reference data. The lines
 * that cover the station are the page's own job: they carry links. */
export function factSentences(stationName: string, facts: StationFacts): string[] {
  const sentences: string[] = [];
  if (facts.platforms !== null) {
    sentences.push(`${stationName} has ${plural(facts.platforms, 'platform', 'platforms')}.`);
  }
  if (facts.stepFree !== null) {
    sentences.push(
      facts.stepFree.description === null
        ? `Its step-free access category is ${facts.stepFree.code}.`
        : `Its step-free access category is ${facts.stepFree.code}: ${facts.stepFree.description}.`,
    );
  }
  if (facts.facilities.length > 0) {
    sentences.push(`The station information lists ${joinNames(facts.facilities)}.`);
  }
  return sentences;
}

/** The longest a page description runs (docs/style-guide.md: one plain
 * sentence, 20 words or fewer, at most 160 characters). */
const DESCRIPTION_MAX_WORDS = 20;
const DESCRIPTION_MAX_CHARACTERS = 160;

/** The station's `<meta name="description">`: one sentence of real facts
 * when the data has them, in priority order, dropping the last ones until it
 * fits, and the generic line when it has none. Evergreen: no counts or
 * times, which change by the day. */
export function stationDescription(
  heading: string,
  timetable: TimetableSummary | null,
  facts: StationFacts | null,
  nameOf: (code: string) => string | undefined,
): string {
  const generic = `Disruption, accessibility and departures for ${heading}.`;
  const names = timetable?.operators.flatMap((entry) => nameOf(entry.code) ?? []).slice(0, 3) ?? [];
  const places = timetable?.destinations.slice(0, 2).map((place) => place.name) ?? [];
  const parts: string[] = [];
  if (names.length > 0) parts.push(`served by ${joinNames(names)}`);
  if (places.length > 0) parts.push(`trains to ${joinNames(places)}`);
  if (facts?.stepFree) parts.push(`step-free access category ${facts.stepFree.code}`);
  if (facts?.platforms) parts.push(plural(facts.platforms, 'platform', 'platforms'));

  const sentence = (kept: string[]) => `${heading}: ${kept.join('; ')}.`;
  const fits = (text: string) =>
    text.split(/\s+/).length <= DESCRIPTION_MAX_WORDS && text.length <= DESCRIPTION_MAX_CHARACTERS;
  const kept = [...parts];
  while (kept.length > 0 && !fits(sentence(kept))) kept.pop();
  return kept.length === 0 ? generic : sentence(kept);
}
