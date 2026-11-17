'use client';

import { legRef } from '@/lib/publicId';
import { useState } from 'react';
import { Button } from '@mantine/core';
import { useJourneyPast, useMissedOffer } from './MissedOfferContext';
import { AlternativesSheet, type AlternativesMode } from './AlternativesSheet';
import { breakTitle } from '@/lib/journeyBreak';
import { legDepartureInstant } from '@/lib/journeyLegChaining';
import type { JourneyLegDetail } from '@/lib/types';

/** What the journey page knows about a leg for these actions. */
export interface LegReplanContext {
  /** The journey's open break, if any. */
  openBreakId: number | null;
  /** This leg is the open break's trigger. */
  isBreakTrigger: boolean;
  /** The owner muted suggestions for this journey. */
  suggestionsMuted: boolean;
}

/** A train leg's mid-journey actions, for the owner (spec §8.2, amended by
 * the missed-train redesign, DS-534):
 *
 * - "I missed this train" on the first train leg not yet over, and a small
 *   "I missed this one" on any other train leg until its miss window closes
 *   (04:00 London the morning after its service date), even after the train
 *   has run on to its destination without the traveller (`missedOffer`,
 *   kept current by `MissedOfferProvider`). Never on a cancelled leg. It
 *   opens the sheet with the other ways from here, and only taking one
 *   records the train as missed. Closing the sheet leaves the journey as
 *   it was: no break, so no "You missed the ..." banner;
 * - "Find another way" on a leg whose train is cancelled or which broke
 *   the plan: the open break's suggestions, or other trains for a
 *   cancelled leg when no break is open yet.
 *
 * "Change train" (phase 0) stays beside these in `JourneyLegCard`. */
export function LegReplanActions({
  journeyId,
  leg,
  context,
}: {
  journeyId: string;
  leg: JourneyLegDetail;
  context: LegReplanContext;
}) {
  const [mode, setMode] = useState<AlternativesMode | null>(null);
  const cancelled = leg.trackedTrainState?.status === 'cancelled';
  const offer = useMissedOffer(leg);
  const journeyPast = useJourneyPast();
  const showMissed = offer !== null && !cancelled;
  const showFindAnother = cancelled || context.isBreakTrigger;
  if (!showMissed && !showFindAnother) return null;

  const facts = {
    departure: legDepartureInstant(leg),
    trainDestinationName: leg.trackedTrainState?.scheduleDestinationName ?? null,
    legDestinationName: leg.destinationName,
    stationName: null,
  };
  const findAnother: AlternativesMode =
    context.openBreakId !== null
      ? { kind: 'break', breakId: context.openBreakId }
      : { kind: 'alternatives', legId: legRef(leg), cause: 'cancelled' };
  // "I missed this train" only looks: "Other ways to ...", never "You
  // missed the ...".
  const fallbackTitle = breakTitle({ ...facts, cause: cancelled ? 'cancelled' : null });

  return (
    <>
      {showMissed && (
        <Button
          size="xs"
          variant={offer === 'main' ? 'default' : 'subtle'}
          onClick={() =>
            setMode({ kind: 'missed', legId: legRef(leg), inboundLate: leg.connection?.state === 'missed' })
          }
        >
          {offer === 'main' ? 'I missed this train' : 'I missed this one'}
        </Button>
      )}
      {showFindAnother && (
        <Button size="xs" variant="light" onClick={() => setMode(findAnother)}>
          Find another way
        </Button>
      )}
      {mode !== null && (
        <AlternativesSheet
          journeyId={journeyId}
          mode={mode}
          opened
          onClose={() => setMode(null)}
          fallbackTitle={fallbackTitle}
          canMute={mode.kind !== 'alternatives' && !context.suggestionsMuted}
          journeyPast={journeyPast}
        />
      )}
    </>
  );
}
