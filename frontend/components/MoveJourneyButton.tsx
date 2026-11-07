'use client';

import { useState } from 'react';
import { Button } from '@mantine/core';
import { RepeatJourneyDialog } from './RepeatJourneyDialog';

/** "Move this journey", the owner's, until the journey starts: the same
 * route on another day or at another time, every leg planned again and
 * shown before the journey is changed (`RepeatJourneyDialog`). The journey
 * keeps its name, its earlier plans and its regular journey. */
export function MoveJourneyButton({
  journeyId,
  serviceDate,
}: {
  journeyId: number;
  /** The journey's first day (`YYYY-MM-DD`): where the dialog starts. */
  serviceDate: string | null;
}) {
  const [opened, setOpened] = useState(false);
  return (
    <>
      <Button variant="default" size="xs" onClick={() => setOpened(true)}>
        Move this journey
      </Button>
      <RepeatJourneyDialog
        journeyId={journeyId}
        mode="move"
        customName={null}
        trackHref={null}
        initialDate={serviceDate}
        opened={opened}
        onClose={() => setOpened(false)}
      />
    </>
  );
}
