import { Stack, Text } from '@mantine/core';
import { DelayRepayEstimate } from './DelayRepayEstimate';
import { isTimetableOnly } from '@/lib/serviceMode';
import type { LegDelayRepay as LegDelayRepayFields } from '@/lib/types';

/** The one line beside "Delay Repay" while the details are closed. */
export function legDelayRepaySummary(delayRepay: LegDelayRepayFields): string {
  if (isTimetableOnly(delayRepay)) return "Buses and ferries aren't measured";
  if (delayRepay.outcome === 'notReached') {
    return `Didn't reach ${delayRepay.measuredAtName ?? delayRepay.measuredAtCrs ?? 'your destination'}`;
  }
  const { estimate, delayMinutes } = delayRepay;
  if (estimate?.borderline) return 'Borderline, could go either way';
  if (estimate) {
    return `${estimate.provisional ? 'May qualify, provisional' : 'May qualify'} (${estimate.scheme}, ${estimate.bandMinutes}+ minutes)`;
  }
  if (delayMinutes === null) return 'No delay recorded yet';
  if (delayMinutes <= 0) return delayRepay.provisional ? 'On time so far' : 'On time';
  return `${delayMinutes} minutes late${delayRepay.provisional ? ' so far' : ''}`;
}

/** A tracked GB train leg's Delay Repay estimate, for its owner, with no
 * ticket needed (`delayRepay` on `GET /Journeys/{id}`). Closed to its one
 * summary line unless the leg may qualify. Without a ticket type the
 * 120-minute band reads both ways (`DelayRepayEstimate`); the line below
 * says what would settle it. */
export function LegDelayRepay({ delayRepay }: { delayRepay: LegDelayRepayFields }) {
  const mayQualify = delayRepay.estimate !== null || delayRepay.outcome === 'notReached';
  const ticketWouldHelp = !delayRepay.ticketKnown && (delayRepay.estimate?.bandMinutes ?? 0) >= 120;
  return (
    <details open={mayQualify || undefined}>
      <summary>
        <Text span size="sm" fw={600}>
          Delay Repay
        </Text>{' '}
        <Text span size="sm" c="dimmed">
          {legDelayRepaySummary(delayRepay)}
        </Text>
      </summary>
      <Stack gap={4} mt="xs">
        <DelayRepayEstimate response={delayRepay} />
        {ticketWouldHelp && (
          <Text size="sm">Add your ticket type below to see whether a single or a return applies.</Text>
        )}
      </Stack>
    </details>
  );
}
