import { journeyRef, refList, trackingRef } from '@/lib/publicId';
import type { JourneyListItem, TrackedTrainListItem } from '@/lib/types';

/** The caller's own tracked trains, split into the ones a listed journey
 * owns and the ones tracked on their own. */
export interface JourneyTrainSplit {
  /** Trains no listed journey owns, in the order given. */
  standalone: TrackedTrainListItem[];
  /** Journey reference (`journeyRef`) to the references (`trackingRef`) of
   * the trains folded into it. */
  trainRefsByJourney: Map<string, string[]>;
}

/** The one rule for `/journeys`: a tracked train that belongs to ANY leg
 * of one of the caller's journeys is shown under that journey, never again
 * as a standalone tracked train.
 *
 * `journeyPublicIds` (`GET /Train/mine`) names every journey a train belongs to,
 * whichever leg it is. A train goes under the first of those that is
 * actually on the page: one whose journey fell outside `GET /Journeys/mine`'s
 * cap stays a standalone row rather than vanishing. `journeys` is `null`
 * when that fetch failed: nothing is folded then, so nothing disappears. */
export function splitJourneyTrains(
  trains: TrackedTrainListItem[],
  journeys: JourneyListItem[] | null,
): JourneyTrainSplit {
  const standalone: TrackedTrainListItem[] = [];
  const trainRefsByJourney = new Map<string, string[]>();
  const listed = new Set((journeys ?? []).map(journeyRef));

  for (const train of trains) {
    const journey = refList(train.journeyPublicIds, train.journeyIds).find((ref) => listed.has(ref));
    if (journey === undefined) {
      standalone.push(train);
      continue;
    }
    const folded = trainRefsByJourney.get(journey) ?? [];
    folded.push(trackingRef(train));
    trainRefsByJourney.set(journey, folded);
  }
  return { standalone, trainRefsByJourney };
}
