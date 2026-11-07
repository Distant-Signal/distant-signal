import { Badge, Group, Stack, Text, Title } from '@mantine/core';
import { CardTitleLink, ClickableCard, StaticCard } from '@/components/ClickableCard';
import { ButtonLink } from '@/components/ButtonLink';
import { getMyJourneyTemplates } from '@/lib/api';
import { LoginControl } from '@/components/LoginControl';
import { PauseRegularJourneyButton } from '@/components/PauseRegularJourneyButton';
import { PauseUntilButton } from '@/components/PauseUntilButton';
import { SkipNextButton } from '@/components/SkipNextButton';
import { TextLink } from '@/components/TextLink';
import { bankHolidayNote } from '@/lib/bankHolidays';
import { UpcomingDatesStrip } from '@/components/UpcomingDatesStrip';
import { formatDate } from '@/lib/dateFormat';
import { journeyDisplayName, journeyRouteLabel, type JourneyNameInput } from '@/lib/journeyName';
import { NEW_REGULAR_JOURNEY_HREF, regularJourneyCards, regularJourneyHref, targetLabel } from '@/lib/regularJourneys';
import { patternSummary, runsByItself } from '@/lib/templateRecurrence';
import type { JourneyTemplateListItem } from '@/lib/types';
import { dueDates } from '@/lib/upcomingDates';
import type { Metadata } from 'next';

export const revalidate = 0;

export const metadata: Metadata = { title: 'Regular journeys', robots: { index: false } };

/** `/journeys/regular`, "Regular journeys" (regular journeys design §4.4;
 * `/journeys/templates` redirects here): a card per regular journey, a
 * pair (a journey and its return) as one card with two rows. Each shows
 * its days, its next date and whether it is paused, with "Skip next" and
 * "Pause" or "Resume". `getMyJourneyTemplates()` returns `null` on a 401:
 * a login prompt, not an empty list. */
export default async function RegularJourneysPage() {
  const templates = await getMyJourneyTemplates();

  if (templates === null) {
    return (
      <Stack p="lg" gap="md">
        <Title order={1}>Regular journeys</Title>
        <LoginControl underline="always">Log in to see your regular journeys</LoginControl>
      </Stack>
    );
  }

  return (
    <Stack p="lg" gap="md">
      <TextLink href="/journeys" underline="always">
        Back to journeys
      </TextLink>
      <Group justify="space-between" align="baseline" wrap="wrap">
        <Title order={1}>Regular journeys</Title>
        <ButtonLink href={NEW_REGULAR_JOURNEY_HREF} size="sm">
          New regular journey
        </ButtonLink>
      </Group>
      {templates.length === 0 && (
        <Text c="dimmed">
          No regular journeys yet. Make one here, or plan a route and choose &quot;Make this a regular journey&quot;.
        </Text>
      )}
      {regularJourneyCards(templates).map((card) =>
        card.length === 2 ? (
          <PairCard key={card[0].id} outbound={card[0]} back={card[1]} />
        ) : (
          <SingleCard key={card[0].id} template={card[0]} />
        ),
      )}
    </Stack>
  );
}

/** A regular journey's name: its own name, else "Woking to London
 * Waterloo, leave after 07:45" for one with a target, else the route of
 * its legs (`lib/journeyName.ts`, without a date). */
function regularJourneyTitle(template: JourneyTemplateListItem): string {
  if (template.customName?.trim()) return template.customName.trim();
  if (template.target && template.originCrs && template.destinationCrs) {
    const from = template.originName ?? template.originCrs;
    const to = template.destinationName ?? template.destinationCrs;
    return `${from} to ${to}, ${targetLabel(template.target)}`;
  }
  return journeyDisplayName(legsName(template));
}

function legsName(template: JourneyTemplateListItem): JourneyNameInput {
  return {
    customName: null,
    origin: { crs: template.firstOriginCrs, name: template.firstOriginName },
    destination: { crs: template.lastDestinationCrs, name: template.lastDestinationName },
    serviceDate: null,
    legCount: template.legCount,
  };
}

