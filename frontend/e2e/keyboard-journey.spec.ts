import { test, expect, type Locator, type Page } from '@playwright/test';
import {
  createMultiLegJourney,
  deleteJourney,
  logIn,
  londonTomorrow,
  ownerHeaders,
  SESSION_COOKIE,
} from './screenReaderFixtures';

// A journey done with the keyboard alone, asserting where focus is at each
// step. keyboard-focus.spec.ts checks overlays and every stop's focus
// indicator; this follows a person through the app: the skip link, a plan made
// with the station combobox and Enter, a train tracked, a leg expanded, a
// journey deleted and the delete undone. Nothing is clicked: elements are
// reached with Tab (`tabTo`, which fails if one can't be) and used with Enter,
// Space and the arrow keys.
//
// Fixtures: the seed's fixture trains for tomorrow (seed.sql: E2EMJ1 to
// E2EMJ3, ZMA to ZMB), and throwaway journeys removed afterwards.

/** Presses `key` until `target` has focus: a stop on the page's Tab order.
 * Fails after `max` presses, so a control a keyboard can't reach fails here. */
async function tabTo(page: Page, target: Locator, key: 'Tab' | 'Shift+Tab' = 'Tab', max = 80): Promise<void> {
  for (let presses = 0; presses < max; presses++) {
    await page.keyboard.press(key);
    if (await target.evaluate((element) => element === document.activeElement).catch(() => false)) return;
  }
  throw new Error(`${key} did not reach ${String(target)} in ${max} presses`);
}

/** Whether the focused element is inside `container`. */
const focusIsInside = (container: Locator) => container.evaluate((el) => el.contains(document.activeElement));

/** Waits for focus to move into `container`. A dialog is in the page a
 * moment before focus is: Mantine's focus trap moves it in a timer set when
 * the dialog mounts, so reading focus as soon as the dialog's text shows
 * (as this spec did) is a race that a loaded runner loses (DS-635). */
const expectFocusInside = (container: Locator, message: string) =>
  expect.poll(() => focusIsInside(container), { message }).toBe(true);

