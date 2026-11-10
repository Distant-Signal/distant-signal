'use client';

import { useState } from 'react';
import { Alert, Button, Group, Text } from '@mantine/core';
import { CopyableLink } from '@/components/CopyableLink';
import { describeFailure, failureFromResponse } from '@/lib/failure';
import type { CalendarFeedCreated } from '@/lib/types';
import { PreferencesSection } from './PreferencesSection';

/** The path of the calendar feed on this site, for a secret `token`
 * (`GET /public/calendar/{token}`). */
export function calendarFeedPath(token: string): string {
  return `/api/calendar/${encodeURIComponent(token)}.ics`;
}

/** "Calendar feed": an opt-in link a calendar app subscribes to, listing
 * the visitor's journeys and a Delay Repay claim reminder after a late one
 * (ds-api's docs/calendar-feed.md). Off until "Turn on calendar feed" makes
 * a link (`POST /api/account/calendar-feed`); the link is shown once, when
 * it is made, because the api stores only a scrambled form of it. "Make a
 * new link" replaces it (the old one stops working) and "Turn off" removes
 * it. The copy says what the link shows and that anyone who has it can see
 * it. */
export function CalendarFeedSection({ initialActive }: { initialActive: boolean }) {
  const [active, setActive] = useState(initialActive);
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function make() {
    setBusy(true);
    setStatus(null);
    setError(null);
    try {
      const response = await fetch('/api/account/calendar-feed', { method: 'POST' });
      if (!response.ok) {
        setError(await failureFromResponse('make', 'your calendar link', response));
        return;
      }
      const created = (await response.json()) as CalendarFeedCreated;
      setLink(`${window.location.origin}${calendarFeedPath(created.token)}`);
      setActive(true);
    } catch {
      setError(describeFailure('make', 'your calendar link'));
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    setStatus(null);
    setError(null);
    try {
      const response = await fetch('/api/account/calendar-feed', { method: 'DELETE' });
      if (!response.ok) {
        setError(await failureFromResponse('turn off', 'your calendar feed', response));
        return;
      }
      setActive(false);
      setLink(null);
      setStatus('Turned off. The link no longer works.');
    } catch {
      setError(describeFailure('turn off', 'your calendar feed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <PreferencesSection
      id="calendar-feed-heading"
      title="Calendar feed"
      description="Show your journeys in your calendar app, with a reminder to check Delay Repay after a late or cancelled one."
    >
      <Text size="sm">
        Each journey shows its two stations and when it leaves. After a late or cancelled journey, a Delay Repay
        reminder also shows that it may have been late or had a cancelled train. Calendar apps refresh slowly, often
        only every few hours or once a day, so it shows your plans, not live train times. Anyone who has the link can
        see your journeys and where you travel, so keep it private.
      </Text>
      {link && (
        <>
          <CopyableLink
            value={link}
            label="Calendar feed link"
            description="Add this as a subscribed calendar in your calendar app. It is shown only now."
          />
          <Alert variant="light" color="yellow" role="status">
            Copy it now. We keep only a scrambled form of the link, so we can&apos;t show it again. If you lose it, make
            a new one.
          </Alert>
        </>
      )}
      <Group gap="sm">
        {active ? (
          <>
            <Button variant="default" onClick={() => void make()} disabled={busy} loading={busy}>
              Make a new link
            </Button>
            <Button variant="subtle" color="red" onClick={() => void turnOff()} disabled={busy}>
              Turn off calendar feed
            </Button>
          </>
        ) : (
          <Button onClick={() => void make()} disabled={busy} loading={busy}>
            Turn on calendar feed
          </Button>
        )}
      </Group>
      {active && !link && (
        <Text size="sm" c="dimmed">
          Your calendar feed is on. Making a new link stops the old one working.
        </Text>
      )}
      {status && (
        <Text size="sm" c="dimmed" role="status">
          {status}
        </Text>
      )}
      {error && (
        <Alert color="red" role="alert">
          {error}
        </Alert>
      )}
    </PreferencesSection>
  );
}
