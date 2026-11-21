import { test, expect, type Page } from '@playwright/test';

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
// Not yet listed: /journeys and a journey page, whose repeated "Remove
// leg", "Edit search" and "Follow this journey" are fixed separately; add
// them here when that lands.

const SURFACES: [name: string, path: string][] = [
  ['/lines', '/lines'],
  ['a Metrolink line', '/transit/metrolink/lines/blue'],
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
 * `/url:` child line. */
function interactiveControls(snapshot: string): Control[] {
  const lines = snapshot.split('\n');
  const pattern = new RegExp(`^\\s*- (${INTERACTIVE.join('|')}) "((?:[^"\\\\]|\\\\.)*)"`);
  const controls: Control[] = [];
  lines.forEach((line, index) => {
    const match = pattern.exec(line);
    if (!match) return;
    const [, role = '', name = ''] = match;
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

async function mainDuplicates(page: Page): Promise<string[]> {
  const snapshot = await page.locator('#main-content').ariaSnapshot();
  return duplicateNames(interactiveControls(snapshot));
}

test.describe('no two controls in main share an accessible name', () => {
  test.use({ viewport: { width: 1366, height: 900 } });

  for (const [name, path] of SURFACES) {
    test(name, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator('#main-content').getByRole('heading', { level: 1 })).toBeVisible();
      expect(await mainDuplicates(page)).toEqual([]);
    });
  }
});