test.describe('keyboard-only journey', () => {
  test.skip(!SESSION_COOKIE, 'set E2E_SESSION_COOKIE to the seed session');

  test('skip link, plan, track a train', async ({ page, context, request }) => {
    await logIn(context);
    const main = page.locator('#main-content');
    const tracked: { id: string | null } = { id: null };
    try {
      await test.step('the first Tab stop is the skip link, and it moves past the header', async () => {
        await page.goto('/plan');
        await page.keyboard.press('Tab');
        const skip = page.getByRole('link', { name: 'Skip to content' });
        await expect(skip).toBeFocused();
        await page.keyboard.press('Enter');
        await expect(page).toHaveURL(/#main-content$/);
        // The browser carries its place to the main region: the next Tab stop is in it.
        await page.keyboard.press('Tab');
        expect(await focusIsInside(main)).toBe(true);
      });

      await test.step('the station combobox takes typing, ArrowDown and Enter, and keeps focus', async () => {
        const from = page.getByRole('combobox', { name: 'From' });
        await tabTo(page, from);
        await page.keyboard.type('KGX');
        await expect(page.getByRole('option', { name: /London Kings Cross/ })).toBeVisible();
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');
        await expect(from).toHaveValue('London Kings Cross (KGX)');
        await expect(from).toBeFocused();
        // Then the field's own Clear button, before the next field.
        await page.keyboard.press('Tab');
        await expect(page.getByRole('button', { name: 'Clear From' })).toBeFocused();
        const to = page.getByRole('combobox', { name: 'To' });
        await tabTo(page, to);
        await page.keyboard.type('EUS');
        await expect(page.getByRole('option', { name: /London Euston/ })).toBeVisible();
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');
        await expect(to).toHaveValue('London Euston (EUS)');
        await expect(to).toBeFocused();
      });

      await test.step('Enter on Find routes plans; the next Tab reaches the results', async () => {
        // The fixture stations (ZMA, ZMB) are not in the station search, so
        // the form is filled from the URL, as a shared link would. The plan is
        // answered here: `/Trips/plan` is rate limited per client and the plan
        // specs spend that budget on real searches.
        await page.route('**/api/Trips/plan?*', (route) => route.fulfill({ json: fixturePlan(londonTomorrow()) }));
        await page.goto(`/plan?origin=ZMA&destination=ZMB&date=${londonTomorrow()}&departAfter=08:00`);
        const find = page.getByRole('button', { name: 'Find routes' });
        await expect(find).toBeEnabled();
        await tabTo(page, find);
        await page.keyboard.press('Enter');
        await expect(page.getByText(/^09:00 .*09:40$/).first()).toBeVisible();
        // The button gives way to the results: Tab carries on into them.
        await page.keyboard.press('Tab');
        await expect(page.getByRole('button', { name: 'Earlier routes' })).toBeFocused();
      });

      await test.step('Space picks the route and Enter on Track this journey saves it', async () => {
        await page.keyboard.press('Tab');
        const radio = main.locator('[data-plan-entry]').first().getByRole('radio');
        await expect(radio).toBeFocused();
        await page.keyboard.press('Space');
        await expect(radio).toBeChecked();
        await tabTo(page, page.getByRole('button', { name: 'Track this journey' }));
        await page.keyboard.press('Enter');
        await expect(page.getByRole('alert').filter({ hasText: 'First leg tracked' })).toBeVisible();
        // What was just done is announced (an alert), and focus is not moved:
        // the button is gone, so the way on is the next Tab to "View journey".
        const view = page.getByRole('link', { name: 'View journey' });
        tracked.id = ((await view.getAttribute('href')) ?? '').split('/').pop() ?? null;
        await tabTo(page, view);
        await page.keyboard.press('Enter');
        await expect(page).toHaveURL(/\/journeys\/j_/);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await expect(page.getByRole('link', { name: 'Train E2EMJ1' })).toBeVisible();
      });
    } finally {
      if (tracked.id) await deleteJourney(request, tracked.id);
    }
  });

  test('expand a leg, delete the journey and undo', async ({ page, context, request }) => {
    await logIn(context);
    const name = `E2E keyboard delete ${Math.random().toString(36).slice(2, 8)}`;
    const id = await createMultiLegJourney(request, name);
    try {
      await page.goto(`/journeys/${id}`);

      await test.step('a folded walk opens with Enter and focus stays on it', async () => {
        const fold = page.getByRole('button', { name: /^Walk to Fixture Parkway Tram, 5 min/ });
        await tabTo(page, fold);
        await expect(fold).toHaveAttribute('aria-expanded', 'false');
        await page.keyboard.press('Enter');
        await expect(fold).toHaveAttribute('aria-expanded', 'true');
        await expect(fold).toBeFocused();
        // The walk follows in the Tab order, named for itself.
        await page.keyboard.press('Tab');
        await expect(page.getByRole('button', { name: /^Edit leg: Walk/ })).toBeFocused();
      });

      const trigger = page.getByRole('button', { name: 'Delete journey', exact: true });
      const dialog = page.getByRole('dialog');
      await test.step('Delete journey opens a dialog that holds focus, and Escape gives it back', async () => {
        await tabTo(page, trigger, 'Shift+Tab');
        await page.keyboard.press('Enter');
        await expect(dialog).toContainText('You can undo for a few seconds');
        await expectFocusInside(dialog, 'focus to move into the dialog');
        for (let presses = 0; presses < 6; presses++) {
          await page.keyboard.press('Tab');
          expect(await focusIsInside(dialog)).toBe(true);
        }
        await page.keyboard.press('Escape');
        await expect(dialog).toBeHidden();
        await expect(trigger).toBeFocused();
      });

      await test.step('confirming deletes it, and Undo on the toast brings it back', async () => {
        await page.keyboard.press('Enter');
        const confirm = page.getByRole('button', { name: 'Confirm delete journey' });
        // Tab only once the dialog has taken focus: before that a Tab press
        // moves through the page behind it.
        await expect(dialog).toBeVisible();
        await expectFocusInside(dialog, 'focus to move into the dialog');
        await tabTo(page, confirm);
        await page.keyboard.press('Enter');
        await expect(page).toHaveURL(/\/journeys$/);
        const toast = page.getByRole('status', { name: 'Notifications' });
        await expect(toast).toContainText('Journey deleted');
        const row = page.getByRole('link', { name, exact: true });
        await expect(row).toHaveCount(0);
        const undo = toast.getByRole('button', { name: /^Undo/ });
        await tabTo(page, undo);
        await page.keyboard.press('Enter');
        await expect(page.getByRole('link', { name, exact: true })).toBeVisible();
        await expect(toast).not.toContainText('Journey deleted');
        // Undone before the delete was sent: the journey is still there.
        const kept = await request.get(`/api/Journeys/${id}`, { headers: ownerHeaders() });
        expect(kept.status()).toBe(200);
      });
    } finally {
      await deleteJourney(request, id);
    }
  });
});

/** `/Trips/plan`'s answer for ZMA to ZMB from 08:00 on `date`: the fixture
 * train E2EMJ1, 09:00 to 09:40 (the api's own answer for it, as of the
 * seed). */
function fixturePlan(date: string) {
  const time = (value: string) => ({ time: value, dayOffset: 0 });
  return {
    results: 'fastest',
    maxChanges: 4,
    arriveBy: null,
    departAfter: time('08:00:00'),
    serviceDates: [date],
    avoid: [],
    avoidStop: [],
    avoidChange: [],
    via: [],
    stationGroups: {},
    operator: [],
    avoidOperator: [],
    preferOperator: [],
    operatorGroups: {},
    operatorsNotRunning: [],
    segments: [
      {
        originCrs: 'ZMA',
        destinationCrs: 'ZMB',
        itineraries: [
          {
            legs: [
              {
                kind: 'train',
                trainUid: 'E2EMJ1',
                serviceDate: date,
                originCrs: 'ZMA',
                destinationCrs: 'ZMB',
                scheduledDeparture: '09:00:00',
                scheduledArrival: '09:40:00',
                departureDayOffset: 0,
                arrivalDayOffset: 0,
                workingDeparture: '09:00:00',
                workingArrival: '09:40:00',
                workingDepartureDayOffset: 0,
                workingArrivalDayOffset: 0,
                bookedDeparturePlatform: null,
                bookedArrivalPlatform: null,
                publicDeparture: '09:00:00',
                publicArrival: '09:40:00',
                publicDepartureDayOffset: 0,
                publicArrivalDayOffset: 0,
                operator: null,
                headcode: null,
                serviceMode: 'train',
                liveTracking: true,
              },
            ],
            changeCount: 0,
            accessChangeCount: 0,
            totalDurationMinutes: 40,
            exceedsRecommendedChanges: false,
            continuesPreviousTrain: false,
          },
        ],
        cappedByMaxChanges: false,
        departAfter: time('08:00:00'),
        arriveBy: null,
        noResultReason: null,
      },
    ],
    journeys: [
      {
        changeCount: 0,
        accessChangeCount: 0,
        departure: time('09:00:00'),
        arrival: time('09:40:00'),
        totalDurationMinutes: 40,
        exceedsRecommendedChanges: false,
      },
    ],
    live: { applied: false, reason: 'outsideLiveWindow' },
    provisional: false,
    provisionalFrom: date,
  };
}
