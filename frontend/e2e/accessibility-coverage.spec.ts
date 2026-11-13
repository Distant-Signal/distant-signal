import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import {
  ALLOWED_UNSCANNED,
  LEGAL_ROUTES,
  LOGGED_IN_ROUTES,
  PUBLIC_ROUTES,
  SCANNED_BY_DEDICATED_TESTS,
} from './a11yRoutes';

// The route-coverage guard for accessibility.spec.ts: every `page.tsx` under
// app/ must be reached by one of that spec's axe scans (the route lists in
// ./a11yRoutes.ts) or sit in ALLOWED_UNSCANNED with a reason, so a new page
// can't ship without an accessibility scan. It reads the file system only
// and needs no browser or stack.

const APP_DIR = path.join(__dirname, '..', 'app');

function pageFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return pageFiles(full);
    return entry === 'page.tsx' ? [full] : [];
  });
}

/** `app/(home)/page.tsx` -> `/`; `app/lines/[id]/page.tsx` -> `/lines/[id]`. */
function routeOf(file: string): string {
  const segments = path
    .relative(APP_DIR, path.dirname(file))
    .split(path.sep)
    .filter((segment) => segment !== '' && !/^\(.*\)$/.test(segment));
  return '/' + segments.join('/');
}

/** Whether a concrete scanned path (query string ignored) is an instance of
 * a route pattern. */
function matches(route: string, scanned: string): boolean {
  const pathname = scanned.split('?')[0] ?? '';
  const pattern = route
    .split('/')
    .map((segment) => (/^\[.+\]$/.test(segment) ? '[^/]+' : segment.replace(/[.*+?^${}()|\\]/g, '\\$&')))
    .join('/');
  return new RegExp(`^${pattern}$`).test(pathname);
}

const routes = pageFiles(APP_DIR).map(routeOf).sort();
const scannedPaths = [...PUBLIC_ROUTES, ...LEGAL_ROUTES, ...LOGGED_IN_ROUTES].map(([, scanned]) => scanned);

test('the guard finds the app routes', () => {
  expect(routes.length).toBeGreaterThan(40);
  expect(routes).toContain('/');
});

test('every page is scanned by accessibility.spec.ts or allow-listed with a reason', () => {
  const unscanned = routes.filter(
    (route) =>
      !scannedPaths.some((scanned) => matches(route, scanned)) &&
      !SCANNED_BY_DEDICATED_TESTS.includes(route) &&
      !(route in ALLOWED_UNSCANNED),
  );
  expect(
    unscanned,
    `These pages have no axe scan. Add a route to e2e/a11yRoutes.ts (and its fixture to e2e/fixtures/seed.sql if it needs one), or list it in ALLOWED_UNSCANNED with the reason:\n${unscanned.join('\n')}`,
  ).toEqual([]);
});

test('the allow-lists name only pages that exist, and say why', () => {
  for (const route of [...SCANNED_BY_DEDICATED_TESTS, ...Object.keys(ALLOWED_UNSCANNED)]) {
    expect(routes, `${route} is not a page under app/ any more: remove it from e2e/a11yRoutes.ts`).toContain(route);
  }
  for (const [route, reason] of Object.entries(ALLOWED_UNSCANNED)) {
    expect(reason.trim().length, `${route} needs a reason in ALLOWED_UNSCANNED`).toBeGreaterThan(20);
    expect(
      scannedPaths.some((scanned) => matches(route, scanned)),
      `${route} is scanned now: remove it from ALLOWED_UNSCANNED`,
    ).toBe(false);
  }
});
