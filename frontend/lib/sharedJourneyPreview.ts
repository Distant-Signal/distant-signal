import { formatDate, formatTime } from './dateFormat';
import { journeyNameInputFromLegs, journeyRouteLabel } from './journeyName';
import { listPhrase, livePreviewImage, previewDigest, type StatusPreviewCard } from './livePreview';
import type { PreviewImage } from './pageMetadata';
import { isPassingPoint, stopDisplayTime } from './stopTimes';
import type { JourneyLegDetail } from './types';

/** The link preview of an unlisted share link (`/journeys/shared/{token}`):
 * what the page's description and its card say about the journey. Pure:
 * the legs `GET /Journeys/shared/{token}` returns, nothing else.
 *
 * It says only what the page already shows to anyone holding the link, and
 * only the timetable side of it: the route, the day, when the first leg is
 * booked to leave, how many legs and changes, and the operators. No live
 * status, delay or location in the card (a preview is seen by everyone in
 * the chat, not only the person the link was meant for: see the page's
 * `journeyStatusPhrase`), no owner-chosen name, no ids, no token text. */

export interface SharedJourneySummary {
  /** "London Kings Cross (KGX) to York (YRK)": the first leg's origin to
   * the last leg's destination. */
  route: string;
  /** "22 Sep 2026", the first leg's service date. */
  date: string;
  /** "16:00", when the first leg leaves, as the timetable has it; null
   * while it has no timetabled departure (an unmatched leg's time is a
   * search window, not a departure). */
  departure: string | null;
  /** "1 leg", "3 legs". */
  legs: string;
  /** "Direct", "1 change", "2 changes": each leg after the first is a
   * change. */
  changes: string;
  /** Train operators, each once, in travel order. */
  operators: string[];
}

/** When the first leg leaves: the timetabled time at its origin stop for a
 * train, the planned time for an untracked leg. */
function firstDeparture(leg: JourneyLegDetail): string | null {
  if (leg.kind === 'untracked') return leg.plannedDeparture;
  const crs = leg.originCrs?.toUpperCase();
  if (!crs) return null;
  const stop = leg.trackedTrainState?.journeyStops?.find(
    (candidate) => !isPassingPoint(candidate) && candidate.crs?.toUpperCase() === crs,
  );
  return stop ? stopDisplayTime(stop) : null;
}

export function changesLabel(legCount: number): string {
  if (legCount <= 1) return 'Direct';
  return legCount === 2 ? '1 change' : `${legCount - 1} changes`;
}

export function legsLabel(legCount: number): string {
  return legCount === 1 ? '1 leg' : `${legCount} legs`;
}

/** The journey's summary, or null with no legs. */
export function sharedJourneySummary(legs: readonly JourneyLegDetail[]): SharedJourneySummary | null {
  const first = legs[0];
  if (!first) return null;
  const departure = firstDeparture(first);
  const operators: string[] = [];
  for (const leg of legs) {
    const name = leg.trackedTrainState?.operatorName?.trim();
    if (name && !operators.includes(name)) operators.push(name);
  }
  return {
    route: journeyRouteLabel(journeyNameInputFromLegs(null, legs)),
    date: formatDate(first.serviceDate),
    departure: departure ? formatTime(departure) : null,
    legs: legsLabel(legs.length),
    changes: changesLabel(legs.length),
    operators,
  };
}

/** The sentences a description adds after its status: "Departs 16:00. 2
 * legs, 1 change. Operated by LNER and Avanti West Coast." */
export function sharedJourneySummarySentences(summary: SharedJourneySummary): string {
  return [
    summary.departure ? `Departs ${summary.departure}.` : null,
    `${summary.legs}, ${summary.changes.toLowerCase()}.`,
    summary.operators.length > 0 ? `Operated by ${listPhrase(summary.operators)}.` : null,
  ]
    .filter((sentence) => sentence !== null)
    .join(' ');
}

/** The journey's card (`renderStatusPreviewImage`): a neutral band, the
 * route as the title, the departure as the lead, the operators as chips
 * and the legs and changes as the one fact. Null with no legs. */
export function sharedJourneyPreviewCard(legs: readonly JourneyLegDetail[]): StatusPreviewCard | null {
  const summary = sharedJourneySummary(legs);
  if (!summary) return null;
  return {
    band: { tone: 'informational', label: 'Shared journey', aside: summary.date },
    title: summary.route,
    lead: summary.departure ? `Departs ${summary.departure}` : null,
    chips: { names: summary.operators, more: 0 },
    rows: [`${summary.legs}, ${summary.changes.toLowerCase()}`],
  };
}

/** The card's listing in the page's metadata. The URL carries a digest of
 * the card, so an edited journey is a new image in chat apps that cache by
 * URL. The token is in the path, as it is in the page's own URL. */
export function sharedJourneyPreviewImage(token: string, card: StatusPreviewCard, alt: string): PreviewImage {
  return livePreviewImage(`/journeys/shared/${encodeURIComponent(token)}/card.png`, previewDigest(card), alt);
}
