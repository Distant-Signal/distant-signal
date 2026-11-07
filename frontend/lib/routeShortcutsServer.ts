import { getMyJourneys, getMyJourneyTemplates } from './api';
import { NO_ROUTE_SHORTCUTS, recentRoutes, savedRoutes, type RouteShortcuts } from './routeShortcuts';

/** The visitor's saved routes and recent routes, read on the server for
 * Track a train and Plan a journey. Logged out, or when a read fails,
 * there are none: they are a shortcut, never in the way. */
export async function loadRouteShortcuts(): Promise<RouteShortcuts> {
  const [templates, journeys] = await Promise.all([
    getMyJourneyTemplates().catch(() => null),
    getMyJourneys().catch(() => null),
  ]);
  if (templates === null && journeys === null) return NO_ROUTE_SHORTCUTS;
  return { saved: savedRoutes(templates), recent: recentRoutes(journeys) };
}
