import { Group, Text } from '@mantine/core';
import { SkipNextButton } from './SkipNextButton';
import { TextLink } from './TextLink';
import { regularJourneyHref } from '@/lib/regularJourneys';

/** On a journey made from a regular journey (its page and the home
 * page's cards, regular journeys design §4.4): a dimmed "Regular journey"
 * linking to it, and "Skip" while the journey hasn't started. Skipping
 * deletes the journey, so `afterSkipHref` says where to go then. */
export function RegularJourneyLine({
  templateId,
  date,
  canSkip,
  afterSkipHref,
}: {
  templateId: number;
  /** The journey's date (`YYYY-MM-DD`), the one "Skip" skips. */
  date: string;
  canSkip: boolean;
  afterSkipHref?: string | undefined;
}) {
  return (
    <Group gap="xs" wrap="wrap">
      <Text size="sm" c="dimmed" className="ds-regular-journey-link">
        <TextLink href={regularJourneyHref(templateId)} tone="inherit" underline="always" inline size="sm">
          Regular journey
        </TextLink>
      </Text>
      {canSkip && <SkipNextButton templateId={templateId} date={date} label="Skip" afterSkipHref={afterSkipHref} />}
    </Group>
  );
}
