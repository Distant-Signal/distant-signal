import { SNAPSHOT_NOTE } from './linePreview';
import { livePreviewImage, listPhrase, plainText, previewDigest, previewWhen, tidy } from './livePreview';
import type { StatusPreviewCard } from './livePreview';
import type { PreviewImage } from './pageMetadata';
import { severityBadgeLabel, severityGroup } from './severity';
import { stationPreviewCard } from './stationPreview';
import type { LineStatusReport, TflStopDetail, TransitLineDetail, TransitStopDetail } from './types';

/** Link previews for the transit network pages: a line
 * (`/transit/[network]/lines/[line]/card.png`), a stop
 * (`.../stops/[stop]/card.png`) and a TfL stop (`/tfl/stops/[id]/card.png`).
 * Drawn by `renderStatusPreviewImage` (`lib/livePreview.ts` for what live
 * cards share). Pure: the same objects the pages already read. */

/** Lines beyond this many on a stop's card become "and N more". */
const MAX_CHIPS = 3;

/** The line's card. The band is its worst status (the headline, worst
 * first); a line with no status data says so rather than "Good service". */
export function transitLinePreviewCard(line: TransitLineDetail, networkName: string): StatusPreviewCard {
  const title = `${tidy(line.name)}, ${networkName}`;
  const { status } = line;
  const headline = status.state === 'current' ? status.statuses[0] : undefined;
  if (!headline) {
    return {
      band: {
        tone: 'informational',
        label: status.state === 'unavailable' ? 'Status unavailable' : 'No status yet',
        aside: '',
      },
      title,
      lead: null,
      chips: { names: [], more: 0 },
      rows: [],
    };
  }
  const tone = severityGroup(headline.severity);
  const reason = tone === 'good' ? '' : plainText(headline.reason);
  const wrong = status.statuses.filter((entry) => severityGroup(entry.severity) !== 'good').length;
  return {
    band: {
      tone,
      label: severityBadgeLabel(headline.severity),
      aside: status.asOf ? `As of ${previewWhen(status.asOf)}` : '',
    },
    title,
    lead: reason === '' ? null : reason,
    chips: { names: [], more: 0 },
    rows: [wrong > 1 ? `${wrong} disruptions on this line` : null, status.asOf ? SNAPSHOT_NOTE : null].filter(
      (row): row is string => row !== null,
    ),
  };
}

/** A digest of the line's state for `?v=`: each status's severity and
 * reason, not `asOf`, which moves every cycle. */
export function transitLinePreviewVersion(line: TransitLineDetail): string {
  const { status } = line;
  return previewDigest([line.name, status.state, status.statuses.map((entry) => [entry.severity, entry.reason])]);
}

export function transitLinePreviewImage(
  network: string,
  line: string,
  detail: TransitLineDetail,
  alt: string,
): PreviewImage {
  return livePreviewImage(
    `/transit/${encodeURIComponent(network)}/lines/${encodeURIComponent(line)}/card.png`,
    transitLinePreviewVersion(detail),
    alt,
  );
}

/** A transit stop's card: not live (departures change by the minute), so a
 * neutral band, its name, the lines that call there as chips and how many
 * notices are in effect at it. */
export function transitStopPreviewCard(stop: TransitStopDetail, networkName: string): StatusPreviewCard {
  const lines = [...new Set(stop.firstLast.map((entry) => tidy(entry.line.name)))].filter((name) => name !== '');
  const notices = stop.notices.length;
  return {
    band: { tone: 'informational', label: `${networkName} stop`, aside: '' },
    title: `${tidy(stop.name)}, ${networkName}`,
    lead: notices > 0 ? `${notices} notice${notices === 1 ? '' : 's'} in effect` : null,
    chips: { names: lines.slice(0, MAX_CHIPS), more: Math.max(0, lines.length - MAX_CHIPS) },
    rows: ['Scheduled departures and the lines that call here'],
  };
}

export function transitStopPreviewImage(
  network: string,
  stopId: string,
  card: StatusPreviewCard,
  alt: string,
): PreviewImage {
  return livePreviewImage(
    `/transit/${encodeURIComponent(network)}/stops/${encodeURIComponent(stopId)}/card.png`,
    previewDigest(card),
    alt,
  );
}

/** "Underground stop", "DLR and Tram stop": a TfL stop's modes as its
 * card's fact. */
function modesRow(modes: readonly string[]): string | null {
  return modes.length > 0 ? `${listPhrase([...modes])} stop` : null;
}

/** The statuses a TfL stop's card may rely on: all `expected` lines'.
 * Fewer (a line the api had no status for, or a failed read) can't support
 * "No disruptions", so the card says "Status unavailable" instead. */
export function completeLineReports(
  reports: readonly LineStatusReport[] | null,
  expected: number,
): readonly LineStatusReport[] | null {
  return reports !== null && reports.length >= expected ? reports : null;
}

/** A TfL stop's live card: the worst status on the lines through it, as a
 * station's card (`stationPreviewCard`), with the stop's own modes as a
 * fact. `reports` are the lines' statuses, `null` when they can't be read
 * (an outage keeps the card honest: no status claimed). */
export function tflStopPreviewCard(
  stop: Pick<TflStopDetail, 'name' | 'modes'>,
  modeLabels: readonly string[],
  reports: readonly LineStatusReport[] | null,
  now: number,
): StatusPreviewCard {
  const title = tidy(stop.name);
  const modes = modesRow(modeLabels);
  if (reports === null) {
    return {
      band: { tone: 'informational', label: 'Status unavailable', aside: '' },
      title,
      lead: null,
      chips: { names: [], more: 0 },
      rows: modes ? [modes] : [],
    };
  }
  // A report per line, fine or not; none at all means no line is tracked here.
  const card = stationPreviewCard(
    title,
    reports.length > 0 ? { coverage: 'covered', reports: [...reports] } : { coverage: 'none' },
    now,
  );
  return modes ? { ...card, rows: [modes, ...card.rows] } : card;
}

export function tflStopPreviewImage(
  id: string,
  name: string,
  reports: readonly LineStatusReport[] | null,
  alt: string,
): PreviewImage {
  const state = reports?.map((report) => [report.id, report.lineStatuses.map((s) => [s.statusSeverity, s.reason])]);
  return livePreviewImage(`/tfl/stops/${encodeURIComponent(id)}/card.png`, previewDigest([name, state ?? null]), alt);
}
