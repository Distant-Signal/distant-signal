import { describe, expect, it } from 'vitest';
import {
  boardPlatform,
  boardRow,
  boardStatus,
  boardView,
  operatorOptions,
  parseOperatorParam,
  showOperatorFilter,
  arrivalRow,
  parseBoardParam,
  boardRowsOf,
} from './stationBoard';
import type { StationBoard, StationBoardArrival, StationBoardDeparture } from './types';

function departure(overrides: Partial<StationBoardDeparture> = {}): StationBoardDeparture {
  return {
    uid: 'G12345',
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
    platformBasis: null,
    status: 'booked',
    delayMinutes: null,
    isCancelled: false,
    cancelReason: null,
    ...overrides,
  };
}

describe('boardPlatform', () => {
  it.each([
    ['confirmed', 'Platform 4', null],
    ['expected', 'Platform 4, expected', 'expected'],
    ['likely', 'Platform 4, likely', 'likely'],
    ['booked', 'Platform 4, booked', 'booked'],
  ] as const)('words a %s platform', (platformStatus, spoken, note) => {
    expect(boardPlatform(departure({ platform: '4', platformStatus: platformStatus as never }))).toEqual({
      kind: 'platform',
      label: '4',
      spoken,
      status: platformStatus,
      note,
    });
  });

  it('never reads an unknown platform status as confirmed', () => {
    const row = departure({ platform: '4', platformStatus: 'someFutureValue' as never });
    expect(boardPlatform(row)).toMatchObject({ spoken: 'Platform 4, likely', status: 'likely', note: 'likely' });
    expect(boardPlatform({ ...row, platform: null })).toMatchObject({ kind: 'none' });
  });

  it('says "To be announced" and leaves a row with no platform empty', () => {
    expect(boardPlatform(departure({ platformStatus: 'toBeAnnounced' }))).toEqual({
      kind: 'toBeAnnounced',
      text: 'To be announced',
    });
    expect(boardPlatform(departure({ platformStatus: 'none' }))).toMatchObject({ kind: 'none' });
  });

  it('treats a platform status with no platform as none', () => {
    expect(boardPlatform(departure({ platformStatus: 'confirmed', platform: null }))).toMatchObject({ kind: 'none' });
  });
});

