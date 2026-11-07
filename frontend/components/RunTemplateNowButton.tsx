'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Modal, Stack, Text } from '@mantine/core';
import { DateInput } from '@/components/LazyDateFields';
import { useDisclosure } from '@mantine/hooks';
import { addCalendarDays, nowInLondon } from '@/lib/londonWallClock';
import { PICKER_DATE_FORMAT, formatDate } from '@/lib/dateFormat';
import { useNeedsLogin } from './useNeedsLogin';
import { LoginControl } from './LoginControl';
import type { AddTemplateExtraDateRequest, MaterializeTemplateRequest, MaterializeTemplateResponse } from '@/lib/types';
import { describeFailure, failureFromResponse } from '@/lib/failure';

/** "Add a date" (was "Run now") — the manual, on-demand materialization trigger
 * (`POST /JourneyTemplates/{id}/materialize`), §6 item 3. Defaults its
 * date field to London's today (`nowInLondon().format('YYYY-MM-DD')`, same convention
 * `AddJourneyLegButton`'s own `handleOpen` already uses) but always sends
 * it explicitly — there is no implicit "today" on the wire
 * (`MaterializeTemplateRequest.serviceDate` is required, matching
 * `crates/api/src/routes/journey_templates.rs::MaterializeTemplateRequest`'s
 * own doc comment). Clicking this MORE THAN ONCE for the same date is
 * explicitly supported, not blocked — see the Phase B plan's Judgment
 * Call 7 — so this component adds no "already ran today" guard of its
 * own. On success, navigates straight to the freshly-minted journey's own
 * detail page (`/journeys/{journeyId}`) — the natural next step is
 * picking a candidate for each newly-unmatched leg there.
 *
 * With `keepLaterDates` (R2, decision 6), a date after tomorrow is kept
 * instead (`POST /JourneyTemplates/{id}/extra-dates`): the journey is
 * added the evening before, like the regular journey's other dates, and
 * the page says so. */
export function RunTemplateNowButton({
  templateId,
  keepLaterDates = false,
}: {
  templateId: number;
  keepLaterDates?: boolean;
}) {
  const router = useRouter();
  const [kept, setKept] = useState<string | null>(null);
  const [opened, { open, close }] = useDisclosure(false);
  const [serviceDate, setServiceDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const needsLoginState = useNeedsLogin();

  function handleOpen() {
    setServiceDate(nowInLondon().format('YYYY-MM-DD'));
    setKept(null);
    setError(null);
    needsLoginState.reset();
    open();
  }

  // A `DateInput` only ever emits a real calendar date ("YYYY-MM-DD"), and
  // isn't clearable, so the one way to be invalid is never having had one.
  const serviceDateValid = serviceDate !== '';

  async function handleSubmit() {
    if (!serviceDateValid) return;
    setSubmitting(true);
    setError(null);
    needsLoginState.reset();
    const tomorrow = addCalendarDays(nowInLondon().format('YYYY-MM-DD'), 1);
    if (keepLaterDates && serviceDate > tomorrow) {
      await keepDate();
      return;
    }
    try {
      const body: MaterializeTemplateRequest = { serviceDate };
      const response = await fetch(`/api/JourneyTemplates/${templateId}/materialize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        if (response.status === 401) {
          needsLoginState.markNeedsLogin();
        } else {
          setError(await failureFromResponse('add', 'this date', response));
        }
        setSubmitting(false);
        return;
      }
      const result = (await response.json()) as MaterializeTemplateResponse;
      setSubmitting(false);
      close();
      router.push(`/journeys/${result.journeyId}`);
    } catch {
      setError(describeFailure('add', 'this date'));
      setSubmitting(false);
    }
  }

  async function keepDate() {
    try {
      const body: AddTemplateExtraDateRequest = { serviceDate };
      const response = await fetch(`/api/JourneyTemplates/${templateId}/extra-dates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        if (response.status === 401) needsLoginState.markNeedsLogin();
        else setError(await failureFromResponse('add', 'this date', response));
        return;
      }
      close();
      setKept(serviceDate);
      router.refresh();
    } catch {
      setError(describeFailure('add', 'this date'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Button onClick={handleOpen}>Add a date</Button>
      {kept && (
        <Text size="sm" role="status">
          Added {formatDate(`${kept}T12:00:00Z`)}. The journey is added the evening before.
        </Text>
      )}
      <Modal opened={opened} onClose={close} title="Add a date">
        <Stack>
          {/* Was free text with a "YYYY-MM-DD" placeholder, which showed
              visitors an ISO date and let a garbled one reach the API. The
              request still carries "YYYY-MM-DD". */}
          <DateInput
            label="Date"
            valueFormat={PICKER_DATE_FORMAT}
            value={serviceDate || null}
            onChange={(value) => setServiceDate(value ?? '')}
          />
          {error && <Alert color="red">{error}</Alert>}
          {needsLoginState.needsLogin && <LoginControl underline="always">Log in to add a date</LoginControl>}
          <Button onClick={handleSubmit} disabled={!serviceDateValid} loading={submitting}>
            Add journey
          </Button>
        </Stack>
      </Modal>
    </>
  );
}
