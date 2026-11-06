'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Group, Modal, Stack, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { LeaveByCountdown } from './LeaveByCountdown';
import { StationBufferField } from './StationBufferField';
import { describeFailure, failureFromResponse } from '@/lib/failure';
import type { LeaveBy, StationBufferRequest } from '@/lib/types';

/** The journey page's leave-by (regular journeys design §5.4): the
 * countdown and, for the owner on the day, "Change", which edits the
 * minutes to get to the station for this journey only
 * (`PUT /Journeys/{id}/station-buffer`). */
export function JourneyLeaveBy({
  journeyId,
  leaveBy,
  stationBufferMinutes,
  delayMinutes,
  canChange,
  initialNow,
}: {
  journeyId: number;
  leaveBy: LeaveBy;
  stationBufferMinutes: number | null;
  delayMinutes: number | null;
  /** The owner, on the journey's day. */
  canChange: boolean;
  initialNow: string;
}) {
  const router = useRouter();
  const [opened, { open, close }] = useDisclosure(false);
  const [minutes, setMinutes] = useState<number | null>(stationBufferMinutes);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleOpen() {
    setMinutes(stationBufferMinutes);
    setError(null);
    open();
  }

  async function handleSave() {
    setBusy(true);
    setError(null);
    try {
      const body: StationBufferRequest = { minutes };
      const response = await fetch(`/api/Journeys/${journeyId}/station-buffer`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        setError(await failureFromResponse('save', 'the time to get to the station', response));
        return;
      }
      close();
      router.refresh();
    } catch {
      setError(describeFailure('save', 'the time to get to the station'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <LeaveByCountdown
        leaveBy={leaveBy}
        delayMinutes={delayMinutes}
        initialNow={initialNow}
        action={
          canChange && (
            <Button size="compact-sm" variant="subtle" onClick={handleOpen}>
              Change
            </Button>
          )
        }
      />
      <Modal opened={opened} onClose={close} title="Time to get to the station">
        <Stack gap="md">
          <Text size="sm">For this journey only. Your regular journey keeps its own time.</Text>
          <StationBufferField value={minutes} onChange={setMinutes} disabled={busy} />
          {error && (
            <Text size="sm" c="var(--ds-color-error-text)" role="alert">
              {error}
            </Text>
          )}
          <Group justify="flex-end" gap="xs">
            <Button variant="default" onClick={close} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={() => void handleSave()} loading={busy}>
              Save
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
