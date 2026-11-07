import type { JourneyListItem, JourneyTemplateListItem } from './types';

/** A route to start from: two stations, and what to call it. */
export interface RouteShortcut {
  key: string;
  label: string;
  originCrs: string;
  destinationCrs: string;
}

/** How many of each kind are offered. */
export const MAX_ROUTE_SHORTCUTS = 5;

const CRS = /^[A-Z]{3}$/;

function crs(code: string | null | undefined): string | null {
  const upper = code?.trim().toUpperCase() ?? '';
  return CRS.test(upper) ? upper : null;
}

function routeName(
  origin: string,
  originName: string | null | undefined,
  destination: string,
  destinationName: string | null | undefined,
): string {
  return `${originName ?? origin} to ${destinationName ?? destination}`;
}

/** The caller's saved routes: regular journeys with no days chosen, in
 * the list's order (most recently used first), named by their own name
 * else "Woking to London Waterloo". */
export function savedRoutes(templates: readonly JourneyTemplateListItem[] | null): RouteShortcut[] {
  const routes: RouteShortcut[] = [];
  for (const template of templates ?? []) {
    if (template.daysOfWeek !== null) continue;
    const origin = crs(template.originCrs ?? template.firstOriginCrs);
    const destination = crs(template.destinationCrs ?? template.lastDestinationCrs);
    if (!origin || !destination || origin === destination) continue;
    const name = template.customName?.trim();
    routes.push({
      key: `saved-${template.id}`,
      label:
        name ||
        routeName(
          origin,
          template.originName ?? template.firstOriginName,
          destination,
          template.destinationName ?? template.lastDestinationName,
        ),
      originCrs: origin,
      destinationCrs: destination,
    });
    if (routes.length === MAX_ROUTE_SHORTCUTS) break;
  }
  return routes;
}

/** The caller's last few distinct routes, newest journey first, from
 * their own journeys' first and last stations. Irish trains are left out:
 * they aren't planned or tracked from these forms. */
export function recentRoutes(journeys: readonly JourneyListItem[] | null): RouteShortcut[] {
  const newest = [...(journeys ?? [])]
    .filter((journey) => journey.irishTrain === null && !journey.followedFrom && !journey.sharedVia)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const seen = new Set<string>();
  const routes: RouteShortcut[] = [];
  for (const journey of newest) {
    const origin = crs(journey.firstOriginCrs ?? journey.originCrs);
    const destination = crs(journey.lastDestinationCrs ?? journey.destinationCrs);
    if (!origin || !destination || origin === destination) continue;
    const key = `${origin}-${destination}`;
    if (seen.has(key)) continue;
    seen.add(key);
    routes.push({
      key: `recent-${key}`,
      label: routeName(
        origin,
        journey.firstOriginName ?? journey.originName,
        destination,
        journey.lastDestinationName ?? journey.destinationName,
      ),
      originCrs: origin,
      destinationCrs: destination,
    });
    if (routes.length === MAX_ROUTE_SHORTCUTS) break;
  }
  return routes;
}

/** A page's saved and recent routes (`loadRouteShortcuts`). */
export interface RouteShortcuts {
  saved: RouteShortcut[];
  recent: RouteShortcut[];
}

export const NO_ROUTE_SHORTCUTS: RouteShortcuts = { saved: [], recent: [] };
