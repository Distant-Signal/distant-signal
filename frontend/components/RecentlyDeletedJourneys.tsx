'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Card, Group, List, ListItem, Stack, Text } from '@mantine/core';
import { ConfirmActionButton } from './ConfirmActionButton';
import { LoginControl } from './LoginControl';
import { SectionTitle } from './SectionTitle';
import { TextLink } from './TextLink';
import { useNeedsLogin } from './useNeedsLogin';
import { deletionSummary } from '@/lib/connectedApps';
import { formatDate } from '@/lib/dateFormat';
import { describeFailure, failureFromResponse } from '@/lib/failure';
import { deletedLine, OWN_DELETE_CLIENT, restoreNotes } from '@/lib/recentlyDeleted';
import type { RecentlyDeletedData, RecentlyDeletedJourney, RestoreDeletedJourneyResponse } from '@/lib/types';

/** A journey saved again: the new journey, and what needs the visitor. */
interface Saved {
  title: string;
  journeyId: number;
  notes: string[];
}

/** The Recently deleted list (`/journeys/recently-deleted`, ds-api's
 * `routes::recently_deleted`): each deleted journey still kept, with "Save
 * again" and "Delete permanently", and "Empty now" for all of them.
 *
 * "Save again" makes a new journey with the old one's name and legs, its
 * trains tracked again where they still can be. Its history (changes,
 * tickets, share links, followers, groups) does not come back, which the
 * intro says. A leg that came back without its train, or not at all, is
 * named in the confirmation, with a link to the new journey to fix it.
 *
 * `now` is the server's render time, so "Deleted 2 days ago" is the same
 * on the server and after hydration. */
export function RecentlyDeletedJourneys({ data, now }: { data: RecentlyDeletedData; now: string }) {
  const router = useRouter();
  const [saved, setSaved] = useState<Saved | null>(null);
  const reference = new Date(now);
  const ownDays = data.retentionDays;
  const anyFromApps = data.items.some((item) => item.client !== OWN_DELETE_CLIENT);

  return (
    <Stack gap="lg">
      <Stack gap="xs">
        <Text>
          Journeys and tracked trains you deleted in the last {ownDays} days. Save one again to put it back in your
          journeys, with its name, legs and trains. Its history, tickets, share links, followers and groups do not come
          back.
        </Text>
        <Text size="sm" c="dimmed">
          After {ownDays} days they are deleted for good
          {anyFromApps ? `, and journeys a connected app deleted after ${data.connectedAppRetentionDays} days` : ''}.
        </Text>
      </Stack>

      {saved && (
        <Alert color="green" variant="light" role="status" title={`Saved ${saved.title} again.`}>
          <Stack gap="xs">
            {saved.notes.length > 0 && (
              <List spacing={4} size="sm">
                {saved.notes.map((note) => (
                  <ListItem key={note}>{note}</ListItem>
                ))}
              </List>
            )}
            <Text size="sm">
              <TextLink href={`/journeys/${saved.journeyId}`}>Open the journey</TextLink>
            </Text>
          </Stack>
        </Alert>
      )}

      {data.items.length === 0 ? (
        <Text c="dimmed">
          Nothing deleted in the last {ownDays} days. <TextLink href="/journeys">Back to journeys</TextLink>
        </Text>
      ) : (
        <Stack component="section" aria-labelledby="recently-deleted-list-heading" gap="sm">
          <Group justify="space-between" align="center" gap="sm">
            <SectionTitle id="recently-deleted-list-heading">
              {data.items.length === 1 ? '1 journey' : `${data.items.length} journeys`}
            </SectionTitle>
            <ConfirmActionButton
              label="Empty now"
              actionName="empty now"
              title="Delete these journeys for good?"
              request={() => fetch('/api/Journeys/recently-deleted', { method: 'DELETE' })}
              failure={['empty', 'your recently deleted journeys']}
              loginPrompt="Log in to empty your recently deleted journeys"
              onSuccess={(appRouter) => {
                setSaved(null);
                appRouter.refresh();
              }}
            >
              Every journey on this list is deleted now, and can&apos;t be saved again.
            </ConfirmActionButton>
          </Group>
          {data.items.map((item) => (
            <DeletedJourneyCard
              key={item.id}
              item={item}
              now={reference}
              onSaved={(next) => {
                setSaved(next);
                router.refresh();
              }}
            />
          ))}
        </Stack>
      )}
    </Stack>
  );
}

function DeletedJourneyCard({
  item,
  now,
  onSaved,
}: {
  item: RecentlyDeletedJourney;
  now: Date;
  onSaved: (saved: Saved) => void;
}) {
  const { title, legs } = deletionSummary(item);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const needsLoginState = useNeedsLogin();
  const headingId = `deleted-journey-${item.id}`;

  async function saveAgain() {
    setBusy(true);
    setError(null);
    needsLoginState.reset();
    try {
      const response = await fetch(`/api/Journeys/recently-deleted/${item.id}/restore`, { method: 'POST' });
      if (!response.ok) {
        if (response.status === 401) {
          needsLoginState.markNeedsLogin();
        } else {
          setError(await failureFromResponse('save', 'this journey again', response));
        }
        setBusy(false);
        return;
      }
      const body = (await response.json()) as RestoreDeletedJourneyResponse;
      setBusy(false);
      onSaved({ title, journeyId: body.journeyId, notes: restoreNotes(body.legs) });
    } catch {
      setError(describeFailure('save', 'this journey again'));
      setBusy(false);
    }
  }

  return (
    <Card withBorder component="article" aria-labelledby={headingId}>
      <Stack gap="xs">
        <SectionTitle order={3} id={headingId}>
          {title}
        </SectionTitle>
        {legs.map((leg) => (
          <Text size="sm" key={leg}>
            {leg}
          </Text>
        ))}
        <Text size="sm" c="dimmed">
          {deletedLine(item, now)} Kept until {formatDate(item.expiresAt)}.
        </Text>
        <Group gap="sm">
          {/* Named by its card (an `article` labelled with the journey's
              title), like the Delete permanently beside it. */}
          <Button size="xs" variant="light" onClick={saveAgain} loading={busy}>
            Save again
          </Button>
          <ConfirmActionButton
            label="Delete permanently"
            actionName={`delete permanently ${title}`}
            title="Delete this journey for good?"
            request={() => fetch(`/api/Journeys/recently-deleted/${item.id}`, { method: 'DELETE' })}
            failure={['delete', 'this journey']}
            loginPrompt="Log in to delete this journey"
          >
            {title} is deleted now, and can&apos;t be saved again.
          </ConfirmActionButton>
        </Group>
        {error && (
          <Alert color="red" variant="light" role="alert">
            {error}
          </Alert>
        )}
        {needsLoginState.needsLogin && (
          <LoginControl underline="always">Log in to save this journey again</LoginControl>
        )}
      </Stack>
    </Card>
  );
}
