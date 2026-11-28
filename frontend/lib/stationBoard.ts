import { formatTime } from './dateFormat';
import { dayOffsetMarker } from './serviceStatus';
import type { StationBoard, StationBoardArrival, StationBoardDeparture } from './types';

/** How many departures the station page's board asks for. */
export const STATION_BOARD_LIMIT = 10;

/** The two boards: the services leaving the station or the ones arriving. */
export type BoardKind = 'departures' | 'arrivals';

/** A row of either board. The fields the platform and status cells read are
 * the same on both, so both boards share one cell implementation. */
export type BoardRowSource = StationBoardDeparture | StationBoardArrival;

/** `?board=`: `arrivals` for the arrivals board, anything else (junk, a
 * list, nothing) the departures board. */
export function parseBoardParam(raw: string | string[] | undefined): BoardKind {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === 'arrivals' ? 'arrivals' : 'departures';
}

/** The rows of the board the api answered with. */
export function boardRowsOf(board: StationBoard): readonly BoardRowSource[] {
  return board.board === 'arrivals' ? (board.arrivals ?? []) : board.departures;
}

/** A time with the "+1" marker the rest of the app puts after a time on a
 * later day than the service date. */
export interface BoardTime {
  text: string;
  marker: { short: string; spoken: string } | null;
}

/** What the platform cell says. `booked` is the timetable's platform with
 * no live word, `expected` one that is not yet confirmed (or may still
 * change) and `likely` a predicted one: each carries its word, for the eye and a screen reader, so
 * neither is read as a confirmed platform. */
export type BoardPlatformStatus = 'confirmed' | 'expected' | 'likely' | 'booked';

export type BoardPlatform =
  | { kind: 'platform'; label: string; spoken: string; status: BoardPlatformStatus; note: string | null }
  | { kind: 'toBeAnnounced'; text: string }
  | { kind: 'none'; spoken: string };

export type BoardStatusKind = 'onTime' | 'delayed' | 'cancelled' | 'booked';

export type BoardStatusTone = 'good' | 'neutral' | 'mild' | 'late' | 'severe';

/** From this many minutes late a delayed row also says so in words under
 * the expected time. */
export const VERY_LATE_MINUTES = 15;

/** The status in words. `text` is what the eye reads ("On time", "Exp 10:09",
 * "Cancelled"), `marker` the "+1" that follows an expected time on a later
 * day, and `spoken` the full sentence for a screen reader ("Expected 10:09,
 * 3 minutes late"). `detail` is secondary text under it: how late a very
 * late train is, or a cancellation's reason. The icon is picked from
 * `kind`. */
export interface BoardStatus {
  kind: BoardStatusKind;
  /** The colour family, from the severity palette: on time `good`, booked
   * `neutral`, 1 to 9 minutes late (or late by an unknown amount) `mild`,
   * 10 to 29 `late`, 30 or more and cancelled `severe`. Colour only
   * reinforces the words and the icon. */
  tone: BoardStatusTone;
  text: string;
  marker: { short: string; spoken: string } | null;
  spoken: string;
  detail: string | null;
}

export interface BoardRowView {
  key: string;
  scheduled: BoardTime;
  /** Cancelled: the booked time is struck through. */
  struck: boolean;
  /** The other end of the service: the destination on the departures board,
   * the origin on the arrivals board. */
  destination: string;
  operator: string | null;
  platform: BoardPlatform;
  status: BoardStatus;
}

function boardTime(time: string, dayOffset: number | null): BoardTime {
  return { text: time, marker: dayOffsetMarker(dayOffset) };
}

/** `likely` is a predicted platform the api is adding, and any status this
 * build does not know is read the same way: shown with its word, never as
 * a confirmed platform. */
export function boardPlatform(row: BoardRowSource): BoardPlatform {
  const platform = row.platform?.trim() ?? '';
  const status: string = row.platformStatus;
  switch (status) {
    case 'toBeAnnounced':
      return { kind: 'toBeAnnounced', text: 'To be announced' };
    case 'none':
      return { kind: 'none', spoken: 'No platform information' };
    default: {
      if (platform === '') return { kind: 'none', spoken: 'No platform information' };
      if (status === 'confirmed') {
        return { kind: 'platform', label: platform, spoken: `Platform ${platform}`, status, note: null };
      }
      const shown: BoardPlatformStatus = status === 'expected' || status === 'booked' ? status : 'likely';
      return {
        kind: 'platform',
        label: platform,
        spoken: `Platform ${platform}, ${shown}`,
        status: shown,
        note: shown,
      };
    }
  }
}

function minutesWord(minutes: number): string {
  return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
}

/** Whether the live time is a different one from the booked time. */
function expectedDiffers(row: BoardRowSource): boolean {
  return row.expected !== null && (row.expected !== row.scheduled || (row.expectedDayOffset ?? 0) !== row.dayOffset);
}

