import { describe, expect, it } from 'vitest';
import { networkBySlug, stationsById } from './ireland';
import {
  irelandLinePreviewCard,
  irelandLinePreviewImage,
  irelandStationPreviewCard,
  irelandStationPreviewImage,
  irelandTrainPreviewCard,
  irelandTrainPreviewImage,
} from './irelandPreview';
import {
  A101_TRAIN,
  BANGOR,
  BANGOR_LINE,
  CONNOLLY,
  DROGHEDA_LINE,
  ENTERPRISE,
  HOLYWOOD,
  STATIONS,
} from '@/test/irelandFixtures';

const ROI = networkBySlug('iarnrod-eireann')!;
const NI = networkBySlug('ni-railways')!;
const BY_ID = stationsById(STATIONS);

describe('irelandLinePreviewCard', () => {
  it('names the line, its ends and how many known stations it has', () => {
    expect(irelandLinePreviewCard(ENTERPRISE, ROI, BY_ID)).toEqual({
      band: { tone: 'informational', label: 'Iarnród Éireann line', aside: '' },
      title: 'Dublin - Belfast',
      lead: 'Dublin Connolly to Belfast Grand Central',
      chips: { names: [], more: 0 },
      rows: ['3 stations'],
    });
  });

  it('leaves out stations the catalogue does not know', () => {
    expect(irelandLinePreviewCard(DROGHEDA_LINE, ROI, BY_ID).rows).toEqual(['2 stations']);
    expect(irelandLinePreviewCard({ ...BANGOR_LINE, stations: [] }, NI, BY_ID)).toMatchObject({ lead: null, rows: [] });
  });
});

describe('irelandStationPreviewCard', () => {
  it('lists the lines that call, and mentions departures only where a live board may exist', () => {
    const lines = [ENTERPRISE, DROGHEDA_LINE, BANGOR_LINE];
    expect(irelandStationPreviewCard(CONNOLLY, ROI, lines)).toEqual({
      band: { tone: 'informational', label: 'Iarnród Éireann station', aside: '' },
      title: 'Dublin Connolly',
      lead: null,
      chips: { names: ['Dublin - Belfast', 'Dublin - Drogheda/Dundalk'], more: 0 },
      rows: ['Live departures and the lines that call here'],
    });
    expect(irelandStationPreviewCard(BANGOR, NI, lines).rows).toEqual(['The lines that call here']);
    expect(irelandStationPreviewCard(HOLYWOOD, NI, lines).chips.names).toEqual(['Bangor Line']);
  });
});

describe('irelandTrainPreviewCard', () => {
  it('says how late a running train is and where it was last reported', () => {
    expect(irelandTrainPreviewCard(A101_TRAIN, ROI)).toEqual({
      band: { tone: 'late', label: '5 min late', aside: 'As of Thu 17 Sep, 08:58' },
      title: '08:00 Dublin Connolly to Belfast Grand Central',
      lead: 'Left Dublin Connolly',
      chips: { names: [], more: 0 },
      rows: ['Iarnród Éireann · Train code A101 · 17 Sep 2026', 'A snapshot in UK time: open the page for live status'],
    });
  });

  it.each([
    [{ state: 'running', lateMinutes: 0 }, 'good', 'On time'],
    [{ state: 'running', lateMinutes: -2 }, 'early', '2 min early'],
    [{ state: 'running', lateMinutes: null }, 'informational', 'Running'],
    [{ state: 'arrived', lateMinutes: 3 }, 'late', 'Arrived, 3 min late'],
    [{ state: 'arrived', lateMinutes: null }, 'informational', 'Arrived'],
    [{ state: 'notSeenRecently', lateMinutes: null }, 'informational', 'Not seen on a board recently'],
    [{ state: 'noReport', lateMinutes: null }, 'informational', 'No live report yet'],
  ] as const)('bands %j as %s, %s', (live, tone, label) => {
    const card = irelandTrainPreviewCard({ ...A101_TRAIN, live: { ...A101_TRAIN.live, ...live } }, ROI);
    expect(card.band).toMatchObject({ tone, label });
  });

  it('never guesses a delay or a place for a train that does not report', () => {
    const card = irelandTrainPreviewCard(
      { ...A101_TRAIN, live: { ...A101_TRAIN.live, state: 'notSeenRecently', lateMinutes: 9 } },
      ROI,
    );
    expect(card.lead).toBeNull();
    expect(JSON.stringify(card)).not.toMatch(/min late/);
  });
});

describe('preview image URLs', () => {
  it('encode the ids (a corridor id holds a slash) and carry a digest', () => {
    const card = irelandLinePreviewCard(DROGHEDA_LINE, ROI, BY_ID);
    expect(irelandLinePreviewImage('iarnrod-eireann', DROGHEDA_LINE.id, card, 'alt').url).toMatch(
      /^\/island-of-ireland\/iarnrod-eireann\/lines\/DUB-DRO%2FDUN\/card\.png\?v=[0-9a-f]{8}$/,
    );
    const station = irelandStationPreviewCard(CONNOLLY, ROI, [ENTERPRISE]);
    expect(irelandStationPreviewImage('iarnrod-eireann', CONNOLLY.id, station, 'alt').url).toMatch(
      /^\/island-of-ireland\/iarnrod-eireann\/stations\/8220IR0007\/card\.png\?v=[0-9a-f]{8}$/,
    );
  });

  it('version a train by its state and place, not by when a board last showed it', () => {
    const url = (train: typeof A101_TRAIN | null) =>
      irelandTrainPreviewImage('iarnrod-eireann', 'A101', '2026-09-17', train, ROI, 'alt').url;
    const later = { ...A101_TRAIN, live: { ...A101_TRAIN.live, observedAt: '2026-09-17T08:10:00Z' } };
    const worse = { ...A101_TRAIN, live: { ...A101_TRAIN.live, lateMinutes: 15 } };
    expect(url(A101_TRAIN)).toBe(url(later));
    expect(url(A101_TRAIN)).not.toBe(url(worse));
    expect(url(null)).toMatch(/\/trains\/A101\/2026-09-17\/card\.png\?v=[0-9a-f]{8}$/);
  });
});
