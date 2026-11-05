import { formatDate } from './dateFormat';
import type {
  IslandOfIrelandDepartureResponse,
  IslandOfIrelandLineResponse,
  IslandOfIrelandNetwork,
  IslandOfIrelandStationResponse,
  IslandOfIrelandTrainCall,
  IslandOfIrelandTrainResponse,
  LastLocation,
} from './irelandTypes';
import type { LineDiagram } from './transitLineDiagram';

/** The island of Ireland pages (`/island-of-ireland`): Iarnród Éireann
 * and NI Railways. Pure helpers, safe in Client Components.
 * docs/superpowers/specs/2026-11-04-island-of-ireland-pages-design.md. */

export type IrelandStation = IslandOfIrelandStationResponse;
export type IrelandLine = IslandOfIrelandLineResponse;
export type IrelandDeparture = IslandOfIrelandDepartureResponse;
export type IrelandTrain = IslandOfIrelandTrainResponse;
export type { IslandOfIrelandNetwork };

/** The section's address, and its h1, title and link text. "Ireland" alone
 * would read as the Republic only (design §5). */
export const IRELAND_PATH = '/island-of-ireland';
export const IRELAND_LABEL = 'Ireland and Northern Ireland';

export interface IrelandNetworkInfo {
  /** The api's `network`. */
  network: IslandOfIrelandNetwork;
  /** The path segment: the operator's name, not the jurisdiction. */
  slug: string;
  /** The operator's name, as it calls itself. Not a GB operator: no ATOC
   * code, so never in the `tocs` list. */
  name: string;
}

/** Both networks, in page order. */
export const IRELAND_NETWORKS: readonly IrelandNetworkInfo[] = [
  { network: 'republic-of-ireland', slug: 'iarnrod-eireann', name: 'Iarnród Éireann' },
  { network: 'northern-ireland', slug: 'ni-railways', name: 'NI Railways' },
];

export function networkBySlug(slug: string): IrelandNetworkInfo | null {
  return IRELAND_NETWORKS.find((info) => info.slug === slug) ?? null;
}

/** The display info for an api `network`; `null` for a value this app
 * doesn't know (a newer api). */
export function networkInfo(network: string): IrelandNetworkInfo | null {
  return IRELAND_NETWORKS.find((info) => info.network === network) ?? null;
}

/** A station or line id as a path segment: the api's ids are short and
 * plain (`8220IR0007`, `nir-bangor`, `DUB-BFT`); a corridor id can carry a
 * `/` (`DUB-DRO/DUN`), sent encoded. Checked before asking the api so a
 * malformed URL 404s at once. */
export const IRELAND_ID = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,63}$/;

export function irelandNetworkHref(slug: string): string {
  return `${IRELAND_PATH}/${slug}`;
}

export function irelandLineHref(slug: string, lineId: string): string {
  return `${IRELAND_PATH}/${slug}/lines/${encodeURIComponent(lineId)}`;
}

export function irelandStationHref(slug: string, stationId: string): string {
  return `${IRELAND_PATH}/${slug}/stations/${encodeURIComponent(stationId)}`;
}

/** A live station code (`CNLLY`), as the track route takes it. */
export const IRELAND_STATION_CODE = /^[A-Za-z0-9]{1,12}$/;

/** An Iarnród Éireann train's page: its code and the day it started
 * (docs/superpowers/specs/2026-11-05-irish-rail-train-tracking-design.md
 * §9). Only Iarnród Éireann has live boards, so only it has train pages.
 * `from`, the live code of the board the visitor came from, rides along
 * as `?from=` so "Track this train" can say where they board. */
export function irelandTrainHref(slug: string, trainCode: string, serviceDate: string, from?: string | null): string {
  const path = `${IRELAND_PATH}/${slug}/trains/${encodeURIComponent(trainCode)}/${serviceDate}`;
  const code = from?.trim() ?? '';
  return IRELAND_STATION_CODE.test(code) ? `${path}?from=${encodeURIComponent(code.toUpperCase())}` : path;
}

