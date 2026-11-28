'use client';

import { useState } from 'react';
import { Alert, Select, Text } from '@mantine/core';
import { PreferencesSection } from './PreferencesSection';
import { CHANGE_EXTRA_MINUTE_CHOICES, changeExtraLabel, saveChangeExtraMinutes } from '@/lib/changeTime';
import { describeFailure, failureFromResponse } from '@/lib/failure';

/** "Changing trains": extra minutes added to the minimum time needed
 * between trains, saved as soon as it changes (`PUT /api/preferences/change-time`,
 * DS-757). The api accepts 0 to 30, so a stored value that isn't one of
 * the usual choices is offered as its own option rather than lost. */
export function ChangeTimeSection({ initial }: { initial: number }) {
  const [minutes, setMinutes] = useState<number>(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const choices = CHANGE_EXTRA_MINUTE_CHOICES.includes(initial)
    ? CHANGE_EXTRA_MINUTE_CHOICES
    : [...CHANGE_EXTRA_MINUTE_CHOICES, initial].sort((a, b) => a - b);

  async function change(next: number) {
    const previous = minutes;
    setMinutes(next);
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const response = await saveChangeExtraMinutes(next);
      if (!response.ok) {
        setMinutes(previous);
        setError(await failureFromResponse('save', 'your extra time', response));
      } else {
        setSaved(true);
      }
    } catch {
      setMinutes(previous);
      setError(describeFailure('save', 'your extra time'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <PreferencesSection
      id="change-time-heading"
      title="Changing trains"
      description="Added to the minimum time Distant Signal needs between trains. Journeys that fall short of it are flagged earlier."
    >
      <Select
        label="Allow extra time to change trains"
        data={choices.map((value) => ({ value: String(value), label: changeExtraLabel(value) }))}
        value={String(minutes)}
        onChange={(value) => {
          const next = value === null ? null : Number(value);
          if (next !== null && Number.isInteger(next) && next !== minutes) void change(next);
        }}
        allowDeselect={false}
        disabled={saving}
        maw={320}
      />
      {/* Always rendered so assistive tech announces the text when it appears. */}
      <Text size="sm" c="dimmed" role="status" aria-live="polite">
        {saved ? 'Saved.' : ''}
      </Text>
      {error && <Alert color="red">{error}</Alert>}
    </PreferencesSection>
  );
}
