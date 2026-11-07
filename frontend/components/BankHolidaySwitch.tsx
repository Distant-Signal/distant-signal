'use client';

import { useEffect, useId, useState } from 'react';
import { Select, Stack, Switch, Text } from '@mantine/core';
import { TextLink } from './TextLink';
import { asDivision, BANK_HOLIDAY_DIVISIONS, BANK_HOLIDAYS_PREFERENCES_HREF, divisionLabel } from '@/lib/bankHolidays';
import type { BankHolidayDivision, Preferences } from '@/lib/types';

/** The traveller's bank holiday division, read once from
 * `GET /api/preferences`: `undefined` until it answers (or when it can't,
 * logged out say), `null` when they haven't chosen one. */
export function useBankHolidayDivision(): BankHolidayDivision | null | undefined {
  const [division, setDivision] = useState<BankHolidayDivision | null | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    const isCancelled = () => cancelled;
    void (async () => {
      try {
        const response = await fetch('/api/preferences');
        if (!response.ok || isCancelled()) return;
        const body = (await response.json()) as Preferences;
        if (!isCancelled()) setDivision(body.bankHolidayDivision ?? null);
      } catch {
        // The description falls back to the default division.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return division;
}

/** "Skip bank holidays" on the regular journey forms (regular journeys
 * design §8.3), on by default. Its description names whose holidays they
 * are, "England and Wales bank holidays.", with "Change" linking to
 * Preferences.
 *
 * `ask` is the one-time inline question for someone who hasn't chosen a
 * division yet: a select (England and Wales first) in place of the
 * description. The form saves the answer to Preferences with the regular
 * journey, so it is asked only once. */
export function BankHolidaySwitch({
  checked,
  onChange,
  division,
  ask,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  division: BankHolidayDivision | null | undefined;
  ask?: { value: BankHolidayDivision; onChange: (division: BankHolidayDivision) => void } | undefined;
}) {
  const descriptionId = useId();
  const describe = !(ask && checked);
  return (
    <Stack gap="xs">
      {/* The description sits outside the switch's label, so its link is
          not part of the switch's name and never toggles it. */}
      <Stack gap={2}>
        <Switch
          label="Skip bank holidays"
          checked={checked}
          onChange={(event) => onChange(event.currentTarget.checked)}
          aria-describedby={describe ? descriptionId : undefined}
        />
        {describe && (
          <Text id={descriptionId} size="xs" c="dimmed">
            {divisionLabel(division ?? null)} bank holidays.{' '}
            <TextLink href={BANK_HOLIDAYS_PREFERENCES_HREF} inline size="xs" underline="always">
              Change
            </TextLink>
          </Text>
        )}
      </Stack>
      {ask && checked && (
        <Select
          label="Whose bank holidays?"
          description="We'll use this for all your regular journeys."
          data={BANK_HOLIDAY_DIVISIONS.map((option) => ({ value: option.value, label: option.label }))}
          value={ask.value}
          onChange={(value) => {
            const next = asDivision(value);
            if (next) ask.onChange(next);
          }}
          allowDeselect={false}
          maw={320}
        />
      )}
    </Stack>
  );
}
