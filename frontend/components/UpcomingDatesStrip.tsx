'use client';

import { useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Chip, Group, Stack, Text } from '@mantine/core';
import { LoginControl } from './LoginControl';
import { useNeedsLogin } from './useNeedsLogin';
import { describeFailure, failureFromResponse } from '@/lib/failure';
import { canToggle, shortDateLabel, skipReasonLabel } from '@/lib/upcomingDates';
import classes from './UpcomingDatesStrip.module.css';
import type { SkipTemplateDateRequest, UpcomingDate } from '@/lib/types';

/** A regular journey's next dates (`upcomingDates`), each a chip that is on
 * when a journey is made for that date. Turning one off skips it
 * (`POST /JourneyTemplates/{id}/skip`, the return journey too on a pair);
 * turning a skipped one back on undoes the skip (`DELETE .../skip/{date}`
 * on both). A bank holiday, or a reason this page doesn't know yet, can't
 * be switched here: it shows its reason, or plain "Skipped". */
export function UpcomingDatesStrip({
  templateId,
  pairedTemplateId,
  upcoming,
}: {
  templateId: number;
  /** The return journey's template, whose dates go with this one's. */
  pairedTemplateId: number | null;
  upcoming: readonly UpcomingDate[];
}) {
  const router = useRouter();
  const labelId = useId();
  const [busyDate, setBusyDate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const needsLoginState = useNeedsLogin();

  if (upcoming.length === 0) return null;

  async function toggle(day: UpcomingDate) {
    setBusyDate(day.date);
    setError(null);
    needsLoginState.reset();
    try {
      if (day.skipReason === null) {
        const body: SkipTemplateDateRequest = { serviceDates: [day.date], pair: pairedTemplateId !== null };
        const response = await fetch(`/api/JourneyTemplates/${templateId}/skip`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (response.status === 401) needsLoginState.markNeedsLogin();
        else if (!response.ok) setError(await failureFromResponse('skip', 'this date', response));
        else router.refresh();
      } else {
        const ids = pairedTemplateId === null ? [templateId] : [templateId, pairedTemplateId];
        const responses = await Promise.all(
          ids.map((id) => fetch(`/api/JourneyTemplates/${id}/skip/${day.date}`, { method: 'DELETE' })),
        );
        const failed = responses.find((response) => !response.ok);
        if (failed?.status === 401) needsLoginState.markNeedsLogin();
        else if (failed) setError(describeFailure('undo', 'the skip', failed.status));
        else router.refresh();
      }
    } catch {
      setError(
        describeFailure(day.skipReason === null ? 'skip' : 'undo', day.skipReason === null ? 'this date' : 'the skip'),
      );
    } finally {
      setBusyDate(null);
    }
  }

  return (
    <Stack gap={4}>
      <Text size="sm" fw={500} id={labelId}>
        Next dates
      </Text>
      <Group gap="xs" role="group" aria-labelledby={labelId} wrap="wrap">
        {upcoming.map((day) => {
          const reason = skipReasonLabel(day.skipReason);
          return (
            <Group key={day.date} gap={4} wrap="nowrap" data-upcoming-date={day.date}>
              <Chip
                size="xs"
                classNames={{ label: classes.label }}
                checked={day.skipReason === null}
                disabled={!canToggle(day.skipReason) || busyDate !== null}
                onChange={() => void toggle(day)}
              >
                {shortDateLabel(day.date)}
              </Chip>
              {reason && (
                <Text size="xs" c="dimmed">
                  {reason}
                </Text>
              )}
            </Group>
          );
        })}
      </Group>
      {error && (
        <Text size="sm" c="red" role="alert">
          {error}
        </Text>
      )}
      {needsLoginState.needsLogin && <LoginControl underline="always">Log in to change these dates</LoginControl>}
    </Stack>
  );
}
