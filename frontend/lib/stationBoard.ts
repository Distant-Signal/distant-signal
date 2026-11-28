import { formatTime } from './dateFormat';
import { dayOffsetMarker } from './serviceStatus';
import type { StationBoard, StationBoardDeparture } from './types';

/** How many departures the station page's board asks for. */
export const STATION_BOARD_LIMIT = 10;

/** A time with the "+1" marker the rest of the app puts after a time on a
 * later day than the service date. */
export interface BoardTime {
  text: string;
  marker: { short: string; spoken: string } | null;
}

/** What the platform cell says. `booked` is the timetable's platform with
 * no live word, so it is marked and never read as a confirmed one. */
export type BoardPlatform =
  | { kind: 'platform'; label: string; spoken: string; booked: boolean }
  | { kind: 'toBeAnnounced'; text: string }
  | { kind: 'none'; spoken: string };

export type BoardStatusKind = 'onTime' | 'delayed' | 'cancelled' | 'booked';

/** The status in words (`text` for the eye, `spoken` for a screen reader,
 * which gets "minutes" for "min"), with the cancellation reason as
 * secondary text. The icon is picked from `kind`. */
export interface BoardStatus {
  kind: BoardStatusKind;
  text: string;
  spoken: string;
  reason: string | null;
}

export interface BoardRowView {
  key: string;
  scheduled: BoardTime;
  /** Cancelled: the booked time is struck through. */
  struck: boolean;
  /** "Exp 10:09" when the live time differs from the booked one. */
  expected: BoardTime | null;
  destination: string;
  operator: string | null;
  platform: BoardPlatform;
  status: BoardStatus;
}

function boardTime(time: string, dayOffset: number | null): BoardTime {
  return { text: time, marker: dayOffsetMarker(dayOffset) };
}

export function boardPlatform(row: StationBoardDeparture): BoardPlatform {
  const platform = row.platform?.trim() ?? '';
  switch (row.platformStatus) {
    case 'confirmed':
    case 'expected':
    case 'booked':
      if (platform === '') return { kind: 'none', spoken: 'No platform information' };
      return {
        kind: 'platform',
        label: platform,
        spoken:
          row.platformStatus === 'booked'
            ? `Platform ${platform}, booked`
            : row.platformStatus === 'expected'
              ? `Platform ${platform}, expected`
              : `Platform ${platform}`,
        booked: row.platformStatus === 'booked',
      };
    case 'toBeAnnounced':
      return { kind: 'toBeAnnounced', text: 'To be announced' };
    case 'none':
      return { kind: 'none', spoken: 'No platform information' };
  }
}

export function boardStatus(row: StationBoardDeparture): BoardStatus {
  if (row.isCancelled || row.status === 'cancelled') {
    return { kind: 'cancelled', text: 'Cancelled', spoken: 'Cancelled', reason: row.cancelReason };
  }
  switch (row.status) {
    case 'delayed': {
      const minutes = row.delayMinutes;
      if (minutes === null || minutes <= 0) {
        return { kind: 'delayed', text: 'Delayed', spoken: 'Delayed', reason: null };
      }
      return {
        kind: 'delayed',
        text: `Delayed ${minutes} min`,
        spoken: `Delayed ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`,
        reason: null,
      };
    }
    case 'onTime':
      return { kind: 'onTime', text: 'On time', spoken: 'On time', reason: null };
    case 'booked':
      // No live data: never a claim of punctuality.
      return { kind: 'booked', text: 'Booked', spoken: 'Booked', reason: null };
  }
}

export function boardRow(row: StationBoardDeparture, index: number): BoardRowView {
  const status = boardStatus(row);
  const differs =
    row.expected !== null && (row.expected !== row.scheduled || (row.expectedDayOffset ?? 0) !== row.dayOffset);
  return {
    key: `${row.serviceDate}-${row.uid}-${row.scheduled}-${index}`,
    scheduled: boardTime(row.scheduled, row.dayOffset),
    struck: status.kind === 'cancelled',
    expected:
      row.expected !== null && differs && status.kind !== 'cancelled'
        ? boardTime(row.expected, row.expectedDayOffset)
        : null,
    destination: row.destinationName ?? row.destinationCrs ?? 'Unknown destination',
    operator: row.operatorName ?? row.operator,
    platform: boardPlatform(row),
    status,
  };
}

export interface BoardView {
  heading: string;
  rows: BoardRowView[];
  /** "Updated 10:00", in UK time. */
  updated: string;
  /** Credits the api asks to be republished with the data. */
  attribution: string[];
}

/** The board as the page shows it. `fallbackName` is the station's own name
 * for a board that carries none. */
export function boardView(board: StationBoard, fallbackName: string): BoardView {
  const name = board.name ?? fallbackName;
  return {
    heading: `Departures from ${name}`,
    rows: board.departures.map(boardRow),
    updated: `Updated ${formatTime(board.generatedAt)}`,
    attribution: board.attribution.map((entry) => entry.text),
  };
}
