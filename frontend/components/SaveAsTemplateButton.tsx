'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Modal, Stack, Text, TextInput } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useNeedsLogin } from './useNeedsLogin';
import { LoginControl } from './LoginControl';
import type { CreateJourneyTemplateRequest, CreateJourneyTemplateResponse } from '@/lib/types';
import { describeFailure, failureFromResponse } from '@/lib/failure';
import { regularJourneyHref } from '@/lib/regularJourneys';

/** "Make this a regular journey" (was "Make this a template") — journey-detail-page header button
 * (docs/superpowers/specs/2026-09-22-reusable-repeating-journeys-design.md
 * §6 item 2). Promotes THIS journey's shape into a durable template via
 * `POST /JourneyTemplates` (`mode: 'fromJourney'`) — the backend re-reads
 * this journey's own legs server-side, so this component needs nothing
 * but the journey's id, not its already-fetched leg data (contrast with
 * a hypothetical Phase A "Track this journey again" button, which pre-fills
 * a NEW journey's creation form client-side from data it already has — a
 * different operation entirely, targeting `/plan`, not this
 * route). On success, navigates to the new template's own detail page —
 * the natural next stop, matching `AddJourneyLegButton`'s
 * `router.refresh()`-on-success posture but going further since a whole
 * new resource, not just an update to the current page, was created. */
export function SaveAsTemplateButton({ journeyId }: { journeyId: number }) {
  const router = useRouter();
  const [opened, { open, close }] = useDisclosure(false);
  const [customName, setCustomName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const needsLoginState = useNeedsLogin();

  function handleOpen() {
    setCustomName('');
    setError(null);
    needsLoginState.reset();
    open();
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    needsLoginState.reset();
    try {
      const body: CreateJourneyTemplateRequest = {
        mode: 'fromJourney',
        journeyId,
        ...(customName.trim() ? { customName: customName.trim() } : {}),
      };
      const response = await fetch('/api/JourneyTemplates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        if (response.status === 401) {
          needsLoginState.markNeedsLogin();
        } else {
          setError(await failureFromResponse('save', 'this regular journey', response));
        }
        setSubmitting(false);
        return;
      }
      const result = (await response.json()) as CreateJourneyTemplateResponse;
      setSubmitting(false);
      close();
      router.push(regularJourneyHref(result.templateId));
    } catch {
      setError(describeFailure('save', 'this regular journey'));
      setSubmitting(false);
    }
  }

  return (
    <>
      <Button variant="default" size="xs" onClick={handleOpen}>
        Make this a regular journey
      </Button>
      <Modal opened={opened} onClose={close} title="Make this a regular journey">
        <Stack>
          <Text size="sm">
            Saves this journey&apos;s route as a regular journey. Choose its days on the next page, or add it for a date
            of your own any time.
          </Text>
          <TextInput
            label="Name (optional)"
            placeholder="e.g. Weekday commute"
            value={customName}
            onChange={(event) => setCustomName(event.currentTarget.value)}
          />
          {error && <Alert color="red">{error}</Alert>}
          {needsLoginState.needsLogin && (
            <LoginControl underline="always">Log in to save a regular journey</LoginControl>
          )}
          <Button onClick={handleSubmit} loading={submitting}>
            Save regular journey
          </Button>
        </Stack>
      </Modal>
    </>
  );
}
