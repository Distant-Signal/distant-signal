import { test, expect, type Locator, type Page } from '@playwright/test';
import { openNavDrawer, waitForSessionNav } from './navDrawer';

// A keyboard sweep, which axe cannot do: it reads one DOM snapshot, never
// presses a key. Two contracts, in light and dark:
//
//  1. Overlays (modals, drawers, popovers, menus): opening one moves focus
//     into it, Tab and Shift+Tab stay inside a modal one, Escape closes it
//     and focus goes back to the control that opened it.
//  2. Every stop on a core route's Tab order shows a focus indicator (the
//     element looks different focused than not), the Tab order never gets
//     stuck on one element (no keyboard trap), and it leaves the page and
//     comes back to the browser chrome.
//
// Fixtures are the seed's (frontend/e2e/fixtures/seed.sql), like the other
// specs: the session cookie is the seeded user's, the group and the station
// the same ids accessibility.spec.ts uses.
const SESSION_COOKIE = process.env.E2E_SESSION_COOKIE;
const GROUP_ID = process.env.E2E_GROUP_ID;
const STATION_CRS = process.env.E2E_REAL_STATION_CRS ?? 'KGX';

const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1366, height: 900 };

/** Same cookie shape as accessibility.spec.ts's `sessionState`. */
function sessionState(value: string) {
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

/** Transitions off, so a style read right after a key press is the final
 * one (a focus ring that fades in would read as absent for a frame). */
async function settle(page: Page) {
  await page.addStyleTag({
    content: '*, *::before, *::after { transition: none !important; animation: none !important; }',
  });
}

/** Whether the focused element is inside `container`. */
function focusIsInside(container: Locator): Promise<boolean> {
  return container.evaluate((el) => el.contains(document.activeElement));
}

/** Presses `key` once and returns whether focus is still inside `container`. */
async function pressStaysInside(page: Page, container: Locator, key: string): Promise<boolean> {
  await page.keyboard.press(key);
  return focusIsInside(container);
}

/** Opens `overlay` from `trigger` with the keyboard. `page.goto` can resolve
 * before React hydrates, and a key press on a not yet live control does
 * nothing, so the press is repeated until the overlay shows (the same
 * approach as navDrawer.ts). */
async function openWithKeyboard(trigger: Locator, overlay: Locator, page: Page) {
  await expect(async () => {
    if (!(await overlay.isVisible())) {
      await trigger.focus();
      await page.keyboard.press('Enter');
    }
    await expect(overlay).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
}

/** What a focus-trapped overlay owes a keyboard user. `overlay` is the
 * dialog; `trigger` is what opened it. */
async function expectDialogContract(page: Page, trigger: Locator, overlay: Locator) {
  await openWithKeyboard(trigger, overlay, page);
  // Focus moved into the dialog (Mantine focuses its first tabbable or the
  // `data-autofocus` element a frame after it mounts).
  await expect.poll(() => focusIsInside(overlay), { message: 'focus to move into the dialog' }).toBe(true);

  // The panel's lazy parts (the date fields' chunk) settle in the first moments
  // after it opens; a Tab pressed before then races their swap-in.
  await page.waitForTimeout(500);

  // Trapped: more presses than the dialog has stops, in both directions,
  // and focus never leaves it.
  const stops = await overlay.locator('a[href], button, input, select, textarea, [tabindex]').count();
  const presses = Math.min(stops + 3, 25);
  for (const key of ['Tab', 'Shift+Tab']) {
    for (let i = 0; i < presses; i++) {
      expect(await pressStaysInside(page, overlay, key), `${key} #${i + 1} left the dialog`).toBe(true);
    }
  }

  await page.keyboard.press('Escape');
  // A filter panel's first Escape only closes an open option list (ListFilterBar
  // does that on purpose), so one more may be needed.
  if (await overlay.isVisible()) await page.keyboard.press('Escape');
  await expect(overlay).toBeHidden();
  await expect(trigger, 'focus to return to the control that opened the dialog').toBeFocused();
}

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`keyboard overlays, ${colorScheme}`, () => {
    test.use({ colorScheme });

    test.describe('anonymous', () => {
      test.use({ viewport: DESKTOP });

      test('/incidents, filters popover', async ({ page }) => {
        await page.goto('/incidents?period=custom');
        const trigger = page.getByRole('button', { name: 'Filters' });
        await expectDialogContract(page, trigger, page.getByRole('dialog', { name: 'Filters' }));
      });

      test('/trains, filters popover', async ({ page }) => {
        await page.goto(`/trains?station=${STATION_CRS}&stops_at=PBO`);
        const trigger = page.getByRole('button', { name: 'Filters' });
        await expectDialogContract(page, trigger, page.getByRole('dialog', { name: 'Filters' }));
      });

      test('/lines, the log in prompt a pin opens', async ({ page }) => {
        await page.goto('/lines');
        const trigger = page.getByRole('button', { name: /^Pin \(/ }).first();
        await expectDialogContract(page, trigger, page.getByRole('dialog', { name: 'Log in required' }));
      });
    });

    test.describe('anonymous, phone', () => {
      test.use({ viewport: PHONE });

      test('the navigation drawer', async ({ page }) => {
        await page.goto('/');
        const drawer = await openNavDrawer(page);
        await expect.poll(() => focusIsInside(drawer), { message: 'focus to move into the drawer' }).toBe(true);
        for (const key of ['Tab', 'Shift+Tab']) {
          for (let i = 0; i < 25; i++) {
            expect(await pressStaysInside(page, drawer, key), `${key} #${i + 1} left the drawer`).toBe(true);
          }
        }
        await page.keyboard.press('Escape');
        await expect(drawer).toBeHidden();
        await expect(
          page.getByRole('navigation', { name: 'Main', exact: true }).getByRole('button', { name: 'Navigation menu' }),
          'focus to return to the burger',
        ).toBeFocused();
      });

      test('/incidents, filters sheet', async ({ page }) => {
        await page.goto('/incidents?period=custom');
        const trigger = page.getByRole('button', { name: 'Filters' });
        await expectDialogContract(page, trigger, page.getByRole('dialog', { name: 'Filters' }));
      });
    });

    test.describe('logged in', () => {
      test.skip(!SESSION_COOKIE, 'set E2E_SESSION_COOKIE to a raw distant_signal_session value');
      test.use({
        viewport: DESKTOP,
        storageState: SESSION_COOKIE ? sessionState(SESSION_COOKIE) : undefined,
      });

      test('the account menu', async ({ page }) => {
        await page.goto('/lines');
        await waitForSessionNav(page);
        const trigger = page.locator('nav[aria-label="Main"]').getByRole('button', { name: /, account menu for / });
        const menu = page.getByRole('menu');
        // A menu is not a modal: Tab leaves it (and closes it), so the
        // contract is focus in, arrow keys move within it, Escape out.
        await openWithKeyboard(trigger, menu, page);
        await expect.poll(() => focusIsInside(menu), { message: 'focus to move into the menu' }).toBe(true);
        const first = await menu.evaluate(() => document.activeElement?.textContent ?? '');
        await page.keyboard.press('ArrowDown');
        expect(await focusIsInside(menu), 'ArrowDown stayed in the menu').toBe(true);
        const second = await menu.evaluate(() => document.activeElement?.textContent ?? '');
        expect(second, 'ArrowDown moved to the next item').not.toBe(first);
        await page.keyboard.press('Escape');
        await expect(menu).toBeHidden();
        await expect(trigger, 'focus to return to the account button').toBeFocused();
      });

      test('/journeys, a row menu closes with Escape and gives focus back', async ({ page }) => {
        await page.goto('/journeys');
        const trigger = page.getByRole('button', { name: /^More actions for/ }).first();
        const menu = page.getByRole('menu');
        await openWithKeyboard(trigger, menu, page);
        await expect.poll(() => focusIsInside(menu), { message: 'focus to move into the menu' }).toBe(true);
        await page.keyboard.press('Escape');
        await expect(menu).toBeHidden();
        await expect(trigger).toBeFocused();
      });

      test('/journeys, the stop tracking confirmation', async ({ page }) => {
        await page.goto('/journeys');
        const kebab = page.getByRole('button', { name: /^More actions for/ }).first();
        await openWithKeyboard(kebab, page.getByRole('menu'), page);
        await page.getByRole('menuitem', { name: 'Stop tracking' }).press('Enter');
        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();
        await expect.poll(() => focusIsInside(dialog), { message: 'focus to move into the dialog' }).toBe(true);
        for (const key of ['Tab', 'Shift+Tab']) {
          for (let i = 0; i < 12; i++) {
            expect(await pressStaysInside(page, dialog, key), `${key} #${i + 1} left the dialog`).toBe(true);
          }
        }
        await page.keyboard.press('Escape');
        await expect(dialog).toBeHidden();
        // The menu item that opened it is gone, so the row's menu button
        // (or at worst the page) takes focus: never a dead end.
        await expect
          .poll(() => page.evaluate(() => document.activeElement?.tagName.toLowerCase()), {
            message: 'focus to land somewhere after the dialog closed',
          })
          .not.toBe('body');
      });

      test('/groups/[id], the rename dialog', async ({ page }) => {
        test.skip(!GROUP_ID, 'set E2E_GROUP_ID');
        await page.goto(`/groups/${GROUP_ID}`);
        const trigger = page.getByRole('button', { name: /^Rename$/ }).first();
        await expectDialogContract(page, trigger, page.getByRole('dialog'));
      });

      test('/groups/[id], the share a train dialog', async ({ page }) => {
        test.skip(!GROUP_ID, 'set E2E_GROUP_ID');
        await page.goto(`/groups/${GROUP_ID}`);
        const trigger = page.getByRole('button', { name: /Add one of my trains/i });
        await expectDialogContract(page, trigger, page.getByRole('dialog'));
      });
    });
  });
}

// ---------------------------------------------------------------------------
// Tab order and focus indicators
// ---------------------------------------------------------------------------

const FOCUSABLE = 'a[href], button, input, select, textarea, summary, [tabindex]';

/** Before any key is pressed, in the page: every control's resting look,
 * kept for `readFocusedStop`. What a focus cue can change on a control is read
 * from computed styles, and the cue is not always on the control itself: a
 * stretched card link rings its card, and a visually hidden checkbox or radio
 * styles its label. So the outline, shadow and colours of the control, its
 * nearest ancestors and its siblings are all read. */
const recordRestingLooks = (selector: string) => {
  const look = (el: Element): string => {
    const nearby: Element[] = [el];
    for (let node = el.parentElement, depth = 0; node && depth < 10; node = node.parentElement, depth++) {
      nearby.push(node);
    }
    for (const sibling of [el.previousElementSibling, el.nextElementSibling]) {
      if (sibling) nearby.push(sibling, ...Array.from(sibling.children));
    }
    return nearby
      .map((node) => {
        const s = getComputedStyle(node);
        return [
          s.outlineStyle === 'none' ? 'none' : `${s.outlineWidth} ${s.outlineStyle} ${s.outlineColor}`,
          s.boxShadow,
          s.borderTopColor,
          s.backgroundColor,
          s.textDecorationLine,
          s.color,
        ].join('|');
      })
      .join('\n');
  };
  const rest = new Map<Element, string>();
  for (const el of Array.from(document.querySelectorAll(selector))) rest.set(el, look(el));
  Object.assign(window, { keyboardSweepRest: rest, keyboardSweepLook: look });
};

/** After a Tab: the focused control, whether its look differs from its
 * resting one, and whether the sweep has been here before. */
const readFocusedStop = () => {
  const el = document.activeElement;
  if (!el || el === document.body) return null;
  const w = window as unknown as {
    keyboardSweepRest: Map<Element, string>;
    keyboardSweepLook: (el: Element) => string;
  };
  const resting = w.keyboardSweepRest.get(el);
  // Tab stays on one element a few times for a native date or time field (one
  // stop per segment: hours, minutes...). Coming back to an element after
  // visiting another, or staying past any field's segments, is a loop.
  const state = window as unknown as { keyboardSweepLast?: Element; keyboardSweepRun?: number };
  state.keyboardSweepRun = state.keyboardSweepLast === el ? (state.keyboardSweepRun ?? 1) + 1 : 1;
  state.keyboardSweepLast = el;
  const looped =
    state.keyboardSweepRun > 6 || (state.keyboardSweepRun === 1 && el.hasAttribute('data-keyboard-sweep-seen'));
  el.setAttribute('data-keyboard-sweep-seen', '');
  return {
    label: `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''} "${(el.getAttribute('aria-label') ?? el.textContent).trim().slice(0, 40)}"`,
    // A control that mounted after the sweep began (a dropdown's option) has
    // no resting look to compare with; it is not judged.
    differs: resting === undefined || resting !== w.keyboardSweepLook(el),
    looped,
  };
};

const CORE_ROUTES = [
  { name: '/', path: '/', loggedIn: false },
  { name: '/lines', path: '/lines', loggedIn: false },
  { name: '/incidents', path: '/incidents?period=all', loggedIn: false },
  { name: '/plan', path: '/plan', loggedIn: false },
  { name: 'station', path: `/stations/${STATION_CRS}`, loggedIn: false },
  { name: '/journeys', path: '/journeys', loggedIn: true },
  { name: '/groups', path: '/groups', loggedIn: true },
] as const;

const MAX_STOPS = 120;

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`tab order and focus indicators, ${colorScheme}`, () => {
    test.use({ colorScheme, viewport: DESKTOP });

    for (const route of CORE_ROUTES) {
      test.describe(route.name, () => {
        if (route.loggedIn) {
          test.skip(!SESSION_COOKIE, 'set E2E_SESSION_COOKIE to a raw distant_signal_session value');
          test.use({ storageState: SESSION_COOKIE ? sessionState(SESSION_COOKIE) : undefined });
        }

        test('every tab stop shows a focus indicator and the order never traps', async ({ page }) => {
          const response = await page.goto(route.path);
          expect(response?.status() ?? 0).toBeLessThan(500);
          await waitForSessionNav(page);
          await settle(page);
          // Start from the top of the document, as a fresh keyboard user.
          await page.evaluate(() => {
            (document.activeElement as HTMLElement | null)?.blur();
            window.scrollTo(0, 0);
          });

          await page.evaluate(recordRestingLooks, FOCUSABLE);
          const missing: string[] = [];
          let stops = 0;
          let left = false;
          for (let i = 0; i < MAX_STOPS; i++) {
            await page.keyboard.press('Tab');
            const stop = await page.evaluate(readFocusedStop);
            if (stop === null) {
              // Focus went to the browser chrome (the body): the order ended.
              left = true;
              break;
            }
            // Back on a stop already visited: a loop inside the page, which
            // is a keyboard trap (or a broken tabindex).
            expect(stop.looped, `Tab order loops back to ${stop.label} without leaving the page`).toBe(false);
            stops++;
            if (!stop.differs) missing.push(`${stop.label}: no visible focus indicator`);
          }

          expect(missing, 'tab stops without a focus indicator').toEqual([]);
          expect(stops, 'the route has keyboard-reachable controls').toBeGreaterThan(0);
          // The sweep is capped; reaching the end is only asserted when the
          // page has fewer stops than the cap.
          if (stops < MAX_STOPS) expect(left, 'Tab left the page (no keyboard trap)').toBe(true);
        });
      });
    }
  });
}
