import { Group, Stack, Text } from '@mantine/core';
import { ButtonLink } from './ButtonLink';
import { PLAN_JOURNEY_HREF } from '@/lib/navLinks';
import type { RouteShortcut } from '@/lib/routeShortcuts';

/** Plan a journey from a saved route, its stations filled in. */
export function savedRouteHref(route: RouteShortcut): string {
  const params = new URLSearchParams({ origin: route.originCrs, destination: route.destinationCrs });
  return `${PLAN_JOURNEY_HREF}?${params.toString()}`;
}

/** "Start from a saved route" on the Journeys page: each saved route (a
 * regular journey with no days) opens Plan a journey with its stations.
 * Renders nothing without one. */
export function SavedRouteLinks({ routes }: { routes: RouteShortcut[] }) {
  if (routes.length === 0) return null;
  return (
    <Stack gap={4}>
      <Text size="sm" fw={500}>
        Start from a saved route
      </Text>
      <Group gap="xs">
        {routes.map((route) => (
          <ButtonLink key={route.key} href={savedRouteHref(route)} variant="light" size="xs">
            {route.label}
          </ButtonLink>
        ))}
      </Group>
    </Stack>
  );
}
