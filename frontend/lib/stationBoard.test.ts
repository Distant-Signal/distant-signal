import { describe, expect, it } from 'vitest';
import { boardPlatform, boardRow, boardStatus, boardView } from './stationBoard';
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
  it('says a confirmed platform plainly', () => {
    expect(boardPlatform(departure({ platform: '4', platformStatus: 'confirmed' }))).toEqual({
      kind: 'platform',
      label: '4',
      spoken: 'Platform 4',
      booked: false,
    });
  });

  it('marks an expected platform for a screen reader and a booked one for everyone', () => {
    expect(boardPlatform(departure({ platform: '4', platformStatus: 'expected' }))).toMatchObject({
      spoken: 'Platform 4, expected',
      booked: false,
    });
    expect(boardPlatform(departure({ platform: '4', platformStatus: 'booked' }))).toMatchObject({
      spoken: 'Platform 4, booked',
      booked: true,
    });
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
  it('words each of the four statuses', () => {
    expect(boardStatus(departure({ status: 'onTime', delayMinutes: 0 }))).toMatchObject({
      kind: 'onTime',
      text: 'On time',
    });
    expect(boardStatus(departure({ status: 'delayed', delayMinutes: 3 }))).toMatchObject({
      kind: 'delayed',
      text: 'Delayed 3 min',
      spoken: 'Delayed 3 minutes',
    });
    expect(boardStatus(departure({ status: 'delayed', delayMinutes: 1 })).spoken).toBe('Delayed 1 minute');
    expect(boardStatus(departure({ status: 'booked' }))).toMatchObject({ kind: 'booked', text: 'Booked' });
  });

  it('says only "Delayed" when the delay is not known', () => {
    expect(boardStatus(departure({ status: 'delayed', delayMinutes: null })).text).toBe('Delayed');
  });

  it('never calls a train with no live data on time', () => {
    expect(boardStatus(departure({ status: 'booked' })).text).not.toMatch(/on time/i);
  });

  it('carries the cancellation reason', () => {
    expect(
      boardStatus(departure({ status: 'cancelled', isCancelled: true, cancelReason: 'A fault with the train' })),
    ).toEqual({ kind: 'cancelled', text: 'Cancelled', spoken: 'Cancelled', reason: 'A fault with the train' });
  });
});

describe('boardRow', () => {
  it('shows the expected time only when it differs', () => {
    expect(boardRow(departure({ expected: '10:09', expectedDayOffset: 0 }), 0).expected).toEqual({
      text: '10:09',
      marker: null,
    });
    expect(boardRow(departure({ expected: '10:06', expectedDayOffset: 0, status: 'onTime' }), 0).expected).toBeNull();
    expect(boardRow(departure(), 0).expected).toBeNull();
  });

  it('marks times past midnight with the "+1" convention', () => {
    const row = boardRow(departure({ scheduled: '00:15', dayOffset: 1, expected: '00:20', expectedDayOffset: 1 }), 0);
    expect(row.scheduled.marker).toEqual({ short: '+1', spoken: 'next day' });
    expect(row.expected?.marker).toEqual({ short: '+1', spoken: 'next day' });
  });

  it('shows an expected time that crossed midnight although the booked time did not', () => {
    const row = boardRow(departure({ scheduled: '23:58', expected: '23:58', expectedDayOffset: 1 }), 0);
    expect(row.expected?.marker?.short).toBe('+1');
  });

  it('strikes through a cancelled train and shows no expected time', () => {
    const row = boardRow(
      departure({ status: 'cancelled', isCancelled: true, expected: '10:09', expectedDayOffset: 0 }),
      0,
    );
    expect(row.struck).toBe(true);
    expect(row.expected).toBeNull();
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
