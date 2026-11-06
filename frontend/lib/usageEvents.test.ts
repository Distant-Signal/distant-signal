import { describe, expect, it } from 'vitest';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { USAGE_EVENTS } from './api-types';
import {
  API_ERROR_STATUSES,
  apiErrorStatusFor,
  DISPLAY_MODES,
  EMPTY_STATE_KINDS,
  EVENT_NAMES,
  FEATURE_STEPS,
  FEATURES,
  isDigest,
  ROUTE_TEMPLATES,
  routeTemplateFor,
} from './usageEvents';

/** Every `page.tsx` under `app/` as a route template (`(home)` adds no
 * segment). */
function pageTemplates(dir: string, prefix: string, out: Set<string>) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (prefix === '' && entry.name === 'api') continue;
      const next = entry.name.startsWith('(') ? prefix : `${prefix}/${entry.name}`;
      pageTemplates(join(dir, entry.name), next, out);
    } else if (entry.name === 'page.tsx') {
      out.add(prefix === '' ? '/' : prefix);
    }
  }
}

describe('ROUTE_TEMPLATES', () => {
  it("lists exactly the app's pages, plus /offline and /_not-found", () => {
    const pages = new Set<string>(['/offline', '/_not-found']);
    pageTemplates('app', '', pages);
    expect([...ROUTE_TEMPLATES].sort()).toEqual([...pages].sort());
  });
});

/** The api's allowlist, `USAGE_EVENTS` in the generated `lib/api-types.ts`
 * (crates/api/src/usage_events.rs): the api drops any event, route or
 * value it does not list, so this copy must name exactly the same ones.
 * Order does not matter. */
describe("the api's allowlist", () => {
  const sorted = (values: readonly string[]) => [...values].sort();
  it.each([
    ['ROUTE_TEMPLATES', ROUTE_TEMPLATES, USAGE_EVENTS.routeTemplates],
    ['EVENT_NAMES', EVENT_NAMES, USAGE_EVENTS.events],
    ['FEATURES', FEATURES, USAGE_EVENTS.features],
    ['EMPTY_STATE_KINDS', EMPTY_STATE_KINDS, USAGE_EVENTS.emptyStateKinds],
    ['API_ERROR_STATUSES', API_ERROR_STATUSES, USAGE_EVENTS.apiErrorStatuses],
    ['DISPLAY_MODES', DISPLAY_MODES, USAGE_EVENTS.displayModes],
  ])('%s names what the api accepts', (_, ours, api) => {
    expect(sorted(ours)).toEqual(sorted(api));
  });

  it('FEATURE_STEPS gives each feature the steps the api accepts', () => {
    const steps = (table: Readonly<Record<string, readonly string[]>>) =>
      Object.fromEntries(Object.entries(table).map(([feature, list]) => [feature, sorted(list)]));
    expect(steps(FEATURE_STEPS)).toEqual(steps(USAGE_EVENTS.featureSteps));
  });
});

describe('routeTemplateFor', () => {
  it.each([
    ['/', '/'],
    ['/lines', '/lines'],
    ['/lines/northern', '/lines/[id]'],
    ['/lines/northern/', '/lines/[id]'],
    ['/lines/northern/history', '/lines/[id]/history'],
    ['/lines/new', '/lines/new'],
    ['/trains', '/trains'],
    ['/trains?station=RDG&board=arrivals', '/trains'],
    ['/journeys/42', '/journeys/[id]'],
    ['/journeys/regular', '/journeys/regular'],
    ['/journeys/regular/new', '/journeys/regular/new'],
    ['/journeys/regular/7', '/journeys/regular/[id]'],
    ['/journeys/shared/abc', '/journeys/shared/[token]'],
    ['/train/by-id/12', '/train/by-id/[trackingId]'],
    ['/train/C12345/2026-10-30', '/train/[uid]/[date]'],
    ['/groups/join/tok', '/groups/join/[token]'],
    ['/groups/new', '/groups/new'],
    ['/stations/KGX?tab=arrivals', '/stations/[crs]'],
    ['/transit/metrolink/lines/blue/timetable', '/transit/[network]/lines/[line]/timetable'],
    ['/no/such/page', '/_not-found'],
    ['/offline', '/_not-found'],
  ])('%s is %s', (pathname, template) => {
    expect(routeTemplateFor(pathname)).toBe(template);
  });

  it('never returns the pathname itself for a real id', () => {
    expect(ROUTE_TEMPLATES).toContain(routeTemplateFor('/stations/KGX'));
    expect(routeTemplateFor('/stations/KGX')).not.toContain('KGX');
  });
});

describe('apiErrorStatusFor', () => {
  it('classes a status', () => {
    expect(apiErrorStatusFor(undefined)).toBe('network');
    expect(apiErrorStatusFor(404)).toBe('4xx');
    expect(apiErrorStatusFor(503)).toBe('5xx');
    expect(apiErrorStatusFor(200)).toBeNull();
    expect(apiErrorStatusFor(0)).toBeNull();
  });
});

describe('isDigest', () => {
  it('accepts a Next digest and nothing like a message', () => {
    expect(isDigest('2914387@E1')).toBe(true);
    expect(isDigest('TypeError: x is null')).toBe(false);
    expect(isDigest('')).toBe(false);
    expect(isDigest('1'.repeat(65))).toBe(false);
  });
});
