import { Group, Text } from '@mantine/core';
import { StatusBadge } from './StatusBadge';
import { LastUpdated } from './LastUpdated';
import { PinToggle } from './PinToggle';
import { TextLink } from './TextLink';
import { formatOperatorSampleSummary } from '@/lib/operatorStats';
import { isGoodSeverity } from '@/lib/severity';
import type { OperatorSummary } from '@/lib/types';
import { StatusCard } from './StatusCard';

/** The "Worst of N lines · {name}" qualifier under the reason text: a rollup's
 * reason is one line's own text
 * presented as the whole operator's status, with nothing saying it's the
 * worst of several or which one -- ScotRail's card was the clearest case,
 * one Fife Circle closure standing in for the whole operator. Linking the
 * named line to its own (unclamped) status page also gives a reader stuck
 * behind the reason's `lineClamp={3}` ellipsis somewhere to read the rest,
 * the same "click-through is the read-more" property `LineStatusCard`
 * already has.
 *
 * Degrades gracefully when `worstLineId`/`worstLineName` are absent (an
 * older API payload, or -- per `lib/types.ts`'s own doc comment -- a
 * theoretically un-rolled-out backend): still states the scope ("Worst of 4
 * lines") without a name or a link, rather than rendering nothing. Says "N
 * lines, all running normally" instead of "Worst of N" when nothing is
 * actually wrong -- "worst of" reads
 * as an accusation when every line is Good Service. */
function RollupScopeLine({ operator }: { operator: OperatorSummary }) {
  const lineCount = operator.lineIds.length;
  if (lineCount === 0) return null;
  const linesWord = lineCount === 1 ? 'line' : 'lines';

  if (isGoodSeverity(operator.worstSeverity)) {
    return (
      <Text size="xs" c="dimmed">
        {lineCount} {linesWord}, all running normally
      </Text>
    );
  }

  return (
    <Text size="xs" c="dimmed">
      Worst of {lineCount} {linesWord}
      {operator.worstLineId && operator.worstLineName ? (
        <>
          {' · '}
          <TextLink href={`/lines/${operator.worstLineId}`} underline="always" inline size="xs">
            {operator.worstLineName}
          </TextLink>
        </>
      ) : null}
    </Text>
  );
}

/** Mirrors `LineStatusCard`'s shape (worst-status badge, reason, sample
 * summary, last-updated) -- deliberately NOT wrapped in a `Link` the way
 * `LineStatusCard` links to `/lines/{id}`: there is no
 * `/operators/[code]` detail page for a WHOLE-CARD click to go to. Used by both `/operators`' list page and the
 * homepage's "Your Operators" section -- the same reuse `LineStatusCard`
 * already gets across the homepage's "Your Lines" section, the one other
 * place a status card like this renders.
 *
 * The footer DOES carry an explicit "History" link to
 * `/operators/{code}/history`: nothing else in the app links to that route,
 * and its own back-link says "Back to operators". An explicit action row rather
 * than a card-wide link suits a card which does not navigate as a whole.
 *
 * `aria-label` names the operator, not just "History": `/operators`
 * renders one of these per operator, and a screen-reader user listing
 * links must not hear "History" nine times over. */
export function OperatorStatusCard({
  operator,
  pinned,
  needsAccountHint = false,
  showPin = true,
  dedupedLineId,
}: {
  operator: OperatorSummary;
  pinned: boolean;
  needsAccountHint?: boolean;
  /** Whether the pin star renders at all. Defaults to `true` -- every
   * existing call site (the `/operators` list, and the homepage's own
   * "Your Operators" section) keeps pinning available, since it is the
   * only way to pin/unpin an operator at all. `LineStatusCard` (the homepage's
   * "Your Lines" card) has no pin control of its own, so parity is restored by
   * letting THIS card go without one, not by adding pinning to the other. */
  showPin?: boolean;
  /** When set and equal to `operator.worstLineId`, the line actually
   * driving this rollup is already shown elsewhere on the same page (e.g.
   * the homepage's "Your Lines" section, a few hundred pixels above "Your
   * Operators") -- collapses the repeated reason text into a short
   * cross-reference instead of printing the same disruption a second time.
   * Left `undefined` (the default) everywhere else, since
   * `/operators`' own list page has no earlier section to be a duplicate
   * of. */
  dedupedLineId?: string | undefined;
}) {
  const reasonAlreadyShownAbove = dedupedLineId !== undefined && dedupedLineId === operator.worstLineId;

  const showCrossReference = reasonAlreadyShownAbove && Boolean(operator.worstLineName);

  return (
    <StatusCard
      title={operator.name}
      badge={<StatusBadge severity={operator.worstSeverity} />}
      reason={
        showCrossReference ? (
          <>
            See{' '}
            <TextLink href={`/lines/${operator.worstLineId}`} underline="always" inline size="sm">
              {operator.worstLineName}
            </TextLink>{' '}
            above.
          </>
        ) : (
          operator.reason || 'No current disruption reported.'
        )
      }
      footer={
        <>
          <Group gap="md" wrap="nowrap" miw={0}>
            {operator.computedAt ? (
              <LastUpdated timestamp={operator.computedAt} />
            ) : (
              <Text size="xs" c="dimmed">
                &nbsp;
              </Text>
            )}
            <TextLink
              href={`/operators/${encodeURIComponent(operator.code)}/history`}
              size="sm"
              ariaLabel={`History for ${operator.name}`}
            >
              History
            </TextLink>
          </Group>
          {showPin && (
            <PinToggle
              kind="operator"
              id={operator.code}
              name={operator.name}
              initiallyPinned={pinned}
              needsAccountHint={needsAccountHint}
            />
          )}
        </>
      }
    >
      {!showCrossReference && <RollupScopeLine operator={operator} />}
      <Text size="xs" c="dimmed">
        {formatOperatorSampleSummary(operator)}
      </Text>
    </StatusCard>
  );
}
