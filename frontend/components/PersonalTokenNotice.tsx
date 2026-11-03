'use client';

import { useEffect, useState } from 'react';
import { Alert, Text } from '@mantine/core';
import { TextLink } from './TextLink';
import { formatDateTime } from '@/lib/dateFormat';
import type { PersonalTokenRow } from '@/lib/api-types';

const STORAGE_PREFIX = 'personal-token-notice-dismissed:';

function storageKey(notice: PersonalTokenRow): string {
  return `${STORAGE_PREFIX}${notice.id}`;
}

/** The banner every page shows for 7 days after a personal API token is
 * created (docs/specs/personal-api-tokens.md §15 decision 3, the same
 * compensating control as `ConnectedAppNotice`): which token, when, and
 * where to revoke it if it wasn't the visitor. Dismissing it hides it in
 * this browser for that token; a new token shows it again. The api only
 * returns a notice for an unrevoked token made in the last 7 days. */
export function PersonalTokenNotice({ notice }: { notice: PersonalTokenRow }) {
  // Hidden until mounted, so a dismissed notice never flashes in.
  const [dismissed, setDismissed] = useState(true);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reads localStorage only after mount, so the server and first client render agree
      setDismissed(window.localStorage.getItem(storageKey(notice)) === '1');
    } catch {
      setDismissed(false);
    }
  }, [notice]);

  if (dismissed) return null;
  return (
    <Alert
      color="blue"
      title={`An API token called "${notice.name}" was created`}
      withCloseButton
      closeButtonLabel="Dismiss"
      onClose={() => {
        try {
          window.localStorage.setItem(storageKey(notice), '1');
        } catch {
          // Private mode: hidden for this page only.
        }
        setDismissed(true);
      }}
      mb="md"
    >
      <Text size="sm">
        Created {formatDateTime(notice.createdAt)}. It can read your Distant Signal data. Not you?{' '}
        <TextLink href="/account/connected-apps" inline underline="always">
          Revoke it in Connected apps
        </TextLink>
        .
      </Text>
    </Alert>
  );
}
