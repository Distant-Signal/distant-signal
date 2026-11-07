'use client';

import { useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Card, Group, Stack, Text, Title } from '@mantine/core';
import { SectionTitle } from './SectionTitle';
import { LoginControl } from './LoginControl';
import { useNeedsLogin } from './useNeedsLogin';
import { describeFailure, failureFromResponse } from '@/lib/failure';
import { planDayPhrase, planOptionDetail, planOptionTitle, summarisePlanOption } from '@/lib/regularPlan';
import { PlanOptionRow } from './PlanOptionRow';
import type { RegularPlan, RegularPlanAcceptRequest, RegularPlanOption } from '@/lib/types';

/** The day's train on a regular journey in "remind me" mode (regular
 * journeys design §6.6): the train we picked for the day, "Your usual
 * train: 08:12 Woking to London Waterloo", with one "Track this train",
 * and the other trains under it. When the usual train doesn't run that
 * day, the card says so and offers the closest. Tracking one replaces the
 * journey's legs with it (`POST /Journeys/{id}/regular-plan/accept`). */
export function RegularPlanCard({
  journeyId,
  serviceDate,
  plan,
}: {
  journeyId: number;
  /** The journey's date (`YYYY-MM-DD`). */
  serviceDate: string;
  plan: RegularPlan & { choice: RegularPlanOption };
}) {
  const router = useRouter();
  const headingId = useId();
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const needsLoginState = useNeedsLogin();
  const choice = summarisePlanOption(plan.choice);
  const usualRuns = plan.reason !== 'best';
  const others = plan.alternatives.map(summarisePlanOption);

  async function track(index: number) {
    if (plan.plannedAt === null) return;
    setBusy(index);
    setError(null);
    needsLoginState.reset();
    try {
      const body: RegularPlanAcceptRequest = { index, plannedAt: plan.plannedAt };
      const response = await fetch(`/api/Journeys/${journeyId}/regular-plan/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        if (response.status === 401) needsLoginState.markNeedsLogin();
        else setError(await failureFromResponse('track', 'this train', response));
        setBusy(null);
        return;
      }
      setBusy(null);
      router.refresh();
    } catch {
      setError(describeFailure('track', 'this train'));
      setBusy(null);
    }
  }

  return (
    <Card withBorder component="section" aria-labelledby={headingId}>
      <Stack gap="sm">
        <SectionTitle id={headingId}>
          {usualRuns ? 'Your usual train' : 'Closest train'}: {planOptionTitle(choice)}
        </SectionTitle>
        {!usualRuns && (
          <Text size="sm">Your usual train doesn&apos;t run {planDayPhrase(serviceDate)}. This is the closest.</Text>
        )}
        <Text size="sm" c="dimmed">
          {planOptionDetail(choice)}
        </Text>
        <Group>
          <Button onClick={() => void track(0)} loading={busy === 0} disabled={busy !== null && busy !== 0}>
            Track this train
          </Button>
        </Group>
        {needsLoginState.needsLogin && <LoginControl underline="always">Log in to track this train</LoginControl>}
        {error && <Alert color="red">{error}</Alert>}
        {others.length > 0 && (
          <Stack gap="xs">
            <Title order={3} size="sm">
              Other trains
            </Title>
            {others.map((other, offset) => (
              <PlanOptionRow
                key={`${other.departs}-${offset}`}
                summary={other}
                actionLabel="Track this train"
                busy={busy === offset + 1}
                disabled={busy !== null && busy !== offset + 1}
                onAction={() => void track(offset + 1)}
              />
            ))}
          </Stack>
        )}
      </Stack>
    </Card>
  );
}
