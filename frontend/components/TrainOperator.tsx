import { Text } from '@mantine/core';
import { operatorNameAndCode } from '@/lib/displayLabels';

/** Who runs a train, with the operator's code beside its name: "Operated
 * by West Midlands Railway (WM)". The name wraps at any width, and the line
 * is plain text, so a screen reader reads it once, in order. Renders
 * nothing when the api sent neither a name nor a code, so there is never an
 * empty "Operated by". */
export function TrainOperator({
  name,
  code,
  size = 'sm',
}: {
  name?: string | null | undefined;
  code?: string | null | undefined;
  size?: 'xs' | 'sm';
}) {
  const operator = operatorNameAndCode(name, code);
  if (operator === null) return null;
  return (
    <Text size={size} c="dimmed" data-testid="train-operator">
      Operated by {operator}
    </Text>
  );
}