/** The page of a tracked Irish train, from an api row's `irishTrain`. */
export function irishTrainHref(train: { trainCode: string; serviceDate: string }): string {
  return irelandTrainHref('iarnrod-eireann', train.trainCode, train.serviceDate);
}

/** Dublin's date at `now`, `YYYY-MM-DD`: Irish trains' service dates are
 * Dublin's. */
export function dublinToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Dublin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** Whether a train of `serviceDate` can be tracked at `now`: the api takes
 * Dublin's today or yesterday (a train seen on a board, still running or
 * just run). */
export function isTrackableIrishDate(serviceDate: string, now: Date = new Date()): boolean {
  const today = dublinToday(now);
  const yesterday = dublinToday(new Date(Date.parse(`${today}T12:00:00Z`) - 24 * 60 * 60 * 1000));
  return serviceDate === today || serviceDate === yesterday;
}

/** A train code as the api takes it (`A120`, `E101`). */
export const IRELAND_TRAIN_CODE = /^[A-Za-z0-9]{1,8}$/;

/** A service date in a URL, `YYYY-MM-DD`. */
export const IRELAND_SERVICE_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A station's page, by its api `network`; `null` for an unknown network. */
export function stationHref(station: Pick<IrelandStation, 'id' | 'network'>): string | null {
  const info = networkInfo(station.network);
  return info ? irelandStationHref(info.slug, station.id) : null;
}

/** Whether to ask for a station's live board: only Iarnród Éireann has
 * live times, and only a station with a live code has a board. A code can
 * be missing for a while after a deploy, until the live poller has run;
 * the page then says there is no board. */
export function mayHaveLiveBoard(station: Pick<IrelandStation, 'network' | 'liveCode'>): boolean {
  return station.network === 'republic-of-ireland' && typeof station.liveCode === 'string';
}

/** Stations by id. */
export function stationsById(stations: readonly IrelandStation[]): Map<string, IrelandStation> {
  return new Map(stations.map((station) => [station.id, station]));
}

/** A line's stations in order, as `{ id, name }`; ids the catalogue
 * doesn't have are left out (never shown raw). */
export function lineStations(
  line: Pick<IrelandLine, 'stations'>,
  byId: ReadonlyMap<string, IrelandStation>,
): { id: string; name: string }[] {
  return line.stations.flatMap((id) => {
    const station = byId.get(id);
    return station ? [{ id: station.id, name: station.name }] : [];
  });
}

/** "Dublin Connolly to Belfast": a line's ends, or `null` when it has
 * fewer than two known stations. */
export function lineEnds(
  line: Pick<IrelandLine, 'stations'>,
  byId: ReadonlyMap<string, IrelandStation>,
): string | null {
  const stops = lineStations(line, byId);
  const first = stops[0];
  const last = stops[stops.length - 1];
  if (!first || !last || first.id === last.id) return null;
  return `${first.name} to ${last.name}`;
}

/** The lines that call at `stationId`, in the order given. */
export function linesAt(lines: readonly IrelandLine[], stationId: string): IrelandLine[] {
  return lines.filter((line) => line.stations.includes(stationId));
}

/** A line's colour for its swatch (`TransitLineSwatch`): `#RRGGBB` from
 * the api, else `null` (the neutral swatch). Only a well-formed colour is
 * used, since it goes into a style. */
