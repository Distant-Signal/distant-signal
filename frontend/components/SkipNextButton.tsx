'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Checkbox, Group, Modal, Stack, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useNeedsLogin } from './useNeedsLogin';
import { LoginControl } from './LoginControl';
import { formatDate } from '@/lib/dateFormat';
import { describeFailure, failureFromResponse } from '@/lib/failure';
import type { SkipTemplateDateRequest, SkipTemplateDateResponse } from '@/lib/types';

/** "Skip next" on a regular journey, or "Skip" on one of its journeys
 * (regular journeys design §4.4): a small dialog, "Skip 10 Nov 2026?",
 * with "Skip the return journey too" (checked) for a pair, then "Skipped
 * 10 Nov 2026." with "Undo". `POST /JourneyTemplates/{id}/skip` deletes a
 * journey already added for that date; "Undo" takes the skip back
 * (`DELETE .../skip/{date}`) and the journey is added again on the next
 * check if it is still due.
 *
 * `afterSkip` replaces the default `router.refresh()`: the journey page
 * goes back to the list, since its journey is gone. */
export function SkipNextButton({
  templateId,
  date,
  paired = false,
  label = 'Skip next',
  afterSkipHref,
}: {
  templateId: number;
  /** The London date to skip (`YYYY-MM-DD`). */
  date: string;
  /** The regular journey has a return journey: offer to skip it too. */
  paired?: boolean;
  label?: string;
  /** Where to go once skipped, instead of staying (and offering "Undo"). */
  afterSkipHref?: string | undefined;
}) {
  const router = useRouter();
  const [opened, { open, close }] = useDisclosure(false);
  const [withReturn, setWithReturn] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [skipped, setSkipped] = useState<{ date: string; templateIds: number[] } | null>(null);
  const [undoError, setUndoError] = useState<string | null>(null);
  const needsLoginState = useNeedsLogin();
  const dateLabel = formatDate(`${date}T12:00:00Z`);

  function handleOpen() {
    setError(null);
    setWithReturn(true);
    needsLoginState.reset();
    open();
  }

  async function handleSkip() {
    setBusy(true);
    setError(null);
    needsLoginState.reset();
    try {
      const body: SkipTemplateDateRequest = { serviceDate: date, pair: paired && withReturn };
      const response = await fetch(`/api/JourneyTemplates/${templateId}/skip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        if (response.status === 401) needsLoginState.markNeedsLogin();
        else setError(await failureFromResponse('skip', 'this journey', response));
        setBusy(false);
        return;
      }
      const result = (await response.json()) as SkipTemplateDateResponse;
      close();
      setBusy(false);
      if (afterSkipHref) {
        router.push(afterSkipHref);
        return;
      }
      setSkipped({ date: result.serviceDate, templateIds: result.templateIds });
      router.refresh();
    } catch {
      setError(describeFailure('skip', 'this journey'));
      setBusy(false);
    }
  }

  async function handleUndo() {
    if (!skipped) return;
    setBusy(true);
    setUndoError(null);
    try {
      const responses = await Promise.all(
        skipped.templateIds.map((id) =>
          fetch(`/api/JourneyTemplates/${id}/skip/${skipped.date}`, { method: 'DELETE' }),
        ),
      );
      const failed = responses.find((response) => !response.ok);
      if (failed) {
        setUndoError(describeFailure('undo', 'the skip', failed.status));
      } else {
        setSkipped(null);
        router.refresh();
      }
    } catch {
      setUndoError(describeFailure('undo', 'the skip'));
    } finally {
      setBusy(false);
    }
  }

  if (skipped) {
    return (
      <Stack gap={4}>
        <Group gap="xs" wrap="wrap">
          <Text size="sm" role="status">
            Skipped {formatDate(`${skipped.date}T12:00:00Z`)}.
          </Text>
          <Button size="compact-sm" variant="subtle" onClick={() => void handleUndo()} loading={busy}>
            Undo
          </Button>
        </Group>
        {undoError && (
          <Text size="sm" c="red">
            {undoError}
          </Text>
        )}
      </Stack>
    );
  }

  return (
    <>
      <Button size="xs" variant="default" onClick={handleOpen}>
        {label}
      </Button>
      <Modal opened={opened} onClose={() => !busy && close()} title={`Skip ${dateLabel}?`}>
        <Stack>
          {paired && (
            <Checkbox
              label="Skip the return journey too"
              checked={withReturn}
              onChange={(event) => setWithReturn(event.currentTarget.checked)}
            />
          )}
          {error && <Alert color="red">{error}</Alert>}
          {needsLoginState.needsLogin && <LoginControl underline="always">Log in to skip this journey</LoginControl>}
          <Group justify="flex-end">
            <Button variant="default" onClick={close} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={() => void handleSkip()} loading={busy} aria-label={`Skip ${dateLabel}`}>
              Skip
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
