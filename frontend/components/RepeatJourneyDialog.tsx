'use client';

import { useCallback, useEffect, useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Group, Loader, Modal, Stack, Text, Title } from '@mantine/core';
import { TimeInput } from '@mantine/dates';
import { DateInput } from './LazyDateFields';
import { LoginControl } from './LoginControl';
import { PlanOptionRow } from './PlanOptionRow';
import { TextLink } from './TextLink';
import { PICKER_DATE_FORMAT } from '@/lib/dateFormat';
import { describeFailure, failureFromResponse } from '@/lib/failure';
import { repeatPath, repeatReasonText, unsupportedText, type RepeatMode } from '@/lib/journeyRepeat';
import { londonToday } from '@/lib/londonWallClock';
import { planOptionLegBodies, summarisePlanOption } from '@/lib/regularPlan';
import type { ItineraryRequest, JourneyRepeat, MoveJourneyRequest, RegularPlanOption } from '@/lib/types';

type Loaded =
  | { state: 'loading' }
  | { state: 'failed'; message: string }
  | { state: 'login' }
  | { state: 'loaded'; plan: JourneyRepeat };

const COPY: Record<RepeatMode, { title: string; action: string; saveVerb: string; login: string }> = {
  repeat: {
    title: 'Track this journey again',
    action: 'Track this journey',
    saveVerb: 'track',
    login: 'Log in to track this journey again',
  },
  move: {
    title: 'Move this journey',
    action: 'Move to these trains',
    saveVerb: 'move',
    login: 'Log in to move this journey',
  },
};

/** "Track this journey again" and "Move this journey": the same route on
 * the day and from the time chosen, the same trains where they still run
 * (`GET /Journeys/{id}/repeat`), shown before anything is saved. Tracking
 * again starts on today if the first train is still to leave, else
 * tomorrow; a move on the journey's own day. The time starts as the first
 * train's. Tracking again saves a new journey (`POST
 * /Journeys/itinerary`) and opens it; moving replaces this journey's legs
 * (`POST /Journeys/{id}/move`). A journey we can't plan again links to
 * Track a train instead (`trackHref`). */
