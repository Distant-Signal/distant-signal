'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Checkbox, Group, Modal, NativeSelect, Stack, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useNeedsLogin } from './useNeedsLogin';
import { LoginControl } from './LoginControl';
import { formatDate } from '@/lib/dateFormat';
import { describeFailure, failureFromResponse } from '@/lib/failure';
import type { SkipTemplateDateRequest, SkipTemplateDateResponse } from '@/lib/types';

/** "Skip next" on a regular journey, or "Skip" on one of its journeys
 * (regular journeys design §4.4): a small dialog, "Skip 10 Nov 2026?"
 * (with `dates`, a choice of how many of the next dates to skip: "Skip 3
 * dates?"),
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
  dates,
  paired = false,
  label = 'Skip next',
  afterSkipHref,
}: {
  templateId: number;
  /** The London date to skip (`YYYY-MM-DD`). */
  date: string;
  /** The next dates a journey is made for, `date` first: offers "Skip
   * the next 2", up to all of them, in one request. */
  dates?: readonly string[] | undefined;
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
  const [skipped, setSkipped] = useState<{ dates: string[]; templateIds: number[] } | null>(null);
  const [undoError, setUndoError] = useState<string | null>(null);
  const [count, setCount] = useState(1);
  const needsLoginState = useNeedsLogin();
  const choices = dates && dates.length > 0 && dates[0] === date ? dates : [date];
  const chosen = choices.slice(0, count);
  const dateLabel = formatDate(`${date}T12:00:00Z`);
  const lastLabel = formatDate(`${chosen[chosen.length - 1]}T12:00:00Z`);
  const title = chosen.length === 1 ? `Skip ${dateLabel}?` : `Skip ${chosen.length} dates?`;
  const confirmLabel = chosen.length === 1 ? `Skip ${dateLabel}` : `Skip ${chosen.length} dates`;

  function handleOpen() {
    setError(null);
    setWithReturn(true);
    setCount(1);
    needsLoginState.reset();
    open();
  }

  async function handleSkip() {
    setBusy(true);
    setError(null);
    needsLoginState.reset();
    try {
      const body: SkipTemplateDateRequest =
        chosen.length === 1
          ? { serviceDate: date, pair: paired && withReturn }
          : { serviceDates: chosen, pair: paired && withReturn };
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
      setSkipped({ dates: result.serviceDates, templateIds: result.templateIds });
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
        skipped.templateIds.flatMap((id) =>
          skipped.dates.map((day) => fetch(`/api/JourneyTemplates/${id}/skip/${day}`, { method: 'DELETE' })),
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
            {skippedMessage(skipped.dates)}
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
      <Modal opened={opened} onClose={() => !busy && close()} title={title}>
        <Stack>
          {choices.length > 1 && (
            <NativeSelect
              label="How many dates"
              value={String(count)}
              onChange={(event) => setCount(Number(event.currentTarget.value))}
              data={choices.map((day, index) => ({
                value: String(index + 1),
                label:
                  index === 0 ? `Only ${dateLabel}` : `The next ${index + 1}, up to ${formatDate(`${day}T12:00:00Z`)}`,
              }))}
            />
          )}
          {chosen.length > 1 && (
            <Text size="sm">
              From {dateLabel} up to {lastLabel}.
            </Text>
          )}
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
            <Button onClick={() => void handleSkip()} loading={busy} aria-label={confirmLabel}>
              Skip
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}

/** "Skipped 10 Nov 2026." or "Skipped 3 dates, from 10 Nov 2026 up to 12
 * Nov 2026." */
function skippedMessage(dates: readonly string[]): string {
  const first = formatDate(`${dates[0]}T12:00:00Z`);
  if (dates.length === 1) return `Skipped ${first}.`;
  const last = formatDate(`${dates[dates.length - 1]}T12:00:00Z`);
  return `Skipped ${dates.length} dates, from ${first} up to ${last}.`;
}
