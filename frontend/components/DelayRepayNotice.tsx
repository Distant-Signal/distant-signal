import { Alert, Text } from '@mantine/core';

/** The one notice at the top of the Journeys page's Past list when any
 * recent journey may qualify for Delay Repay; each such row carries a
 * "May qualify for Delay Repay" badge. A static note, not an alert. */
export function DelayRepayNotice({ count }: { count: number }) {
  if (count === 0) return null;
  const title =
    count === 1
      ? '1 recent journey may qualify for Delay Repay'
      : `${count} recent journeys may qualify for Delay Repay`;
  return (
    <Alert color="grape" variant="light" role="note" title={title} data-testid="delay-repay-notice">
      <Text size="sm">
        Open {count === 1 ? 'it' : 'each one'} to see the estimate and the operator&apos;s claim page. It&apos;s a rough
        estimate: your ticket and the operator decide, and Distant Signal never claims for you.
      </Text>
    </Alert>
  );
}
