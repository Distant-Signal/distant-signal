import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderWithMantine } from '@/test/render';
import { visibleText } from '@/test/routeText';
import { StationBoard } from './StationBoard';
import type { StationBoard as Board, StationBoardDeparture } from '@/lib/types';

function departure(overrides: Partial<StationBoardDeparture>): StationBoardDeparture {
  return {
    uid: 'G1',
    serviceDate: '2026-11-28',
    scheduled: '10:06',
    dayOffset: 0,
    expected: null,
    expectedDayOffset: null,
    destinationCrs: 'BRI',
    destinationName: 'Bristol Temple Meads',
    operator: 'GW',
    operatorName: 'Great Western Railway',
    headcode: '1A23',
    platform: null,
    platformStatus: 'none',
    status: 'booked',
    delayMinutes: null,
    isCancelled: false,
    cancelReason: null,
    ...overrides,
  };
}

function board(departures: StationBoardDeparture[], extra: Partial<Board> = {}): Board {
  return {
    crs: 'PAD',
    name: 'London Paddington',
    serviceDate: '2026-11-28',
    generatedAt: '2026-11-28T10:00:07Z',
    departures,
    attribution: [{ licence: 'x', text: 'powered by NationalRail (Train Information Services Ltd)' }],
    ...extra,
  };
}

function renderBoard(data: Board) {
  return renderWithMantine(<StationBoard board={data} crs="PAD" fallbackName="London Paddington" />);
}

describe('StationBoard', () => {
  const rows = [
    departure({
      uid: 'A',
      scheduled: '10:06',
      expected: '10:09',
      expectedDayOffset: 0,
      platform: '4',
      platformStatus: 'confirmed',
      status: 'delayed',
      delayMinutes: 3,
    }),
    departure({
      uid: 'B',
      scheduled: '10:15',
      destinationName: 'Oxford',
      platform: '9',
      platformStatus: 'booked',
      status: 'booked',
    }),
    departure({
      uid: 'C',
      scheduled: '10:30',
      destinationName: 'Reading',
      platformStatus: 'toBeAnnounced',
      status: 'cancelled',
      isCancelled: true,
      cancelReason: 'A fault with the train',
    }),
    departure({
      uid: 'D',
      scheduled: '00:15',
      dayOffset: 1,
      destinationName: 'Penzance',
      platform: '2',
      platformStatus: 'expected',
      status: 'onTime',
      delayMinutes: 0,
    }),
  ];

  it('is a table named for the station, with column headers', () => {
    renderBoard(board(rows));
    const table = screen.getByRole('table', { name: 'Departures from London Paddington' });
    const headers = within(table).getAllByRole('columnheader');
    expect(headers.map((h) => h.textContent)).toEqual(['Time', 'Destination', 'Operator', 'Platform', 'Status']);
    for (const header of headers) expect(header).toHaveAttribute('scope', 'col');
    expect(within(table).getAllByRole('row')).toHaveLength(rows.length + 1);
  });

  it('words each row: times, platform, status', () => {
    renderBoard(board(rows));
    const [, delayed, booked, cancelled, onTime] = screen.getAllByRole('row');
    expect(visibleText(delayed!)).toContain('10:06Exp 10:09');
    expect(delayed!).toHaveTextContent('Platform 4');
    expect(delayed!).not.toHaveTextContent('Platform 4, booked');
    expect(visibleText(delayed!)).toContain('Delayed 3 min');
    expect(delayed!).toHaveTextContent('Delayed 3 minutes');

    expect(booked!).toHaveTextContent('Platform 9, booked');
    expect(visibleText(booked!)).toContain('booked');
    expect(visibleText(booked!)).not.toMatch(/on time/i);
    expect(visibleText(booked!)).toContain('Booked');

    expect(visibleText(cancelled!)).toContain('To be announced');
    expect(visibleText(cancelled!)).toContain('Cancelled');
    expect(visibleText(cancelled!)).toContain('A fault with the train');

    expect(visibleText(onTime!)).toContain('00:15+1');
    expect(onTime!).toHaveTextContent('next day');
    expect(visibleText(onTime!)).toContain('On time');
    expect(onTime!).toHaveTextContent('Platform 2, expected');
    expect(visibleText(onTime!)).toContain('expected');
    expect(visibleText(delayed!)).not.toMatch(/expected|booked/);
  });

  it('shows each platform state with its own box and word, and a missing one as a dash', () => {
    renderBoard(
      board([
        departure({ uid: 'P1', platform: '1', platformStatus: 'confirmed' }),
        departure({ uid: 'P2', platform: '2', platformStatus: 'expected' }),
        departure({ uid: 'P3', platform: '3', platformStatus: 'booked' }),
        departure({ uid: 'P4', platformStatus: 'toBeAnnounced' }),
        departure({ uid: 'P5', platformStatus: 'none' }),
      ]),
    );
    const [, confirmed, expected, booked, tba, none] = screen.getAllByRole('row');
    const box = (row: HTMLElement) => row.querySelector('[class*="platformBox"]');

    expect(confirmed!).toHaveTextContent('Platform 1');
    expect(confirmed!).not.toHaveTextContent('Platform 1,');
    expect(box(confirmed!)!.className).toMatch(/confirmed/);
    expect(visibleText(confirmed!)).not.toMatch(/expected|booked/);

    expect(expected!).toHaveTextContent('Platform 2, expected');
    expect(box(expected!)!.className).toMatch(/expected/);
    expect(visibleText(expected!)).toContain('expected');

    expect(booked!).toHaveTextContent('Platform 3, booked');
    expect(box(booked!)!.className).toMatch(/booked/);

    expect(visibleText(tba!)).toContain('To be announced');
    expect(box(tba!)).toBeNull();
    expect(none!).toHaveTextContent('No platform information');
    expect(box(none!)).toBeNull();
  });

  it('links to the train search for later trains and credits National Rail verbatim', () => {
    renderBoard(board(rows));
    expect(screen.getByRole('link', { name: 'Later trains' })).toHaveAttribute('href', '/trains?station=PAD');
    expect(screen.getByText('Updated 10:00')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /powered by NationalRail/ })).toBeInTheDocument();
    expect(visibleText(document.querySelector('[data-nre-credit]')!)).toContain(
      'powered by NationalRail (Train Information Services Ltd)',
    );
  });

  it('shows any further credit the api asks for', () => {
    renderBoard(board(rows, { attribution: [{ licence: 'y', text: 'Contains other data' }] }));
    expect(screen.getByText('Contains other data')).toBeInTheDocument();
  });

  it('keeps the operator in the destination cell for a phone and in its own column for a desktop', () => {
    renderBoard(board([rows[0]!]));
    expect(screen.getAllByText('Great Western Railway')).toHaveLength(2);
  });

  it('says so, not an empty table, when no more trains are listed', () => {
    renderBoard(board([]));
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getByText('No more departures listed for today.')).toBeInTheDocument();
  });
});