function statusWords(row: BoardRowSource): Omit<BoardStatus, 'tone'> {
  if (row.isCancelled || row.status === 'cancelled') {
    return { kind: 'cancelled', text: 'Cancelled', marker: null, spoken: 'Cancelled', detail: row.cancelReason };
  }
  switch (row.status) {
    case 'delayed': {
      const minutes = row.delayMinutes !== null && row.delayMinutes > 0 ? row.delayMinutes : null;
      if (row.expected !== null && expectedDiffers(row)) {
        // The expected time is the status: the delay is in the words for a
        // screen reader, and in text only once it is large.
        const marker = dayOffsetMarker(row.expectedDayOffset);
        const expected = marker ? `${row.expected} ${marker.spoken}` : row.expected;
        return {
          kind: 'delayed',
          text: `Exp ${row.expected}`,
          marker,
          spoken: minutes === null ? `Expected ${expected}` : `Expected ${expected}, ${minutesWord(minutes)} late`,
          detail: minutes !== null && minutes >= VERY_LATE_MINUTES ? `${minutes} min late` : null,
        };
      }
      if (minutes === null) {
        return { kind: 'delayed', text: 'Delayed', marker: null, spoken: 'Delayed', detail: null };
      }
      return {
        kind: 'delayed',
        text: `${minutes} min late`,
        marker: null,
        spoken: `${minutesWord(minutes)} late`,
        detail: null,
      };
    }
    case 'onTime':
      return { kind: 'onTime', text: 'On time', marker: null, spoken: 'On time', detail: null };
    case 'booked':
      // No live data: never a claim of punctuality.
      return { kind: 'booked', text: 'Booked', marker: null, spoken: 'Booked', detail: null };
  }
}

/** From this many minutes late the status reads as late, not just delayed,
 * and from `SEVERELY_LATE_MINUTES` as severe, as a cancellation does. */
export const LATE_MINUTES = 10;
export const SEVERELY_LATE_MINUTES = 30;

function tone(row: BoardRowSource, kind: BoardStatusKind): BoardStatusTone {
  switch (kind) {
    case 'onTime':
      return 'good';
    case 'booked':
      return 'neutral';
    case 'cancelled':
      return 'severe';
    case 'delayed': {
      const minutes = row.delayMinutes ?? 0;
      if (minutes >= SEVERELY_LATE_MINUTES) return 'severe';
      return minutes >= LATE_MINUTES ? 'late' : 'mild';
    }
  }
}

/** The glyph that goes with a status. The shape is the cue, apart from the
 * colour: a tick on time, a clock booked, a triangle for a delay, an
 * octagon for a delay of 30 minutes or more, a cross cancelled. The words
 * beside it carry the meaning; the icon is decorative. */
export type BoardStatusIcon = 'check' | 'clock' | 'warning' | 'severe' | 'cross';

export function statusIcon(status: Pick<BoardStatus, 'kind' | 'tone'>): BoardStatusIcon {
  switch (status.kind) {
    case 'onTime':
      return 'check';
    case 'booked':
      return 'clock';
    case 'cancelled':
      return 'cross';
    case 'delayed':
      return status.tone === 'severe' ? 'severe' : 'warning';
  }
}

export function boardStatus(row: BoardRowSource): BoardStatus {
  const words = statusWords(row);
  return { ...words, tone: tone(row, words.kind) };
}

function commonRow(row: BoardRowSource, index: number, place: string): BoardRowView {
  const status = boardStatus(row);
  return {
    key: `${row.serviceDate}-${row.uid}-${row.scheduled}-${index}`,
    scheduled: boardTime(row.scheduled, row.dayOffset),
    struck: status.kind === 'cancelled',
    destination: place,
    operator: row.operatorName ?? row.operator,
    platform: boardPlatform(row),
    status,
  };
}

export function boardRow(row: StationBoardDeparture, index: number): BoardRowView {
  return commonRow(row, index, row.destinationName ?? row.destinationCrs ?? 'Unknown destination');
}

export function arrivalRow(row: StationBoardArrival, index: number): BoardRowView {
  return commonRow(row, index, row.originName ?? row.originCrs ?? 'Unknown origin');
}

/** `?operator=`: one ATOC code, two upper-case letters. Anything else (junk,
 * lower case, a list, empty) is no filter. */
export function parseOperatorParam(raw: string | string[] | undefined): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value !== undefined && /^[A-Z]{2}$/.test(value) ? value : null;
}

export interface OperatorOption {
  value: string;
  label: string;
}

/** The operators on a board's rows, once each and sorted by name. */
export function operatorOptions(rows: readonly BoardRowSource[]): OperatorOption[] {
  const byCode = new Map<string, string>();
  for (const row of rows) {
    if (row.operator !== null && !byCode.has(row.operator)) {
      byCode.set(row.operator, row.operatorName ?? row.operator);
    }
  }
  return [...byCode]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label) || a.value.localeCompare(b.value));
}

/** The picker is for a board with a choice to make; a filtered board keeps
 * it so the visitor can get back to all operators. */
export function showOperatorFilter(options: readonly OperatorOption[], operator: string | null): boolean {
  return options.length >= 2 || operator !== null;
}

export interface BoardView {
  kind: BoardKind;
  heading: string;
  /** What the page says when the board has no rows. */
  empty: string;
  rows: BoardRowView[];
  /** "Updated 10:00", in UK time. */
  updated: string;
  /** Credits the api asks to be republished with the data. */
  attribution: string[];
}

/** The board as the page shows it. `fallbackName` is the station's own name
 * for a board that carries none. */
export function boardView(board: StationBoard, fallbackName: string, operatorLabel: string | null = null): BoardView {
  const name = board.name ?? fallbackName;
  const arrivals = board.board === 'arrivals';
  const noun = arrivals ? 'arrivals' : 'departures';
  const base = arrivals ? `Arrivals at ${name}` : `Departures from ${name}`;
  return {
    kind: arrivals ? 'arrivals' : 'departures',
    heading: operatorLabel === null ? base : `${base}, ${operatorLabel}`,
    empty:
      operatorLabel === null
        ? arrivals
          ? 'No arrivals are scheduled at this station right now.'
          : 'No departures are scheduled from this station right now.'
        : `No more ${noun} listed for ${operatorLabel} today.`,
    rows: arrivals ? (board.arrivals ?? []).map(arrivalRow) : board.departures.map(boardRow),
    updated: `Updated ${formatTime(board.generatedAt)}`,
    attribution: board.attribution.map((entry) => entry.text),
  };
}