/** The lines under a regular journey's name: a custom name's route, its
 * days and next date, and the phase 0 nudge to add times. */
function TemplateFacts({ template }: { template: JourneyTemplateListItem }) {
  const recurring = runsByItself(template);
  const paused = recurring && !template.active;
  const next = recurring && !paused && template.nextDate ? formatDate(`${template.nextDate}T12:00:00Z`) : null;
  // "Next: 1 Jun 2027 (31 May 2027 is a bank holiday)" (§8.3).
  const holidays = next ? bankHolidayNote(template.nextSkips) : null;
  return (
    <>
      {template.customName?.trim() && (
        <Text size="sm" c="dimmed">
          {template.target && template.originCrs && template.destinationCrs
            ? `${template.originName ?? template.originCrs} to ${template.destinationName ?? template.destinationCrs}, ${targetLabel(template.target)}`
            : journeyRouteLabel(legsName(template))}
        </Text>
      )}
      <Text size="sm">
        {patternSummary(template)}
        {next && (
          <>
            {' · '}
            <span>
              Next: {next}
              {holidays && ` (${holidays})`}
            </span>
          </>
        )}
      </Text>
      {!template.target && (
        <Text size="xs" c="dimmed">
          {template.legCount} {template.legCount === 1 ? 'leg' : 'legs'} · saved {formatDate(template.createdAt)}
        </Text>
      )}
      {recurring && !paused && template.hasOpenLegs && (
        <Text size="sm" c="dimmed">
          {template.defaultMatchMode === 'auto'
            ? 'Add a departure time to each leg to let us pick your train.'
            : 'Add a departure time to each leg so we can remind you to pick a train.'}
        </Text>
      )}
    </>
  );
}

function PausedBadge() {
  return (
    <Badge color="gray" variant="light" tt="none">
      Paused
    </Badge>
  );
}

/** The next dates, each one on or off, then "Skip next" and "Pause" or
 * "Resume", for a recurring regular journey. On a pair they act for the
 * outbound and offer, or do, the return too. */
function TemplateActions({ template, paired }: { template: JourneyTemplateListItem; paired: boolean }) {
  if (!runsByItself(template)) return null;
  return (
    <Stack gap="xs">
      {template.active && (
        <UpcomingDatesStrip
          templateId={template.id}
          pairedTemplateId={paired ? template.pairedTemplateId : null}
          upcoming={template.upcomingDates}
        />
      )}
      <Group gap="xs" wrap="wrap">
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
    </Stack>
  );
}

function SingleCard({ template }: { template: JourneyTemplateListItem }) {
  const paused = runsByItself(template) && !template.active;
  return (
    <ClickableCard>
      <Stack gap="xs">
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <Stack gap={2} miw={0}>
            <Text fw={600}>
              <CardTitleLink href={regularJourneyHref(template.id)}>{regularJourneyTitle(template)}</CardTitleLink>
            </Text>
            <TemplateFacts template={template} />
          </Stack>
          {paused && <PausedBadge />}
        </Group>
        <TemplateActions template={template} paired={false} />
      </Stack>
    </ClickableCard>
  );
}

/** A journey and its return: two rows, each linking to its own page, so
 * a flat card (two targets, not one). The actions act for both. */
function PairCard({ outbound, back }: { outbound: JourneyTemplateListItem; back: JourneyTemplateListItem }) {
  const paused = runsByItself(outbound) && !outbound.active;
  return (
    <StaticCard data-regular-pair>
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <Stack gap="xs" miw={0}>
            {[outbound, back].map((template) => (
              <Stack key={template.id} gap={2}>
                <Text fw={600}>
                  {/* Inline: a paragraph can't hold the link's own paragraph,
                      and the browser's repair of one broke hydration. */}
                  <TextLink href={regularJourneyHref(template.id)} inline>
                    {regularJourneyTitle(template)}
                  </TextLink>
                </Text>
                <TemplateFacts template={template} />
              </Stack>
            ))}
          </Stack>
          {paused && <PausedBadge />}
        </Group>
        <TemplateActions template={outbound} paired />
      </Stack>
    </StaticCard>
  );
}
