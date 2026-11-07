'use client';

import { useState } from 'react';
import { Alert, Button, Group, Stack, Text, TextInput } from '@mantine/core';
import { DateInput } from '@/components/LazyDateFields';
import { PreferencesSection } from './PreferencesSection';
import { PICKER_DATE_FORMAT } from '@/lib/dateFormat';
import { describeFailure, failureFromResponse } from '@/lib/failure';
import { addCalendarDays, londonToday } from '@/lib/londonWallClock';
import { removedJourneysNote, timeAwayLabel } from '@/lib/timeAway';
import type { TimeAwayPeriod, TimeAwayRequest, TimeAwayResponse } from '@/lib/types';

/** The longest name, as the api allows. */
const MAX_LABEL = 60;

/** "Time away" (the scheduling options' R1): dates none of the
 * traveller's regular journeys runs on, a holiday say. Each period is
 * listed with "Delete"; "Add time away" takes the first and last day and
 * an optional name (`POST /api/preferences/time-away`). Adding one removes
 * the journeys already added for those dates that the traveller hasn't
 * changed, and says how many. A period goes the day after it ends. */
export function TimeAwaySection({ initial }: { initial: TimeAwayPeriod[] }) {
  const [periods, setPeriods] = useState<TimeAwayPeriod[]>(initial);
  const [startsOn, setStartsOn] = useState<string | null>(null);
  const [endsOn, setEndsOn] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const today = londonToday();

  async function add() {
    if (!startsOn || !endsOn) return;
    setBusy(true);
    setStatus(null);
    setError(null);
    const body: TimeAwayRequest = { startsOn, endsOn, label: label.trim() || null };
    try {
      const response = await fetch('/api/preferences/time-away', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        setError(await failureFromResponse('add', 'your time away', response));
        return;
      }
      const result = (await response.json()) as TimeAwayResponse;
      setPeriods((current) =>
        [...current, result.period].sort((a, b) => a.startsOn.localeCompare(b.startsOn) || a.id - b.id),
      );
      setStartsOn(null);
      setEndsOn(null);
      setLabel('');
      setStatus(['Added.', removedJourneysNote(result.deletedJourneyIds.length)].filter(Boolean).join(' '));
    } catch {
      setError(describeFailure('add', 'your time away'));
    } finally {
      setBusy(false);
    }
  }

  async function remove(period: TimeAwayPeriod) {
    setBusy(true);
    setStatus(null);
    setError(null);
    try {
      const response = await fetch(`/api/preferences/time-away/${period.id}`, { method: 'DELETE' });
      if (!response.ok && response.status !== 404) {
        setError(await failureFromResponse('delete', 'that time away', response));
        return;
      }
      setPeriods((current) => current.filter((other) => other.id !== period.id));
      setStatus('Deleted. Journeys for those dates are added again as usual.');
    } catch {
      setError(describeFailure('delete', 'that time away'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <PreferencesSection
      id="time-away-heading"
      title="Time away"
      description="None of your regular journeys runs on these dates. Journeys already added for them that you haven't changed are removed."
    >
      {periods.length === 0 ? (
        <Text size="sm">No time away.</Text>
      ) : (
        <Stack gap="xs" component="ul" className="ds-plain-list">
          {periods.map((period) => (
            <Group key={period.id} component="li" justify="space-between" wrap="nowrap" gap="sm">
              <Text size="sm">{timeAwayLabel(period)}</Text>
              <Button
                size="compact-sm"
                variant="subtle"
                color="red"
                disabled={busy}
                onClick={() => void remove(period)}
                aria-label={`Delete time away, ${timeAwayLabel(period)}`}
              >
                Delete
              </Button>
            </Group>
          ))}
        </Stack>
      )}
      <Group gap="sm" grow align="flex-start">
        <DateInput
          label="First day away"
          valueFormat={PICKER_DATE_FORMAT}
          value={startsOn}
          onChange={(value) => {
            setStartsOn(value);
            if (value && endsOn && endsOn < value) setEndsOn(value);
          }}
          minDate={today}
          maxDate={addCalendarDays(today, 366)}
        />
        <DateInput
          label="Last day away"
          valueFormat={PICKER_DATE_FORMAT}
          value={endsOn}
          onChange={setEndsOn}
          minDate={startsOn ?? today}
          maxDate={addCalendarDays(startsOn ?? today, 366)}
        />
      </Group>
      <TextInput
        label="Name (optional)"
        placeholder="e.g. Holiday"
        value={label}
        maxLength={MAX_LABEL}
        onChange={(event) => setLabel(event.currentTarget.value)}
        maw={320}
      />
      <Button
        onClick={() => void add()}
        disabled={!startsOn || !endsOn || busy}
        loading={busy}
        className="ds-self-start"
      >
        Add time away
      </Button>
      {status && (
        <Text size="sm" c="dimmed" role="status">
          {status}
        </Text>
      )}
      {error && <Alert color="red">{error}</Alert>}
    </PreferencesSection>
  );
}