export function lineSwatch(line: Pick<IrelandLine, 'color'>): { colour: string | null } {
  const colour = line.color ?? null;
  return { colour: colour && /^#[0-9A-Fa-f]{6}$/.test(colour) ? colour : null };
}

/** A station's live board: its departures, and when it was polled. */
export interface IrelandBoard {
  departures: IrelandDeparture[];
  /** RFC 3339; `null` when the api doesn't say. */
  polledAt: string | null;
}

/** One row of a live board, as the station page shows it. */
export interface DepartureRow {
  key: string;
  /** The time it is expected to leave, `HH:MM`. */
  time: string;
  /** The timetabled time, when it differs from `time`. */
  scheduled: string | null;
  destination: string;
  origin: string;
  trainCode: string;
  /** Minutes late, or `null` when the train isn't reporting: the feed's
   * `Late` is 0 then, which doesn't mean on time ({@link reportedLateMinutes}). */
  lateMinutes: number | null;
  /** The train's page, when the board says which day it started. */
  href: string | null;
}

const CLOCK = /^\d{2}:\d{2}$/;

/** The feed's status word for a train that is reporting. */
const EN_ROUTE = 'en route';

/** A board row's delay, only when the feed vouches for it: the train is
 * "En Route" or has a last location, as the api's `train_state` reads it.
 * "No Information" comes with `Late` 0, which is no report, not on time. */
export function reportedLateMinutes(
  departure: Pick<IrelandDeparture, 'status' | 'lastLocation' | 'lateMinutes'>,
): number | null {
  const reporting = departure.status.trim().toLowerCase() === EN_ROUTE || Boolean(departure.lastLocation?.trim());
  return reporting && Number.isFinite(departure.lateMinutes) ? departure.lateMinutes : null;
}

/** A live board's departures, in the api's order (soonest first). A train
 * with no departure time ends its run here, so it is left out. A row links
 * to its train's page when the board gives the day it started, carrying
 * `fromStation` (this board's live code) along. */
export function departureRows(
  departures: readonly IrelandDeparture[],
  fromStation: string | null = null,
): DepartureRow[] {
  const slug = networkInfo('republic-of-ireland')?.slug ?? null;
  return departures.flatMap((departure, index) => {
    const scheduled = departure.scheduledDeparture?.trim() ?? '';
    const expected = departure.expectedDeparture?.trim() ?? '';
    const time = CLOCK.test(expected) ? expected : scheduled;
    if (!CLOCK.test(time)) return [];
    const trainCode = departure.trainCode.trim();
    const trainDate = departure.trainDate ?? null;
    const linkable = slug && trainDate && IRELAND_SERVICE_DATE.test(trainDate) && IRELAND_TRAIN_CODE.test(trainCode);
    return [
      {
        key: `${departure.trainCode}-${index}`,
        time,
        scheduled: CLOCK.test(scheduled) && scheduled !== time ? scheduled : null,
        destination: departure.destination.trim(),
        origin: departure.origin.trim(),
        trainCode,
        lateMinutes: reportedLateMinutes(departure),
        href: linkable ? irelandTrainHref(slug, trainCode, trainDate, fromStation) : null,
      },
    ];
  });
}

/** How we name an Irish train, as a GB one: "15:50 Dublin Connolly to
 * Belfast", or the route alone when the boards didn't give its start
 * time. */
export function irelandTrainName(train: Pick<IrelandTrain, 'originTime' | 'origin' | 'destination'>): string {
  const route = `${train.origin.trim()} to ${train.destination.trim()}`;
  const start = train.originTime?.trim() ?? '';
  return CLOCK.test(start) ? `${start} ${route}` : route;
}

/** The dimmed line under the name: "Train code A120 · 5 Nov 2026". */
export function irelandTrainIdentifiers(train: Pick<IrelandTrain, 'trainCode' | 'serviceDate'>): string {
  return `Train code ${train.trainCode} · ${formatDate(`${train.serviceDate}T12:00:00Z`)}`;
}

/** The feed's last report in our words: "Left Dundalk", "At Dundalk". */
export function lastLocationText(location: LastLocation | null): string | null {
  if (!location) return null;
  return location.event === 'departed' ? `Left ${location.place}` : `At ${location.place}`;
}

/** One calling point on the train page. */
export interface TrainCallRow {
  key: string;
  /** The expected time there, else the timetabled one; `HH:MM`. */
  time: string | null;
  /** The timetabled time, when it differs from `time`. */
  scheduled: string | null;
  /** The train ends its run here (the board gave only an arrival). */
  arrivalOnly: boolean;
  name: string;
  /** The station's page, when it is in the catalogue. */
  href: string | null;
}

function clock(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return CLOCK.test(trimmed) ? trimmed : null;
}

/** The train's calling points, in the api's running order. A station
 * neither the catalogue nor the live list names is left out (never shown
 * as a raw code). */
export function trainCallRows(train: Pick<IrelandTrain, 'calls'>, slug: string): TrainCallRow[] {
  return train.calls.flatMap((call: IslandOfIrelandTrainCall) => {
    const name = call.name?.trim();
    if (!name) return [];
    const departs = clock(call.expectedDeparture) ?? clock(call.scheduledDeparture);
    const arrives = clock(call.expectedArrival) ?? clock(call.scheduledArrival);
    const time = departs ?? arrives;
    const scheduledHere = departs ? clock(call.scheduledDeparture) : clock(call.scheduledArrival);
    return [
      {
        key: call.stationCode,
        time,
        scheduled: scheduledHere && scheduledHere !== time ? scheduledHere : null,
        arrivalOnly: departs === null && arrives !== null,
        name,
        href: call.stationId && IRELAND_ID.test(call.stationId) ? irelandStationHref(slug, call.stationId) : null,
      },
    ];
  });
}

/** The stations whose names match `needle` (already `searchKey`ed), with
 * their page. */
export function matchingStations(
  stations: readonly IrelandStation[],
  needle: string,
  key: (text: string) => string,
): { station: IrelandStation; href: string; networkName: string }[] {
  if (!needle) return [];
  return stations.flatMap((station) => {
    const info = networkInfo(station.network);
    if (!info || !IRELAND_ID.test(station.id) || !key(station.name).includes(needle)) return [];
    return [{ station, href: irelandStationHref(info.slug, station.id), networkName: info.name }];
  });
}

/** A line's one stopping pattern as a route strip (`TransitLineDiagram`):
 * the stations in order, both ends marked, no branches. */
export function irelandLineDiagram(stops: readonly { id: string; name: string }[]): LineDiagram {
  const last = stops.length - 1;
  return {
    stops: stops.map((station, index) => ({ station, terminus: index === 0 || index === last, spurs: [] })),
    separate: [],
    others: [],
    from: stops[0] ?? null,
    to: stops[last] ?? null,
  };
}

function count(n: number, one: string, other: string): string {
  return `${n} ${n === 1 ? one : other}`;
}

/** How many of `stations` have a live board. */
export function liveBoardCount(stations: readonly Pick<IrelandStation, 'network' | 'liveCode'>[]): number {
  return stations.filter(mayHaveLiveBoard).length;
}

/** A network's card line on the overview: "18 lines, 152 stations. Live
 * departures at 140 stations." or "... Stations and lines only." */
export function networkSummary(
  stations: readonly Pick<IrelandStation, 'network' | 'liveCode'>[],
  lineCount: number,
): string {
  const sizes = `${count(lineCount, 'line', 'lines')}, ${count(stations.length, 'station', 'stations')}.`;
  const live = liveBoardCount(stations);
  if (live === 0) return `${sizes} Stations and lines only.`;
  return `${sizes} Live departures at ${count(live, 'station', 'stations')}.`;
}

/** What a network's page says we have, under its h1. */
export function networkNotice(
  info: IrelandNetworkInfo,
  stations: readonly Pick<IrelandStation, 'network' | 'liveCode'>[],
): string {
  if (info.network === 'northern-ireland') {
    return `Lines and stations. We don't have live ${info.name} times or line status.`;
  }
  const live = liveBoardCount(stations);
  const times =
    live === 0 ? `We don't have live ${info.name} times yet` : 'Station pages show live departures where we have them';
  return `Lines and stations from the published timetable. ${times}. We don't show line status for ${info.name}.`;
}
