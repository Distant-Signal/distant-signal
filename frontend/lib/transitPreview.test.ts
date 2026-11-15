import { describe, expect, it } from 'vitest';
import {
  completeLineReports,
  tflStopPreviewCard,
  tflStopPreviewImage,
  transitLinePreviewCard,
  transitLinePreviewImage,
  transitLinePreviewVersion,
  transitStopPreviewCard,
  transitStopPreviewImage,
} from './transitPreview';
import type { LineStatus, LineStatusReport, TransitLineDetail } from './types';
import { LINE, NETWORK, STOP } from '@/test/transitFixtures';

const NOW = Date.parse('2026-10-30T14:05:00Z');

function withStatus(statuses: { severity: number; reason: string }[], asOf = '2026-10-30T14:00:00Z') {
  return {
    ...LINE,
    status: {
      state: 'current',
      asOf,
      upcoming: [],
      statuses: statuses.map((s) => ({ ...s, description: '', situationId: null })),
    },
  } as TransitLineDetail;
}

describe('transitLinePreviewCard', () => {
  it('bands a disrupted line by its headline status, with its reason and a snapshot note', () => {
    const card = transitLinePreviewCard(
      withStatus([
        { severity: 6, reason: 'Signal failure at <b>Piccadilly</b>' },
        { severity: 9, reason: 'Delays' },
      ]),
      'Manchester Metrolink',
    );
    expect(card.band.tone).toBe('severe');
    expect(card.band.aside).toBe('As of Fri 30 Oct, 14:00');
    expect(card.title).toBe('Blue Line, Manchester Metrolink');
    expect(card.lead).toBe('Signal failure at Piccadilly');
    expect(card.rows).toEqual(['2 disruptions on this line', 'A snapshot in UK time: open the page for live status']);
  });

  it('is good with no lead when nothing is wrong', () => {
    const card = transitLinePreviewCard(withStatus([{ severity: 10, reason: '' }]), 'Manchester Metrolink');
    expect(card.band.tone).toBe('good');
    expect(card.lead).toBeNull();
  });

  it('never claims good service for a line with no or unavailable status', () => {
    const none = transitLinePreviewCard(LINE, 'Manchester Metrolink');
    expect(none.band).toEqual({ tone: 'informational', label: 'No status yet', aside: '' });
    const unavailable = transitLinePreviewCard(
      { ...LINE, status: { state: 'unavailable', asOf: null, statuses: [], upcoming: [] } },
      'Manchester Metrolink',
    );
    expect(unavailable.band.label).toBe('Status unavailable');
  });

  it('versions the image by the status, not by when it was read', () => {
    const a = transitLinePreviewVersion(withStatus([{ severity: 6, reason: 'x' }], '2026-10-30T14:00:00Z'));
    const b = transitLinePreviewVersion(withStatus([{ severity: 6, reason: 'x' }], '2026-10-30T15:00:00Z'));
    const c = transitLinePreviewVersion(withStatus([{ severity: 9, reason: 'x' }]));
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(transitLinePreviewImage('metrolink', 'metrolink:blue', LINE, 'alt').url).toMatch(
      /^\/transit\/metrolink\/lines\/metrolink%3Ablue\/card\.png\?v=[0-9a-f]{8}$/,
    );
  });
});

describe('transitStopPreviewCard', () => {
  it('names the stop and network, the lines that call there and its notices', () => {
    const stop = {
      ...STOP,
      notices: [{}, {}] as never,
      firstLast: [{ line: NETWORK.lines[0] }, { line: NETWORK.lines[0] }, { line: NETWORK.lines[1] }] as never,
    };
    expect(transitStopPreviewCard(stop, 'Manchester Metrolink')).toEqual({
      band: { tone: 'informational', label: 'Manchester Metrolink stop', aside: '' },
      title: 'Piccadilly, Manchester Metrolink',
      lead: '2 notices in effect',
      chips: { names: ['Blue Line', 'Green Line'], more: 0 },
      rows: ['Scheduled departures and the lines that call here'],
    });
  });

  it('lists no lead without notices and versions the image by the card', () => {
    const card = transitStopPreviewCard(STOP, 'Manchester Metrolink');
    expect(card.lead).toBeNull();
    expect(transitStopPreviewImage('metrolink', STOP.id, card, 'alt').url).toMatch(
      /^\/transit\/metrolink\/stops\/9400ZZMAPIC\/card\.png\?v=[0-9a-f]{8}$/,
    );
  });
});

function report(id: string, name: string, severity: number, reason: string): LineStatusReport {
  const status: LineStatus = {
    statusSeverity: severity,
    statusSeverityDescription: '',
    reason,
    dataQuality: 'knowledgebase',
    validityPeriods: [],
    sampleAvailability: { state: 'available' },
    fullCoverageAvailability: { state: 'not-enabled' },
  };
  return {
    $type: 'DistantSignal.LineStatusReport',
    attribution: [],
    id,
    name,
    modeName: 'tube',
    operators: [],
    lineStatuses: [status],
    computedAt: '2026-10-30T14:03:00Z',
  } satisfies LineStatusReport;
}

describe('completeLineReports', () => {
  it('keeps a full set and drops a short or missing one, so "No disruptions" is never claimed on partial data', () => {
    const one = [report('tfl-victoria', 'Victoria', 10, '')];
    expect(completeLineReports(one, 1)).toBe(one);
    expect(completeLineReports(one, 2)).toBeNull();
    expect(completeLineReports(null, 1)).toBeNull();
    expect(completeLineReports([], 0)).toEqual([]);
  });
});

describe('tflStopPreviewCard', () => {
  const stop = { name: "King's Cross St. Pancras", modes: ['tube'] };

  it('bands the stop by its worst line and puts its modes first among the facts', () => {
    const card = tflStopPreviewCard(
      stop,
      ['Underground'],
      [report('tfl-northern', 'Northern', 6, 'Severe delays'), report('tfl-victoria', 'Victoria', 10, '')],
      NOW,
    );
    expect(card.band.tone).toBe('severe');
    expect(card.title).toBe("King's Cross St. Pancras");
    expect(card.chips.names).toEqual(['Northern']);
    expect(card.rows[0]).toBe('Underground stop');
  });

  it('says no disruptions when every line is fine', () => {
    const card = tflStopPreviewCard(stop, ['Underground'], [report('tfl-victoria', 'Victoria', 10, '')], NOW);
    expect(card.band.label).toBe('No disruptions');
  });

  it('claims no status when the lines cannot be read, or none is tracked', () => {
    expect(tflStopPreviewCard(stop, [], null, NOW).band.label).toBe('Status unavailable');
    expect(tflStopPreviewCard(stop, [], [], NOW).band.label).toBe('No line status tracked');
  });

  it('versions the image by the lines state', () => {
    const fine = tflStopPreviewImage('940GZZLUKSX', 'KX', [report('tfl-victoria', 'Victoria', 10, '')], 'alt');
    const bad = tflStopPreviewImage('940GZZLUKSX', 'KX', [report('tfl-victoria', 'Victoria', 6, 'x')], 'alt');
    expect(fine.url).toMatch(/^\/tfl\/stops\/940GZZLUKSX\/card\.png\?v=[0-9a-f]{8}$/);
    expect(fine.url).not.toBe(bad.url);
  });
});
