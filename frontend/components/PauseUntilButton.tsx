'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Group, Modal, Stack, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { DateInput } from '@/components/LazyDateFields';
import { PICKER_DATE_FORMAT, formatDate } from '@/lib/dateFormat';
import { describeFailure, failureFromResponse } from '@/lib/failure';
import { addCalendarDays, londonToday } from '@/lib/londonWallClock';
import { removedJourneysNote } from '@/lib/timeAway';
import type { SetTemplateActiveResponse, SetTemplatePausedUntilRequest } from '@/lib/types';

function setPausedUntil(templateId: number, pausedUntil: string | null): Promise<Response> {
  const body: SetTemplatePausedUntilRequest = { pausedUntil };
  return fetch(`/api/JourneyTemplates/${templateId}/paused-until`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** "Pause until" for a regular journey (the scheduling options' R1,
 * `PUT /JourneyTemplates/{id}/paused-until`): a dialog asks for the day it
 * starts again on. No journey is added before it, journeys already added
 * that the traveller hasn't changed are removed, and a pair pauses
 * together. While paused, it says "Paused until 20 Nov 2026." with
 * "Start again now". */
export function PauseUntilButton({
  templateId,
  pausedUntil,
  paired = false,
}: {
  templateId: number;
  /** The day it starts again on, when paused until one still to come. */
  pausedUntil: string | null;
  paired?: boolean;
}) {
  const router = useRouter();
  const [opened, { open, close }] = useDisclosure(false);
  const [date, setDate] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const today = londonToday();

  async function save(value: string | null) {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const response = await setPausedUntil(templateId, value);
      if (!response.ok) {
        setError(
          await failureFromResponse(
            value ? 'pause' : 'start',
            value ? 'this regular journey' : 'this regular journey again',
            response,
          ),
        );
        return;
      }
      const result = (await response.json()) as SetTemplateActiveResponse;
      close();
      setNote(value ? removedJourneysNote(result.deletedJourneyIds.length) : null);
      router.refresh();
    } catch {
      setError(
        describeFailure(value ? 'pause' : 'start', value ? 'this regular journey' : 'this regular journey again'),
      );
    } finally {
      setBusy(false);
    }
  }

  if (pausedUntil && pausedUntil > today) {
    return (
      <Stack gap={4}>
        <Group gap="xs" wrap="wrap">
          <Text size="sm" role="status">
            Paused until {formatDate(`${pausedUntil}T12:00:00Z`)}.
          </Text>
          <Button size="compact-sm" variant="subtle" loading={busy} onClick={() => void save(null)}>
            Start again now
          </Button>
        </Group>
        {note && (
          <Text size="sm" c="dimmed">
            {note}
          </Text>
        )}
        {error && (
          <Text size="sm" c="red">
            {error}
          </Text>
        )}
      </Stack>
    );
  }

  return (
    <>
      <Button
        size="xs"
        variant="default"
        onClick={() => {
          setError(null);
          setDate(null);
          open();
        }}
      >
        Pause until
      </Button>
      <Modal opened={opened} onClose={() => !busy && close()} title="Pause until a date?">
        <Stack>
          <DateInput
            label="Starts again on"
            valueFormat={PICKER_DATE_FORMAT}
            value={date}
            onChange={setDate}
            minDate={addCalendarDays(today, 1)}
            maxDate={addCalendarDays(today, 366)}
          />
          <Text size="sm">
            No journeys are added before then. Journeys already added that you haven&apos;t changed are removed.
            {paired && ' Pauses the return journey too.'}
          </Text>
          {error && <Alert color="red">{error}</Alert>}
          <Group justify="flex-end">
            <Button variant="default" onClick={close} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={() => void save(date)} disabled={!date} loading={busy}>
              Pause
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
