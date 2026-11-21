import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { createMultiLegJourney, deleteJourney, logIn, SESSION_COOKIE } from './screenReaderFixtures';

// A screen reader user lists a page's buttons and links by name, so two
// controls with the same name are indistinguishable in that list: 245 stars
// all named "Pin" on /lines were the finding that started this (DS-534).
// This reads each page's accessibility tree and fails on any interactive
// control whose name is shared by another in `main`.
//
// To cover a page, add a row to SURFACES. A name that is meant to repeat
// goes in ALLOWED, with a reason. Two links with the same name and the same
// address are one destination and are fine.
//
// /journeys and a multi-leg journey page are signed in (the seed's owner);
// the journey is made through the api for the test (screenReaderFixtures.ts)
// and `mustInclude` proves the read saw the per-row and per-leg controls
// (a parse that finds none would pass).

interface Surface {
  name: string;
  /** Opens the page and returns what to run afterwards to clean up. */
  open: (page: Page, request: APIRequestContext) => Promise<() => Promise<void>>;
  signedIn?: boolean;
  /** A control, as `role "name"`, that must be on the page, so an empty read fails. */
  mustInclude?: RegExp;
}

const visit = (path: string) => async (page: Page) => {
  await page.goto(path);
  return async () => {};
};

const SURFACES: Surface[] = [
  { name: '/lines', open: visit('/lines') },
  { name: 'a Metrolink line', open: visit('/transit/metrolink/lines/blue') },
  {
    name: '/journeys',
    signedIn: true,
    open: visit('/journeys'),
    mustInclude: /^button "Follow this journey: /,
  },
  {
    name: 'a journey with several legs',
    signedIn: true,
    mustInclude: /^button "Remove leg 3: /,
    open: async (page, request) => {
      const id = await createMultiLegJourney(request, 'E2E unique names');
      await page.goto(`/journeys/${id}`);
      return () => deleteJourney(request, id);
    },
  },
];

/** Names that legitimately repeat in `main`, with why. */
const ALLOWED: Record<string, string> = {};

const INTERACTIVE = [
  'button',
  'link',
  'checkbox',
  'radio',
  'switch',
  'combobox',
  'textbox',
  'searchbox',
  'tab',
  'menuitem',
  'slider',
  'spinbutton',
];

interface Control {
  role: string;
  name: string;
  /** A link's address, else empty. */
  url: string;
}

/** The interactive controls of an aria snapshot. A link's address is its
 * `/url:` child line. A name with a colon in it is quoted whole in the
 * snapshot (`- 'button "Remove leg 2: A to B"': Remove leg`), with a single
 * quote written twice, so both shapes are read. */
function interactiveControls(snapshot: string): Control[] {
  const lines = snapshot.split('\n');
  const roles = INTERACTIVE.join('|');
  const plain = new RegExp(`^\\s*- (${roles}) "((?:[^"\\\\]|\\\\.)*)"`);
  const quoted = new RegExp(`^\\s*- '(${roles}) "((?:[^"\\\\]|\\\\.|'')*)"'`);
  const controls: Control[] = [];
  lines.forEach((line, index) => {
    const quotedMatch = quoted.exec(line);
    const match = quotedMatch ?? plain.exec(line);
    if (!match) return;
    const [, role = '', rawName = ''] = match;
    const name = quotedMatch ? rawName.replaceAll("''", "'") : rawName;
    const next = lines[index + 1]?.trim() ?? '';
    const url = role === 'link' && next.startsWith('- /url:') ? next.slice('- /url:'.length).trim() : '';
    controls.push({ role, name, url });
  });
  return controls;
}

/** The "role name xN" of every name two or more controls share. Links to one
 * address count once. */
function duplicateNames(controls: Control[]): string[] {
  const destinations = new Set<string>();
  const counts = new Map<string, number>();
  for (const { role, name, url } of controls) {
    if (name in ALLOWED) continue;
    if (role === 'link') {
      const destination = `${name}\n${url}`;
      if (destinations.has(destination)) continue;
      destinations.add(destination);
    }
    const key = `${role} "${name}"`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts].filter(([, count]) => count > 1).map(([key, count]) => `${key} x${count}`);
}

async function mainControls(page: Page): Promise<Control[]> {
  return interactiveControls(await page.locator('#main-content').ariaSnapshot());
}

test.describe('no two controls in main share an accessible name', () => {
  test.use({ viewport: { width: 1366, height: 900 } });

  for (const surface of SURFACES) {
    test(surface.name, async ({ page, context, request }) => {
      test.skip(surface.signedIn === true && !SESSION_COOKIE, 'set E2E_SESSION_COOKIE to the seed session');
      if (surface.signedIn) await logIn(context);
      const cleanup = await surface.open(page, request);
      try {
        await expect(page.locator('#main-content').getByRole('heading', { level: 1 })).toBeVisible();
        const include = surface.mustInclude;
        if (include) {
          await expect
            .poll(async () => (await mainControls(page)).some((c) => include.test(`${c.role} "${c.name}"`)))
            .toBe(true);
        }
        expect(duplicateNames(await mainControls(page))).toEqual([]);
      } finally {
        await cleanup();
      }
    });
  }
});
