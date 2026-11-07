import { Button, Group, Stack, Text } from '@mantine/core';
import { planOptionDetail, planOptionTitle, type PlanOptionSummary } from '@/lib/regularPlan';

/** One planned option as a row: "08:12 Woking to London Waterloo",
 * "Arrives 08:45, 1 change", and its action. Shared by a regular journey's
 * other trains (`RegularPlanCard`) and the trains "Track this journey
 * again" and "Move this journey" offer (`RepeatJourneyDialog`). The
 * button's name says which option it acts on. */
export function PlanOptionRow({
  summary,
  actionLabel,
  busy,
  disabled,
  onAction,
}: {
  summary: PlanOptionSummary;
  /** "Track this train", "Track this journey", "Move to these trains". */
  actionLabel: string;
  busy: boolean;
  disabled: boolean;
  onAction: () => void;
}) {
  const title = planOptionTitle(summary);
  return (
    <Group justify="space-between" wrap="wrap" gap="xs">
      <Stack gap={0}>
        <Text size="sm" fw={500}>
          {title}
        </Text>
        <Text size="sm" c="dimmed">
          {planOptionDetail(summary)}
        </Text>
      </Stack>
      <Button
        variant="light"
        size="xs"
        onClick={onAction}
        loading={busy}
        disabled={disabled}
        aria-label={`${actionLabel}, the ${title}`}
      >
        {actionLabel}
      </Button>
    </Group>
  );
}