export function RepeatJourneyDialog({
  journeyId,
  mode,
  customName,
  trackHref,
  initialDate = null,
  opened,
  onClose,
}: {
  journeyId: number;
  mode: RepeatMode;
  /** The journey's own name, kept on the new journey. */
  customName: string | null;
  /** "Track a train" pre-filled from the journey, `null` when there is
   * nothing to pre-fill. */
  trackHref: string | null;
  /** The day to plan first: a move starts on the journey's own day;
   * tracking again on the api's default. */
  initialDate?: string | null;
  opened: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const copy = COPY[mode];
  const headingId = useId();
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState('');
  const [loaded, setLoaded] = useState<Loaded>({ state: 'loading' });
  const [saving, setSaving] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveLogin, setSaveLogin] = useState(false);

  const plan = useCallback(
    async (askDate: string | null, askTime: string | null) => {
      setLoaded({ state: 'loading' });
      setSaveError(null);
      try {
        const response = await fetch(repeatPath(journeyId, mode, askDate, askTime));
        if (response.status === 401) {
          setLoaded({ state: 'login' });
          return;
        }
        if (!response.ok) {
          setLoaded({ state: 'failed', message: describeFailure('plan', 'this journey again', response.status) });
          return;
        }
        const body = (await response.json()) as JourneyRepeat;
        setDate(body.date);
        setTime(body.time);
        setLoaded({ state: 'loaded', plan: body });
      } catch {
        setLoaded({ state: 'failed', message: describeFailure('plan', 'this journey again') });
      }
    },
    [journeyId, mode],
  );

  useEffect(() => {
    if (!opened) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the first plan loads when the dialog opens
    void plan(initialDate, null);
  }, [opened, plan, initialDate]);

  async function save(option: RegularPlanOption, index: number) {
    setSaving(index);
    setSaveError(null);
    setSaveLogin(false);
    const legs = planOptionLegBodies(option);
    try {
      const response =
        mode === 'repeat'
          ? await fetch('/api/Journeys/itinerary', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify((customName ? { customName, legs } : { legs }) satisfies ItineraryRequest),
            })
          : await fetch(`/api/Journeys/${journeyId}/move`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ legs } satisfies MoveJourneyRequest),
            });
      if (response.status === 401) {
        setSaveLogin(true);
        setSaving(null);
        return;
      }
      if (!response.ok) {
        setSaveError(await failureFromResponse(copy.saveVerb, 'this journey', response));
        setSaving(null);
        return;
      }
      if (mode === 'repeat') {
        const body = (await response.json()) as { journeyId: number };
        router.push(`/journeys/${body.journeyId}`);
      } else {
        setSaving(null);
        onClose();
        router.refresh();
      }
    } catch {
      setSaveError(describeFailure(copy.saveVerb, 'this journey'));
      setSaving(null);
    }
  }

  const loadedPlan = loaded.state === 'loaded' ? loaded.plan : null;
  const options = loadedPlan?.choice ? [loadedPlan.choice, ...loadedPlan.alternatives] : [];

  return (
    <Modal opened={opened} onClose={onClose} title={copy.title}>
      <Stack gap="md">
        {loadedPlan?.status !== 'unsupported' && (
          <Stack gap="xs">
            <Group gap="sm" align="flex-end" wrap="wrap">
              <DateInput
                label="Date"
                valueFormat={PICKER_DATE_FORMAT}
                value={date}
                onChange={setDate}
                minDate={londonToday()}
                disabled={loaded.state === 'loading'}
              />
              <TimeInput
                label="Time"
                value={time}
                onChange={(event) => setTime(event.currentTarget.value)}
                disabled={loaded.state === 'loading'}
              />
              <Button variant="default" onClick={() => void plan(date, time)} disabled={loaded.state === 'loading'}>
                Find trains
              </Button>
            </Group>
            {loadedPlan?.originalTime && (
              <Text size="xs" c="dimmed">
                Your first train was at {loadedPlan.originalTime}.
              </Text>
            )}
          </Stack>
        )}
        {loaded.state === 'loading' && (
          <Group gap="xs">
            <Loader size="sm" />
            <Text size="sm">Finding trains</Text>
          </Group>
        )}
        {loaded.state === 'failed' && <Alert color="red">{loaded.message}</Alert>}
        {loaded.state === 'login' && <LoginControl underline="always">{copy.login}</LoginControl>}
        {loadedPlan?.status === 'pending' && (
          <Text size="sm">The timetable for that day isn&apos;t out yet. Try an earlier date.</Text>
        )}
        {loadedPlan?.status === 'no_service' && (
          <Text size="sm">There&apos;s no way to make this journey that day. Try another date or time.</Text>
        )}
        {loadedPlan?.status === 'unsupported' && (
          <Stack gap="xs">
            <Text size="sm">{unsupportedText(loadedPlan.unsupported)}</Text>
            {trackHref && mode === 'repeat' && (
              <TextLink href={trackHref} underline="always">
                Track a train instead
              </TextLink>
            )}
          </Stack>
        )}
        {loadedPlan?.status === 'planned' && options.length > 0 && (
          <Stack gap="xs" component="section" aria-labelledby={headingId}>
            <Title order={3} size="sm" id={headingId}>
              Trains
            </Title>
            {repeatReasonText(loadedPlan.reason) && (
              <Text size="sm" c="dimmed">
                {repeatReasonText(loadedPlan.reason)}
              </Text>
            )}
            {options.map((option, index) => (
              <PlanOptionRow
                key={`${option.departure}-${index}`}
                summary={summarisePlanOption(option)}
                actionLabel={copy.action}
                busy={saving === index}
                disabled={saving !== null && saving !== index}
                onAction={() => void save(option, index)}
              />
            ))}
          </Stack>
        )}
        {saveLogin && <LoginControl underline="always">{copy.login}</LoginControl>}
        {saveError && <Alert color="red">{saveError}</Alert>}
      </Stack>
    </Modal>
  );
}
