'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Text } from '@mantine/core';
import { ConfirmActionButton } from './ConfirmActionButton';
import { describeFailure, failureFromResponse } from '@/lib/failure';
import type { SetTemplateActiveRequest } from '@/lib/types';

function setActive(templateId: number, active: boolean): Promise<Response> {
  const body: SetTemplateActiveRequest = { active };
  return fetch(`/api/JourneyTemplates/${templateId}/active`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** "Pause" or "Resume" for a regular journey (§4.4,
 * `PUT /JourneyTemplates/{id}/active`). Pausing asks first: journeys
 * already added that you haven't changed are removed (decision 16), and a
 * pair pauses together. Resuming needs no dialog. */
export function PauseRegularJourneyButton({
  templateId,
  active,
  paired = false,
}: {
  templateId: number;
  active: boolean;
  paired?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!active) {
    return (
      <>
        <Button
          size="xs"
          variant="default"
          loading={busy}
          onClick={() => {
            setBusy(true);
            setError(null);
            setActive(templateId, true)
              .then(async (response) => {
                if (!response.ok) setError(await failureFromResponse('resume', 'this regular journey', response));
                else router.refresh();
              })
              .catch(() => setError(describeFailure('resume', 'this regular journey')))
              .finally(() => setBusy(false));
          }}
        >
          Resume
        </Button>
        {error && (
          <Text size="sm" c="red">
            {error}
          </Text>
        )}
      </>
    );
  }

  return (
    <ConfirmActionButton
      label="Pause"
      actionName="pause regular journey"
      title="Pause this regular journey?"
      tone="neutral"
      request={() => setActive(templateId, false)}
      failure={['pause', 'this regular journey']}
      loginPrompt="Log in to pause this regular journey"
    >
      No new journeys are added while it&apos;s paused. Journeys already added that you haven&apos;t changed are
      removed.{paired && ' Pauses the return journey too.'}
    </ConfirmActionButton>
  );
}
