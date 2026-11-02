import type { JourneyListItem, TrackedTrainListItem } from '@/lib/types';

/** The caller's own tracked trains, split into the ones a listed journey
 * owns and the ones tracked on their own. */
export interface JourneyTrainSplit {
  /** Trains no listed journey owns, in the order given. */
  standalone: TrackedTrainListItem[];
  /** Journey id to the ids of the trains folded into it. */
  trainIdsByJourney: Map<number, number[]>;
}

/** The one rule for `/journeys`: a tracked train that belongs to ANY leg
 * of one of the caller's journeys is shown under that journey, never again
 * as a standalone tracked train.
 *
 * `journeyIds` (`GET /Train/mine`) names every journey a train belongs to,
 * whichever leg it is. A train goes under the first of those that is
 * actually on the page: one whose journey fell outside `GET /Journeys/mine`'s
 * cap stays a standalone row rather than vanishing. `journeys` is `null`
 * when that fetch failed: nothing is folded then, so nothing disappears. */
export function splitJourneyTrains(
  trains: TrackedTrainListItem[],
  journeys: JourneyListItem[] | null,
): JourneyTrainSplit {
  const standalone: TrackedTrainListItem[] = [];
  const trainIdsByJourney = new Map<number, number[]>();
  const listed = new Set((journeys ?? []).map((journey) => journey.id));

  for (const train of trains) {
    const journeyId = train.journeyIds.find((id) => listed.has(id));
    if (journeyId === undefined) {
      standalone.push(train);
      continue;
    }
    const folded = trainIdsByJourney.get(journeyId) ?? [];
    folded.push(train.id);
    trainIdsByJourney.set(journeyId, folded);
  }
  return { standalone, trainIdsByJourney };
}
