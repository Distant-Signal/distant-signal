'use client';

import { useState } from 'react';
import { Alert, Button, Stack } from '@mantine/core';
import { describeFailure } from '@/lib/failure';

/** "Download calendar file": this journey as a one-off `.ics` file
 * (`GET /Journeys/{id}/calendar.ics`, ds-api's docs/calendar-feed.md).
 *
 * Fetches the file and then saves it, instead of linking to it, so a
 * failure (the journey is gone, the feed is off, the api is down) shows
 * "Couldn't download the calendar file." and never saves an error body as
 * `journey-N.ics`. It is a copy, not the subscription: Preferences has the
 * live feed. */
export function DownloadCalendarButton({ journeyId }: { journeyId: number }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/Journeys/${journeyId}/calendar.ics`);
      if (!response.ok) {
        setError(describeFailure('download', 'the calendar file', response.status));
        return;
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = `journey-${journeyId}.ics`;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError(describeFailure('download', 'the calendar file'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Stack gap="xs" align="flex-start">
      <Button variant="default" size="xs" onClick={() => void download()} loading={busy}>
        Download calendar file
      </Button>
      {error && <Alert color="red">{error}</Alert>}
    </Stack>
  );
}
