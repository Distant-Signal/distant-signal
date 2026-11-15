import { SNAPSHOT_NOTE } from './linePreview';
import {
  livePreviewImage,
  previewDigest,
  previewWhen,
  type PreviewBandTone,
  type StatusPreviewCard,
} from './livePreview';
import {
  type IrelandLine,
  type IrelandNetworkInfo,
  type IrelandStation,
  type IrelandTrain,
  irelandTrainIdentifiers,
  irelandTrainName,
  lastLocationText,
  lineEnds,
  linesAt,
  mayHaveLiveBoard,
} from './ireland';
import type { PreviewImage } from './pageMetadata';
import { delayLabel } from './serviceStatus';

/** Link previews for the island of Ireland pages (`/island-of-ireland/
 * [network]/lines/[line]`, `.../stations/[station]`, `.../trains/[train]/
 * [date]`), drawn by `renderStatusPreviewImage` (`lib/livePreview.ts`). Pure:
 * the same objects the pages read. A line and a station are not live (a
 * route and its lines; the page has the departure board, which changes by
 * the minute), so they get a neutral card. A train is live. */

/** Lines beyond this many on a station's card become "and N more". */
const MAX_CHIPS = 3;

export function irelandLinePreviewCard(
  line: IrelandLine,
  info: IrelandNetworkInfo,
  byId: ReadonlyMap<string, IrelandStation>,
): StatusPreviewCard {
  const ends = lineEnds(line, byId);
  const count = line.stations.filter((id) => byId.has(id)).length;
  return {
    band: { tone: 'informational', label: `${info.name} line`, aside: '' },
    title: line.name,
    lead: ends,
    chips: { names: [], more: 0 },
    rows: count > 0 ? [`${count} station${count === 1 ? '' : 's'}`] : [],
  };
}

export function irelandStationPreviewCard(
  station: IrelandStation,
  info: IrelandNetworkInfo,
  lines: readonly IrelandLine[],
): StatusPreviewCard {
  const names = linesAt(lines, station.id).map((line) => line.name);
  return {
    band: { tone: 'informational', label: `${info.name} station`, aside: '' },
    title: station.name,
    lead: null,
    chips: { names: names.slice(0, MAX_CHIPS), more: Math.max(0, names.length - MAX_CHIPS) },
    rows: [mayHaveLiveBoard(station) ? 'Live departures and the lines that call here' : 'The lines that call here'],
  };
}

function validTime(value: string | null | undefined): value is string {
  return !!value && !Number.isNaN(Date.parse(value));
}

function trainBand(train: IrelandTrain): { tone: PreviewBandTone; label: string } {
  const { live } = train;
  switch (live.state) {
    case 'running': {
      if (live.lateMinutes === null) return { tone: 'informational', label: 'Running' };
      const delay = delayLabel(live.lateMinutes);
      return { tone: delay.tone === 'late' ? 'late' : delay.tone === 'early' ? 'early' : 'good', label: delay.text };
    }
    case 'arrived': {
      if (live.lateMinutes === null) return { tone: 'informational', label: 'Arrived' };
      const delay = delayLabel(live.lateMinutes);
      return {
        tone: delay.tone === 'late' ? 'late' : delay.tone === 'early' ? 'early' : 'good',
        label: `Arrived, ${delay.text.toLowerCase()}`,
      };
    }
    case 'notSeenRecently':
      return { tone: 'informational', label: 'Not seen on a board recently' };
    case 'noReport':
      return { tone: 'informational', label: 'No live report yet' };
  }
}

/** A train's card: what the boards say about it now, in words, never a
 * guessed "On time" (the page's rule, `LiveState`). */
export function irelandTrainPreviewCard(train: IrelandTrain, info: IrelandNetworkInfo): StatusPreviewCard {
  const { live } = train;
  const reports = live.state === 'running' || live.state === 'arrived';
  return {
    // `observedAt` is always sent, but a card never throws on a bad time.
    band: { ...trainBand(train), aside: validTime(live.observedAt) ? `As of ${previewWhen(live.observedAt)}` : '' },
    title: irelandTrainName(train),
    lead: reports ? lastLocationText(live.lastLocation) : null,
    chips: { names: [], more: 0 },
    rows: [`${info.name} · ${irelandTrainIdentifiers(train)}`, SNAPSHOT_NOTE],
  };
}

export function irelandLinePreviewImage(
  slug: string,
  lineId: string,
  card: StatusPreviewCard,
  alt: string,
): PreviewImage {
  return livePreviewImage(
    `/island-of-ireland/${encodeURIComponent(slug)}/lines/${encodeURIComponent(lineId)}/card.png`,
    previewDigest(card),
    alt,
  );
}

export function irelandStationPreviewImage(
  slug: string,
  stationId: string,
  card: StatusPreviewCard,
  alt: string,
): PreviewImage {
  return livePreviewImage(
    `/island-of-ireland/${encodeURIComponent(slug)}/stations/${encodeURIComponent(stationId)}/card.png`,
    previewDigest(card),
    alt,
  );
}

/** Versioned by the band and where the train was last reported, not by when
 * a board last showed it. */
export function irelandTrainPreviewImage(
  slug: string,
  code: string,
  date: string,
  train: IrelandTrain | null,
  info: IrelandNetworkInfo,
  alt: string,
): PreviewImage {
  const state = train ? [irelandTrainPreviewCard(train, info).band.label, train.live.lastLocation] : null;
  return livePreviewImage(
    `/island-of-ireland/${encodeURIComponent(slug)}/trains/${encodeURIComponent(code)}/${encodeURIComponent(date)}/card.png`,
    previewDigest([code, date, state]),
    alt,
  );
}
