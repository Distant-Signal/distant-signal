import { Alert, Card, Group, Stack, Text } from '@mantine/core';
import { SectionTitle } from './SectionTitle';
import { TextLink } from './TextLink';
import {
  computeDelayRepayRollup,
  computePunctualitySummary,
  type DelayRepayRollup,
  type PunctualitySummary,
} from '@/lib/reliabilityDigest';
import { formatDate } from '@/lib/dateFormat';
import type { ReliabilityJourney, ReliabilityResponse } from '@/lib/types';

/** The retrospective summary card on `/journeys`, from
 * `GET /Journeys/reliability` (the page fetches it alongside the rest).
 * Punctuality is over the trains the caller actually took; Delay Repay is
 * once per finished journey, with no ticket needed. See
 * `lib/reliabilityDigest.ts` for what is counted. */
export function ReliabilityDigest({ reliability }: { reliability: ReliabilityResponse }) {
  const punctuality = computePunctualitySummary(reliability.trains);
  const rollup = computeDelayRepayRollup(reliability.journeys);

  return (
    <Card withBorder>
      <Stack gap="md">
        <SectionTitle>Your reliability</SectionTitle>
        <PunctualitySection summary={punctuality} />
        <DelayRepaySection rollup={rollup} />
      </Stack>
    </Card>
  );
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function PunctualitySection({ summary }: { summary: PunctualitySummary }) {
  // Gated on both counts: a caller whose only finished trains were all
  // cancelled still has a real fact to see (their cancellations), not the
  // "nothing yet" prose.
  if (summary.eligibleCount === 0 && summary.cancelledCount === 0) {
    return (
      <Text size="sm" c="dimmed">
        Save a journey and check back once its trains have run to see your punctuality here.
      </Text>
    );
  }

  const replaced =
    summary.replacedCount > 0
      ? ` That includes ${plural(summary.replacedCount, 'booked train', 'booked trains')} the railway replaced after a cancellation or a missed connection.`
      : '';

  if (summary.eligibleCount === 0) {
    return (
      <Text size="sm" c="dimmed">
        {plural(summary.cancelledCount, 'train you were booked on was', 'trains you were booked on were')} cancelled.
        {replaced} Punctuality appears once one of your trains runs.
      </Text>
    );
  }

  return (
    <Stack gap={4}>
      <Text>
        {summary.eligibleCount === 1 ? 'Of the 1 train' : `Of the last ${summary.eligibleCount} trains`} you took with a
        recorded arrival, {summary.onTimePct}% were on time
        {summary.avgDelayMinutes !== null && ` (average delay ${summary.avgDelayMinutes.toFixed(1)} minutes)`}.
        {summary.cancelledCount > 0 &&
          ` ${plural(summary.cancelledCount, 'train was', 'trains were')} cancelled and ${summary.cancelledCount === 1 ? "isn't" : "aren't"} counted in that figure.`}
        {replaced}
      </Text>
      {summary.worstTrains.length > 0 && (
        <Stack gap={2}>
          <Text size="sm" fw={500}>
            Your most delayed trains:
          </Text>
          {summary.worstTrains.map((train) => (
            <Group key={train.key} gap="xs">
              <TextLink href={`/journeys/${train.journeyId}`} underline="always" inline>
                {formatDate(train.serviceDate)}
              </TextLink>
              <Text size="sm" c="dimmed">
                {train.delayMinutes} minutes late
              </Text>
            </Group>
          ))}
        </Stack>
      )}
    </Stack>
  );
}

// Labels for every band `delay_repay_rules.rs` produces (DR15: 15, 30, 60
// and 120; DR30: 30, 60 and 120; Heathrow Express: 30 and 60). An unlisted
// key (a future band) falls back to the raw key, so a rules change never
// disappears silently.
const BAND_LABELS: Record<string, string> = {
  'DR15-15': '15 to 29 minutes late (25% of a single fare)',
  'DR15-30': '30 to 59 minutes late (50% of a single fare)',
  'DR15-60': '60 to 119 minutes late (100% of a single fare)',
  'DR15-120': '120 minutes or more late (100% of a single or return fare)',
  'DR30-30': '30 to 59 minutes late (50% of a single fare)',
  'DR30-60': '60 to 119 minutes late (100% of a single fare)',
  'DR30-120': '120 minutes or more late (100% of a single or return fare)',
  'HX-30': 'More than 30 minutes late (25% of the ticket)',
  'HX-60': 'More than 60 minutes late (50% of the ticket)',
};

// The api's `delay_repay_rules::ROUTE_DISCLAIMER`, up to its hedge clause:
// the same "not a guarantee of compensation and not proof you travelled"
// wording each journey's own estimate carries. Its tail ("...using the
// link above") is left out: this rollup has no claim link of its own.
const CARRIED_FORWARD_DISCLAIMER = 'A rough estimate, not a guarantee of compensation and not proof you travelled.';

function journeyLine(journey: ReliabilityJourney): string {
  if (journey.outcome === 'notReached') {
    return `didn't get you to ${journey.destinationName ?? journey.destinationCrs ?? 'your destination'}`;
  }
  const late = `${journey.delayMinutes ?? 0} minutes late`;
  return journey.againstBookedPlan ? `${late} against the train you booked` : late;
}

function DelayRepaySection({ rollup }: { rollup: DelayRepayRollup }) {
  if (rollup.finishedCount === 0) {
    return (
      <Text size="sm" c="dimmed">
        Once one of your journeys has finished, you&apos;ll see here whether it may have qualified for Delay Repay. No
        ticket needed.
      </Text>
    );
  }

  const bandEntries = Object.entries(rollup.bandCounts);

  return (
    <Stack gap={4} data-testid="delay-repay-rollup">
      <Alert color="grape" title="Possible Delay Repay across your journeys" variant="light">
        {rollup.finishedCount === 1
          ? 'Of your 1 finished journey, '
          : `Of your last ${rollup.finishedCount} finished journeys, `}
        {rollup.qualifyingCount} may have qualified for a partial or full refund under the operator&apos;s Delay Repay
        scheme.
      </Alert>
      {bandEntries.length > 0 && (
        <Stack gap={2}>
          {bandEntries.map(([key, count]) => (
            <Text key={key} size="sm">
              {plural(count, 'journey', 'journeys')}: {BAND_LABELS[key] ?? key}
            </Text>
          ))}
        </Stack>
      )}
      {rollup.qualifying.length > 0 && (
        <Stack gap={2}>
          {rollup.qualifying.map((journey) => (
            <Group key={journey.journeyId} gap="xs">
              <TextLink href={`/journeys/${journey.journeyId}`} underline="always" inline>
                {journey.customName ?? formatDate(journey.serviceDate)}
              </TextLink>
              <Text size="sm" c="dimmed">
                {journeyLine(journey)}
              </Text>
            </Group>
          ))}
        </Stack>
      )}
      {rollup.ticketTypeWouldHelp && (
        <Text size="sm">
          At 120 minutes or more a return pays more than a single. Add your ticket type on the journey to see which
          applies.
        </Text>
      )}
      <Text size="sm">{CARRIED_FORWARD_DISCLAIMER} Claim with the operator from each journey&apos;s page.</Text>
      <details>
        <summary>How this is calculated</summary>
        <Text size="sm" c="dimmed" mt="xs">
          This counts journeys, not money: we don&apos;t store ticket prices, so there is no refund total. Each journey
          is measured at its final station. If the railway changed your plan (a cancellation or a missed connection),
          it&apos;s measured against the arrival you booked. Distant Signal never claims on your behalf. Check
          eligibility with the operator.
        </Text>
      </details>
    </Stack>
  );
}