describe('boardStatus', () => {
  it('words on time quietly, and never calls a train with no live data on time', () => {
    expect(boardStatus(departure({ status: 'onTime', delayMinutes: 0 }))).toEqual({
      kind: 'onTime',
      tone: 'good',
      text: 'On time',
      marker: null,
      spoken: 'On time',
      detail: null,
    });
    expect(boardStatus(departure({ status: 'booked' }))).toEqual({
      kind: 'booked',
      tone: 'neutral',
      text: 'Booked',
      marker: null,
      spoken: 'Booked',
      detail: null,
    });
  });

  it('makes the expected time the status of a late train, with the delay for a screen reader', () => {
    expect(
      boardStatus(departure({ status: 'delayed', delayMinutes: 3, expected: '10:09', expectedDayOffset: 0 })),
    ).toEqual({
      kind: 'delayed',
      tone: 'mild',
      text: 'Exp 10:09',
      marker: null,
      spoken: 'Expected 10:09, 3 minutes late',
      detail: null,
    });
    expect(
      boardStatus(departure({ status: 'delayed', delayMinutes: 1, expected: '10:07', expectedDayOffset: 0 })).spoken,
    ).toBe('Expected 10:07, 1 minute late');
  });

  it('adds a visible "min late" line from 15 minutes', () => {
    const at14 = boardStatus(
      departure({ status: 'delayed', delayMinutes: 14, expected: '10:20', expectedDayOffset: 0 }),
    );
    expect(at14.detail).toBeNull();
    const at15 = boardStatus(
      departure({ status: 'delayed', delayMinutes: 15, expected: '10:21', expectedDayOffset: 0 }),
    );
    expect(at15).toMatchObject({ text: 'Exp 10:21', detail: '15 min late' });
    expect(at15.spoken).toBe('Expected 10:21, 15 minutes late');
  });

  it('carries the "+1" and "next day" for an expected time past midnight', () => {
    const status = boardStatus(
      departure({ scheduled: '23:50', status: 'delayed', delayMinutes: 20, expected: '00:10', expectedDayOffset: 1 }),
    );
    expect(status.text).toBe('Exp 00:10');
    expect(status.marker).toEqual({ short: '+1', spoken: 'next day' });
    expect(status.spoken).toBe('Expected 00:10 next day, 20 minutes late');
  });

  it('falls back to the minutes, then to "Delayed", when there is no expected time', () => {
    expect(boardStatus(departure({ status: 'delayed', delayMinutes: 7 }))).toMatchObject({
      text: '7 min late',
      spoken: '7 minutes late',
      detail: null,
    });
    expect(
      boardStatus(departure({ status: 'delayed', delayMinutes: 7, expected: '10:06', expectedDayOffset: 0 })).text,
    ).toBe('7 min late');
    expect(boardStatus(departure({ status: 'delayed', delayMinutes: null }))).toMatchObject({
      text: 'Delayed',
      spoken: 'Delayed',
    });
    expect(boardStatus(departure({ status: 'delayed', delayMinutes: 0 })).text).toBe('Delayed');
  });

  it('says only the expected time when the delay is not known', () => {
    expect(
      boardStatus(departure({ status: 'delayed', delayMinutes: null, expected: '10:09', expectedDayOffset: 0 })),
    ).toMatchObject({ text: 'Exp 10:09', spoken: 'Expected 10:09', detail: null });
  });

  it.each([
    [1, 'mild'],
    [9, 'mild'],
    [10, 'late'],
    [29, 'late'],
    [30, 'severe'],
    [95, 'severe'],
  ] as const)('tones a %i minute delay %s', (delayMinutes, tone) => {
    expect(boardStatus(departure({ status: 'delayed', delayMinutes })).tone).toBe(tone);
  });

  it('tones a delay of unknown length mild', () => {
    expect(boardStatus(departure({ status: 'delayed', delayMinutes: null })).tone).toBe('mild');
  });

  it('carries the cancellation reason, or none', () => {
    expect(
      boardStatus(departure({ status: 'cancelled', isCancelled: true, cancelReason: 'A fault with the train' })),
    ).toEqual({
      kind: 'cancelled',
      tone: 'severe',
      text: 'Cancelled',
      marker: null,
      spoken: 'Cancelled',
      detail: 'A fault with the train',
    });
    expect(boardStatus(departure({ status: 'cancelled', isCancelled: true })).detail).toBeNull();
  });
});

describe('boardRow', () => {
  it('has no expected time of its own: the status carries it', () => {
    const row = boardRow(departure({ status: 'delayed', delayMinutes: 3, expected: '10:09', expectedDayOffset: 0 }), 0);
    expect(row).not.toHaveProperty('expected');
    expect(row.scheduled).toEqual({ text: '10:06', marker: null });
    expect(row.status.text).toBe('Exp 10:09');
  });

  it('marks times past midnight with the "+1" convention', () => {
    const row = boardRow(departure({ scheduled: '00:15', dayOffset: 1 }), 0);
    expect(row.scheduled.marker).toEqual({ short: '+1', spoken: 'next day' });
  });

  it('strikes through a cancelled train and shows no expected time', () => {
    const row = boardRow(
      departure({ status: 'cancelled', isCancelled: true, expected: '10:09', expectedDayOffset: 0 }),
      0,
    );
    expect(row.struck).toBe(true);
    expect(row.status.text).toBe('Cancelled');
  });

  it('names the destination and the operator, falling back to codes', () => {
    expect(boardRow(departure(), 0)).toMatchObject({
      destination: 'Bristol Temple Meads',
      operator: 'Great Western Railway',
    });
    expect(boardRow(departure({ destinationName: null, operatorName: null }), 0)).toMatchObject({
      destination: 'BRI',
      operator: 'GW',
    });
    expect(
      boardRow(departure({ destinationName: null, destinationCrs: null, operator: null, operatorName: null }), 0),
    ).toMatchObject({ destination: 'Unknown destination', operator: null });
  });
});

