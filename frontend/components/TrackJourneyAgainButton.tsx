'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@mantine/core';
import { RepeatJourneyDialog } from './RepeatJourneyDialog';
import { canPlanAgain } from '@/lib/journeyRepeat';
import { trackAgainHref } from '@/lib/trackAgainPrefill';
import type { JourneyDetail } from '@/lib/types';

/** "Track this journey again". For the owner and anyone the journey is
 * shared with in a group, it plans the whole route again, every leg, on a
 * day and time they choose, preferring the same trains, and shows the
 * trains before saving a new journey (`RepeatJourneyDialog`). A visitor
 * through a share link has no account to save to, and a journey we can't
 * plan again (an Irish train, a tram or metro ride) keeps the older link:
 * Track a train pre-filled from the first train leg
 * (`lib/trackAgainPrefill.ts`). Renders nothing when there is nothing to
 * start from. */
export function TrackJourneyAgainButton({
  journey,
  viaShareLink = false,
}: {
  journey: JourneyDetail;
  /** Opened through a share link, with no session. */
  viaShareLink?: boolean;
}) {
  const router = useRouter();
  const [opened, setOpened] = useState(false);
  const href = trackAgainHref(journey);
  const plansAgain = !viaShareLink && canPlanAgain(journey);
  if (!plansAgain && href === null) return null;

  if (!plansAgain) {
    return (
      <Button variant="default" size="xs" onClick={() => href && router.push(href)}>
        Track this journey again
      </Button>
    );
  }
  return (
    <>
      <Button variant="default" size="xs" onClick={() => setOpened(true)}>
        Track this journey again
      </Button>
      <RepeatJourneyDialog
        journeyId={journey.id}
        mode="repeat"
        customName={journey.customName}
        trackHref={href}
        opened={opened}
        onClose={() => setOpened(false)}
      />
    </>
  );
}
