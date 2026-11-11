'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { Affix, Button, CloseButton, Group, Paper, Stack, Text } from '@mantine/core';
import {
  dismissFailure,
  flushPendingDeletes,
  getPendingDeletes,
  pauseDeletes,
  resumeDeletes,
  subscribePendingDeletes,
  undoDelete,
} from '@/lib/pendingDeletes';

const EMPTY = getPendingDeletes();

/** The toasts for deletes that can still be undone (`lib/pendingDeletes.ts`),
 * and the listeners that send them when the page is hidden or closed.
 * Mounted once, in the root layout.
 *
 * The wrapper is a polite live region that is always in the page, so a new
 * "Journey deleted" is announced without taking focus. Hovering or focusing
 * it holds the timers, so Undo is never raced. A failed delete is a
 * `role="alert"` that stays until dismissed. No motion. */
export function PendingDeleteToasts() {
  const { pending, failures } = useSyncExternalStore(subscribePendingDeletes, getPendingDeletes, () => EMPTY);
  const router = useRouter();

  useEffect(() => {
    const flush = () => flushPendingDeletes();
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVisibility);
      // The host only unmounts with the whole app.
      flush();
    };
  }, []);

  return (
    <Affix position={{ bottom: 16, left: 16 }} zIndex={400} maw="calc(100vw - 32px)">
      <Stack
        gap="xs"
        role="status"
        aria-live="polite"
        aria-label="Notifications"
        onMouseEnter={pauseDeletes}
        onMouseLeave={resumeDeletes}
        onFocus={pauseDeletes}
        onBlur={resumeDeletes}
      >
        {pending.map((item) => (
          <Paper key={item.key} withBorder shadow="md" p="sm" radius="md" data-pending-delete={item.key}>
            <Group gap="md" wrap="nowrap" justify="space-between">
              <Text size="sm">{item.message}</Text>
              <Button
                size="xs"
                variant="light"
                aria-label={`Undo: ${item.message}`}
                onClick={() => {
                  undoDelete(item.key);
                  router.refresh();
                }}
              >
                Undo
              </Button>
            </Group>
          </Paper>
        ))}
        {failures.map((failure) => (
          <Paper key={failure.key} withBorder shadow="md" p="sm" radius="md" role="alert">
            <Group gap="md" wrap="nowrap" justify="space-between" align="flex-start">
              <Text size="sm" c="var(--ds-color-error-text)">
                {failure.message}
              </Text>
              <CloseButton aria-label="Dismiss" onClick={() => dismissFailure(failure.key)} />
            </Group>
          </Paper>
        ))}
      </Stack>
    </Affix>
  );
}