describe('boardView', () => {
  const board: StationBoard = {
    crs: 'PAD',
    name: 'London Paddington',
    serviceDate: '2026-11-28',
    generatedAt: '2026-11-28T10:00:07Z',
    board: 'departures',
    departures: [departure()],
    attribution: [{ licence: 'x', text: 'powered by NationalRail (Train Information Services Ltd)' }],
  };

  it('words the heading and the freshness line, in UK time', () => {
    const view = boardView(board, 'PAD');
    expect(view.heading).toBe('Departures from London Paddington');
    expect(view.updated).toBe('Updated 10:00');
    expect(boardView({ ...board, generatedAt: '2026-07-01T10:00:07Z' }, 'PAD').updated).toBe('Updated 11:00');
  });

  it('falls back to the station name the page knows', () => {
    expect(boardView({ ...board, name: null }, 'London Paddington').heading).toBe('Departures from London Paddington');
  });
});

describe('operator filter', () => {
  it('reads only a two-letter upper-case code from the query', () => {
    expect(parseOperatorParam('GW')).toBe('GW');
    expect(parseOperatorParam(['SW', 'GW'])).toBe('SW');
    for (const bad of [undefined, '', 'gw', 'G', 'GWR', 'G1', 'GW,SW', ' GW', 'GW\n']) {
      expect(parseOperatorParam(bad)).toBeNull();
    }
  });

  it('lists each operator on the rows once, sorted by name', () => {
    const options = operatorOptions([
      departure({ operator: 'GW', operatorName: 'Great Western Railway' }),
      departure({ operator: 'SW', operatorName: 'South Western Railway' }),
      departure({ operator: 'GW', operatorName: 'Great Western Railway' }),
      departure({ operator: 'XC', operatorName: null }),
      departure({ operator: null, operatorName: null }),
      departure({ operator: 'GR', operatorName: 'LNER' }),
    ]);
    expect(options).toEqual([
      { value: 'GW', label: 'Great Western Railway' },
      { value: 'GR', label: 'LNER' },
      { value: 'SW', label: 'South Western Railway' },
      { value: 'XC', label: 'XC' },
    ]);
  });

  it('shows the picker for two operators or a filtered board, not for one', () => {
    const one = [{ value: 'GW', label: 'Great Western Railway' }];
    expect(showOperatorFilter(one, null)).toBe(false);
    expect(showOperatorFilter([], null)).toBe(false);
    expect(showOperatorFilter([...one, { value: 'SW', label: 'South Western Railway' }], null)).toBe(true);
    expect(showOperatorFilter(one, 'GW')).toBe(true);
  });

  it('puts the operator in the heading', () => {
    const board: StationBoard = {
      crs: 'PAD',
      name: 'London Paddington',
      serviceDate: '2026-11-28',
      generatedAt: '2026-11-28T10:00:07Z',
      board: 'departures',
      departures: [],
      attribution: [],
    };
    expect(boardView(board, 'PAD', 'Great Western Railway').heading).toBe(
      'Departures from London Paddington, Great Western Railway',
    );
  });
});

function arrival(overrides: Partial<StationBoardArrival> = {}): StationBoardArrival {
  return {
    uid: 'G54321',
    serviceDate: '2026-11-28',
    scheduled: '10:06',
    dayOffset: 0,
    expected: null,
    expectedDayOffset: null,
    originCrs: 'BRI',
    originName: 'Bristol Temple Meads',
    destinationCrs: 'PAD',
    destinationName: 'London Paddington',
    terminates: true,
    operator: 'GW',
    operatorName: 'Great Western Railway',
    headcode: '1A23',
    platform: null,
    platformStatus: 'none',
    platformBasis: null,
    status: 'booked',
    delayMinutes: null,
    isCancelled: false,
    cancelReason: null,
    ...overrides,
  };
}

