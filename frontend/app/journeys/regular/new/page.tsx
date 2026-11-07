import { Stack, Text, Title } from '@mantine/core';
import type { Metadata } from 'next';
import { DataCredits, TRAIN_CREDITS } from '@/components/DataCredits';
import { RegularJourneyForm } from '@/components/RegularJourneyForm';
import { TextLink } from '@/components/TextLink';
import { getSessionOrLoggedOut } from '@/lib/api';
import { REGULAR_JOURNEYS_HREF } from '@/lib/regularJourneys';

export const metadata: Metadata = { title: 'New regular journey', robots: { index: false } };

/** `/journeys/regular/new` (regular journeys design §4.4): a regular
 * journey from scratch, or from Plan a journey's "Make this a regular
 * journey" with its route and train filled in. Planning needs no account;
 * saving asks to log in. Every few weeks and chosen dates are offered
 * once the api has them on (`regularJourneyRecurrenceEnabled`). */
export default async function NewRegularJourneyPage() {
  const session = await getSessionOrLoggedOut();
  return (
    <Stack p="lg" gap="md" maw={720}>
      <TextLink href={REGULAR_JOURNEYS_HREF} underline="always">
        Back to regular journeys
      </TextLink>
      <Title order={1}>New regular journey</Title>
      <Text c="dimmed">A journey you make often. We add it to your journeys the evening before each day it runs.</Text>
      <RegularJourneyForm recurrenceEnabled={session.regularJourneyRecurrenceEnabled} />
      <DataCredits credits={TRAIN_CREDITS} />
    </Stack>
  );
}
