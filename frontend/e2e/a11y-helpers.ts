import { expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Shared by the a11y-*.spec.ts files, which re-run accessibility.spec.ts's
// idea in other environments (a phone, Firefox, a 320px-wide viewport,
// reduced motion, forced colours). accessibility.spec.ts stays the full route
// and sub-state sweep; these cover the main routes only, so the list below is
// deliberately short and is not meant to track every route in app/.

export const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];

export const REAL_LINE_ID = process.env.E2E_REAL_LINE_ID ?? 'gwr-main-line';
export const REAL_STATION_CRS = process.env.E2E_REAL_STATION_CRS ?? 'PAD';
export const REAL_INCIDENT_ID = process.env.E2E_REAL_INCIDENT_ID ?? 'E879EB6C791C470AB6C2A7458AE68C3B';
export const SESSION_COOKIE = process.env.E2E_SESSION_COOKIE;

/** Core anonymous routes: the main pages and their common variants. */
export const CORE_ROUTES: [name: string, path: string][] = [
  ['/', '/'],
  ['/lines', '/lines'],
  ['a line', `/lines/${REAL_LINE_ID}`],
  ['a line history', `/lines/${REAL_LINE_ID}/history`],
  ['a line timetable', `/lines/${REAL_LINE_ID}/timetable`],
  ['/stations', '/stations'],
  ['a station', `/stations/${REAL_STATION_CRS}`],
  ['an incident', `/incidents/${REAL_INCIDENT_ID}`],
  ['/incidents', '/incidents'],
  ['/trains', '/trains'],
  ['/track', '/track'],
  ['/plan', '/plan'],
  ['/plan (train form)', '/plan?mode=known'],
  ['/journeys (login prompt)', '/journeys'],
  ['/transit/metrolink', '/transit/metrolink'],
  ['/island-of-ireland', '/island-of-ireland'],
  ['/attribution', '/attribution'],
  ['/developers', '/developers'],
  ['a 404', '/this-route-does-not-exist'],
];

/** Core routes whose logged-in DOM differs from the anonymous one. */
export const CORE_LOGGED_IN_ROUTES: [name: string, path: string][] = [
  ['/', '/'],
  ['/lines', '/lines'],
  ['a station', `/stations/${REAL_STATION_CRS}`],
  ['/plan', '/plan'],
  ['/journeys', '/journeys'],
  ['/groups', '/groups'],
  ['/account/notifications', '/account/notifications'],
];

/** The routes the Firefox run covers. */
export const MAIN_ROUTES: [name: string, path: string][] = [
  ['/', '/'],
  ['/lines', '/lines'],
  ['a line', `/lines/${REAL_LINE_ID}`],
  ['/stations', '/stations'],
  ['/plan', '/plan'],
];

/** The session cookie as a storage state; see accessibility.spec.ts's
 * `sessionState` for why it is not `Secure` over http. */
export function sessionState(value: string) {
  const base = new URL(process.env.E2E_BASE_URL ?? 'http://localhost:3000');
  return {
    cookies: [
      {
        name: 'distant_signal_session',
        value,
        domain: base.hostname,
        path: '/',
        expires: -1,
        httpOnly: true,
        secure: base.protocol === 'https:',
        sameSite: 'Lax' as const,
      },
    ],
    origins: [],
  };
}

export async function gotoOk(page: Page, path: string) {
  const response = await page.goto(path);
  // Next's error shell is itself accessible, so a 500 would pass axe.
  // The deliberate 404 routes are fine.
  expect(response?.status() ?? 0, `${path} returned a server error`).toBeLessThan(500);
  // Next streams a route's loading skeleton (no h1) before its content, and
  // `goto` can resolve first: audit the real page, not the placeholder.
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeAttached();
}

export async function expectNoViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  expect(
    results.violations,
    JSON.stringify(
      results.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        help: v.help,
        nodes: v.nodes.map((n) => ({ target: n.target, html: n.html, why: n.failureSummary })),
      })),
      null,
      2,
    ),
  ).toEqual([]);
}