describe('arrivals', () => {
  const arrivals: StationBoard = {
    crs: 'PAD',
    name: 'London Paddington',
    serviceDate: '2026-11-28',
    generatedAt: '2026-11-28T10:00:07Z',
    board: 'arrivals',
    departures: [],
    arrivals: [arrival()],
    attribution: [],
  };

  it('reads ?board= as arrivals only for the word arrivals', () => {
    expect(parseBoardParam('arrivals')).toBe('arrivals');
    expect(parseBoardParam(['arrivals', 'x'])).toBe('arrivals');
    for (const other of [undefined, '', 'departures', 'Arrivals', 'x', ['x', 'arrivals']]) {
      expect(parseBoardParam(other)).toBe('departures');
    }
  });

  it('shows the origin, the arrival time and the status of a row', () => {
    const row = arrivalRow(
      arrival({ scheduled: '10:06', expected: '10:09', expectedDayOffset: 0, status: 'delayed', delayMinutes: 3 }),
      0,
    );
    expect(row.destination).toBe('Bristol Temple Meads');
    expect(row.scheduled).toEqual({ text: '10:06', marker: null });
    expect(row.status).toMatchObject({ kind: 'delayed', text: 'Exp 10:09', spoken: 'Expected 10:09, 3 minutes late' });
  });

  it('falls back to the origin code, then to a plain word', () => {
    expect(arrivalRow(arrival({ originName: null }), 0).destination).toBe('BRI');
    expect(arrivalRow(arrival({ originName: null, originCrs: null }), 0).destination).toBe('Unknown origin');
  });

  it('says a cancelled arrival is cancelled', () => {
    const row = arrivalRow(arrival({ isCancelled: true, status: 'cancelled', cancelReason: 'A fault' }), 0);
    expect(row.struck).toBe(true);
    expect(row.status).toMatchObject({ kind: 'cancelled', tone: 'severe', detail: 'A fault' });
  });

  it('words the platform as confirmed, expected, booked and likely, as on departures', () => {
    const platform = (overrides: Partial<StationBoardArrival>) => arrivalRow(arrival(overrides), 0).platform;
    expect(platform({ platform: '4', platformStatus: 'confirmed' })).toMatchObject({
      spoken: 'Platform 4',
      note: null,
    });
    expect(platform({ platform: '4', platformStatus: 'expected' })).toMatchObject({
      spoken: 'Platform 4, expected',
      note: 'expected',
    });
    expect(platform({ platform: '4', platformStatus: 'booked' })).toMatchObject({
      spoken: 'Platform 4, booked',
      note: 'booked',
    });
    expect(platform({ platform: '4', platformStatus: 'likely', platformBasis: 'inbound' })).toMatchObject({
      status: 'likely',
      spoken: 'Platform 4, likely',
      note: 'likely',
    });
  });

  it('builds the arrivals view with its heading, rows and empty messages', () => {
    const view = boardView(arrivals, 'PAD');
    expect(view.kind).toBe('arrivals');
    expect(view.heading).toBe('Arrivals at London Paddington');
    expect(view.rows).toHaveLength(1);
    expect(view.empty).toBe('No more arrivals listed for today.');
    expect(boardView(arrivals, 'PAD', 'Great Western Railway')).toMatchObject({
      heading: 'Arrivals at London Paddington, Great Western Railway',
      empty: 'No more arrivals listed for Great Western Railway today.',
    });
  });

  it('keeps the departures empty messages', () => {
    const { arrivals: _unused, ...rest } = arrivals;
    const departures: StationBoard = { ...rest, board: 'departures' };
    expect(boardView(departures, 'PAD').empty).toBe('No more departures listed for today.');
    expect(boardView(departures, 'PAD', 'GWR').empty).toBe('No more departures listed for GWR today.');
  });

  it('lists the rows of whichever board the api answered with', () => {
    expect(boardRowsOf(arrivals)).toEqual([arrival()]);
    expect(boardRowsOf({ ...arrivals, board: 'departures', departures: [departure()] })).toEqual([departure()]);
  });
});
