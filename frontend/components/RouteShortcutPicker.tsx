'use client';

import { useId } from 'react';
import { Button, Group, Stack, Text } from '@mantine/core';
import type { RouteShortcut, RouteShortcuts } from '@/lib/routeShortcuts';

/** "Start from a saved route" and "Recent routes" above a journey form's
 * stations: picking one fills From and To. Renders nothing when the
 * visitor has neither (logged out, or nothing saved or travelled yet). */
export function RouteShortcutPicker({
  shortcuts,
  onPick,
}: {
  shortcuts: RouteShortcuts;
  onPick: (originCrs: string, destinationCrs: string) => void;
}) {
  if (shortcuts.saved.length === 0 && shortcuts.recent.length === 0) return null;
  return (
    <Stack gap="xs">
      <ShortcutGroup label="Start from a saved route" routes={shortcuts.saved} onPick={onPick} />
      <ShortcutGroup label="Recent routes" routes={shortcuts.recent} onPick={onPick} />
    </Stack>
  );
}

function ShortcutGroup({
  label,
  routes,
  onPick,
}: {
  label: string;
  routes: RouteShortcut[];
  onPick: (originCrs: string, destinationCrs: string) => void;
}) {
  const labelId = useId();
  if (routes.length === 0) return null;
  return (
    <Stack gap={4}>
      <Text size="sm" fw={500} id={labelId}>
        {label}
      </Text>
      <Group gap="xs" role="group" aria-labelledby={labelId}>
        {routes.map((route) => (
          <Button
            key={route.key}
            variant="light"
            size="xs"
            type="button"
            onClick={() => onPick(route.originCrs, route.destinationCrs)}
          >
            {route.label}
          </Button>
        ))}
      </Group>
    </Stack>
  );
}
