import { describe, expect, it } from 'vitest';
import {
  boardPlatform,
  boardRow,
  boardStatus,
  boardView,
  operatorOptions,
  parseOperatorParam,
  showOperatorFilter,
} from './stationBoard';
import type { StationBoard, StationBoardDeparture } from './types';

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
      departures: [],
      attribution: [],
    };
    expect(boardView(board, 'PAD', 'Great Western Railway').heading).toBe(
      'Departures from London Paddington, Great Western Railway',
    );
  });
});
