import { Group, Stack, Text, Title } from '@mantine/core';
import { notFound } from 'next/navigation';
import { getJourneyTemplate, getSessionOrLoggedOut, ApiNotFoundError, ApiUnauthorizedError } from '@/lib/api';
import { DeleteJourneyTemplateButton } from '@/components/DeleteJourneyTemplateButton';
import { EditJourneyTemplateForm } from '@/components/EditJourneyTemplateForm';
import { LoginControl } from '@/components/LoginControl';
import { PauseRegularJourneyButton } from '@/components/PauseRegularJourneyButton';
import { PauseUntilButton } from '@/components/PauseUntilButton';
import { RunTemplateNowButton } from '@/components/RunTemplateNowButton';
import { SkipNextButton } from '@/components/SkipNextButton';
import { TextLink } from '@/components/TextLink';
import { UpcomingDatesStrip } from '@/components/UpcomingDatesStrip';
import { formatDate } from '@/lib/dateFormat';
import { journeyDisplayName, journeyNameInputFromLegs } from '@/lib/journeyName';
import { REGULAR_JOURNEYS_HREF, regularJourneyHref, targetLabel, usualTrainSummary } from '@/lib/regularJourneys';
import { runsByItself } from '@/lib/templateRecurrence';
import type { JourneyTemplateDetail } from '@/lib/types';
import { dueDates } from '@/lib/upcomingDates';
import type { Metadata } from 'next';

export const revalidate = 0;

export const metadata: Metadata = { title: 'Regular journey', robots: { index: false } };

/** A regular journey's name: its own, else "Woking to London Waterloo,
 * leave after 07:45" for one with a target, else its legs' route. */
function title(template: JourneyTemplateDetail): string {
  if (template.customName?.trim()) return template.customName.trim();
  if (template.target && template.originCrs && template.destinationCrs) {
    return `${template.originName ?? template.originCrs} to ${template.destinationName ?? template.destinationCrs}, ${targetLabel(template.target)}`;
  }
  return journeyDisplayName(journeyNameInputFromLegs(null, template.legs));
}

/** `/journeys/regular/[id]` (`/journeys/templates/[id]` redirects here):
 * a regular journey's page, for its owner only (`GET /JourneyTemplates/{id}`
 * 404s for anyone else). Its next date, the usual train and the return
 * journey, then "Skip next", "Pause", "Add a date", "Delete regular
 * journey" and the editor. */
export default async function RegularJourneyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) {
    notFound();
  }

  let template;
  try {
    template = await getJourneyTemplate(Number(id));
  } catch (err) {
    if (err instanceof ApiNotFoundError) {
      notFound();
    }
    if (err instanceof ApiUnauthorizedError) {
      return (
        <Stack p="lg" gap="md">
          <Title order={1}>Log in to see this regular journey</Title>
          <LoginControl underline="always">Log in to view this regular journey</LoginControl>
        </Stack>
      );
    }
    throw err;
  }

  // Whether "Add a date" can keep a later date for the evening before
  // (R2's extra dates, `regularJourneyRecurrenceEnabled`).
  const session = await getSessionOrLoggedOut();
  const paired = template.pairedTemplateId !== null;
  const recurring = runsByItself(template);
  const names = new Map<string, string>();
  if (template.originCrs && template.originName) names.set(template.originCrs, template.originName);
  if (template.destinationCrs && template.destinationName) names.set(template.destinationCrs, template.destinationName);
  const usual = usualTrainSummary(template.usualItinerary, (code) => names.get(code));
  return (
    <Stack p="lg" gap="md">
      <TextLink href={REGULAR_JOURNEYS_HREF} underline="always">
        Back to regular journeys
      </TextLink>
      <Group justify="space-between" align="baseline">
        <Title order={1}>{title(template)}</Title>
        <Group gap="xs">
          <RunTemplateNowButton templateId={template.id} keepLaterDates={session.regularJourneyRecurrenceEnabled} />
          <DeleteJourneyTemplateButton templateId={template.id} />
        </Group>
      </Group>
      {(recurring || usual || paired) && (
        <Stack gap={4}>
          {recurring && (
            <Text size="sm">
              {!template.active
                ? 'Paused.'
                : template.nextDate
                  ? `Next: ${formatDate(`${template.nextDate}T12:00:00Z`)}`
                  : 'No more dates.'}
            </Text>
          )}
          {usual && <Text size="sm">Your usual train: {usual}</Text>}
          {template.pairedTemplateId !== null && (
            <TextLink href={regularJourneyHref(template.pairedTemplateId)}>The return journey</TextLink>
          )}
          {recurring && template.active && (
            <UpcomingDatesStrip
              templateId={template.id}
              pairedTemplateId={template.pairedTemplateId}
              upcoming={template.upcomingDates}
            />
          )}
          {recurring && (
            <Group gap="xs" mt={4}>
              {template.active && template.nextDate && (
                <SkipNextButton
                  templateId={template.id}
                  date={template.nextDate}
                  dates={dueDates(template.upcomingDates)}
                  paired={paired}
                />
              )}
              {template.active && (
                <PauseUntilButton templateId={template.id} pausedUntil={template.pausedUntil} paired={paired} />
              )}
              <PauseRegularJourneyButton templateId={template.id} active={template.active} paired={paired} />
            </Group>
          )}
        </Stack>
      )}
      <EditJourneyTemplateForm template={template} />
    </Stack>
  );
}
