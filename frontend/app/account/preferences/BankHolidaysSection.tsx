'use client';

import { useState } from 'react';
import { Alert, Select, Text } from '@mantine/core';
import { PreferencesSection } from './PreferencesSection';
import {
  asDivision,
  BANK_HOLIDAY_DIVISIONS,
  DEFAULT_BANK_HOLIDAY_DIVISION,
  saveBankHolidayDivision,
} from '@/lib/bankHolidays';
import { describeFailure, failureFromResponse } from '@/lib/failure';
import type { BankHolidayDivision } from '@/lib/types';

/** "Bank holidays" (regular journeys design §8.3): whose bank holidays the
 * traveller's regular journeys skip. Saved as soon as it changes
 * (`PUT /api/preferences/bank-holiday-division`). Not chosen yet, it
 * shows England and Wales, which is what the api uses then. The regular
 * journey forms link here ("Change"), to this card's heading. */
export function BankHolidaysSection({ initial }: { initial: BankHolidayDivision | null }) {
  const [division, setDivision] = useState<BankHolidayDivision>(initial ?? DEFAULT_BANK_HOLIDAY_DIVISION);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function change(next: BankHolidayDivision) {
    const previous = division;
    setDivision(next);
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const response = await saveBankHolidayDivision(next);
      if (!response.ok) {
        setDivision(previous);
        setError(await failureFromResponse('save', 'your bank holidays', response));
      } else {
        setSaved(true);
      }
    } catch {
      setDivision(previous);
      setError(describeFailure('save', 'your bank holidays'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <PreferencesSection
      id="bank-holidays-heading"
      title="Bank holidays"
      description="Regular journeys skip these bank holidays unless you turn that off for a journey."
    >
      <Select
        label="Whose bank holidays"
        data={BANK_HOLIDAY_DIVISIONS.map((option) => ({ value: option.value, label: option.label }))}
        value={division}
        onChange={(value) => {
          const next = asDivision(value);
          if (next && next !== division) void change(next);
        }}
        allowDeselect={false}
        disabled={saving}
        maw={320}
      />
      {saved && (
        <Text size="sm" c="dimmed" role="status">
          Saved.
        </Text>
      )}
      {error && <Alert color="red">{error}</Alert>}
    </PreferencesSection>
  );
}
