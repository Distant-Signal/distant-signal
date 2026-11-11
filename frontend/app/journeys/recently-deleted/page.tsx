import { Alert, Stack, Text, Title } from '@mantine/core';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LoginControl } from '@/components/LoginControl';
import { RecentlyDeletedJourneys } from '@/components/RecentlyDeletedJourneys';
import { TextLink } from '@/components/TextLink';
import { getRecentlyDeletedJourneys, getSessionOrLoggedOut } from '@/lib/api';
import { describeFailure } from '@/lib/failure';
import { pageMetadata } from '@/lib/pageMetadata';
import type { RecentlyDeletedData } from '@/lib/types';

// Session-dependent: never prerender (see app/page.tsx's own comment).
export const revalidate = 0;

export const metadata: Metadata = {
  ...pageMetadata('Recently deleted', 'Journeys you deleted in the last few days, to save again or delete for good.'),
  robots: { index: false },
};

/** `/journeys/recently-deleted`: the visitor's deleted journeys still kept
 * (ds-api's `routes::recently_deleted`), reached from the Journeys page.
 * Not found while the api has the feature off (`recentlyDeletedEnabled` in
 * the session read), so nothing about it shows until it is on. */
export default async function RecentlyDeletedPage() {
  const session = await getSessionOrLoggedOut();
  if (!session.authenticated) {
    return (
      <Stack p="lg" gap="md" maw={640}>
        <Title order={1}>Recently deleted</Title>
        <Text>Log in to see the journeys you deleted recently.</Text>
        <LoginControl variant="button" title="Log in (needs a Distant Signal account)">
          Log in
        </LoginControl>
      </Stack>
    );
  }
  if (!session.recentlyDeletedEnabled) notFound();

  let data: RecentlyDeletedData | null = null;
  let failed = false;
  try {
    data = await getRecentlyDeletedJourneys();
  } catch {
    failed = true;
  }
  if (!failed && data === null) notFound();

  return (
    <Stack p="lg" gap="lg" maw={640}>
      <Title order={1}>Recently deleted</Title>
      {data ? (
        <RecentlyDeletedJourneys data={data} now={new Date().toISOString()} />
      ) : (
        <Alert
          color="red"
          variant="light"
          role="alert"
          title={describeFailure('load', 'your recently deleted journeys')}
        />
      )}
      <Text size="sm">
        <TextLink href="/journeys">Back to journeys</TextLink>
      </Text>
    </Stack>
  );
}
