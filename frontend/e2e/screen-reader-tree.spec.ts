import { test, expect, type Page } from '@playwright/test';
import { createMultiLegJourney, deleteJourney, logIn, SESSION_COOKIE } from './screenReaderFixtures';

// Accessibility-tree snapshots (`toMatchAriaSnapshot`) of the components a
// screen reader leans on, so a lost name, role or list fails here rather than
// in front of a person using NVDA or VoiceOver. axe checks rules over one DOM
// snapshot; it does not check that "Remove leg" says which leg. These pin the
// names and structure as the browser computes them.
//
// A snapshot lists a subset of the tree (the default `contain` match): what
// matters for the component, not every paragraph. Dates and clock times that
// move with the day are regexes. Fixtures are the seed's
// (e2e/fixtures/seed.sql): the train W12345 on 17 September, and throwaway
// journeys made through the api on tomorrow's fixture trains
// (screenReaderFixtures.ts), removed afterwards.

test.describe('accessibility tree', () => {
  test.skip(!SESSION_COOKIE, 'set E2E_SESSION_COOKIE to the seed session');

  test('the train timeline and its working timetable are named tables with column headers', async ({ page }) => {
    await page.goto('/train/W12345/2026-09-17');
    const timeline = page.getByRole('table', { name: 'Journey timeline' });
    await expect(timeline).toBeVisible();
    await expect(timeline).toMatchAriaSnapshot(`
      - table "Journey timeline":
        - rowgroup:
          - row "Station Scheduled Actual Delay Platform":
            - columnheader "Station"
            - columnheader "Scheduled"
            - columnheader "Actual"
            - columnheader "Delay"
            - columnheader "Platform"
        - rowgroup:
          - row /London Kings Cross 09:00 .* Platform 9 \\(changed from 6\\)/:
            - cell "London Kings Cross"
            - cell "09:00"
          - row /YRK 10:57 12:01 4 min late/:
            - cell "YRK"
            - cell "4 min late"
          - row /EDB 13:30/:
            - cell "EDB"
    `);

    await page.getByRole('button', { name: /^Detailed \(working timetable\)/ }).click();
    const working = page.getByRole('table', { name: /working timetable/i });
    await expect(working).toBeVisible();
    await expect(working.getByRole('columnheader').first()).toBeVisible();
    await expect(working.getByRole('row').nth(1)).toBeVisible();
  });

  test('a journey leg card names its buttons by leg: a tracked train leg', async ({ page, context, request }) => {
    await logIn(context);
    const id = await createMultiLegJourney(request, 'E2E tree legs');
    try {
      await page.goto(`/journeys/${id}`);
      const legs = page.locator('[id^="leg-l_"]:visible');
      await expect(legs).toHaveCount(3);
      await expect(legs.first()).toMatchAriaSnapshot(`
        - paragraph: Leg 1 of 3
        - paragraph: /ZMA to ZMB · \\d\\d:\\d\\d/
        - link "Train E2EMJ1":
          - /url: /\\/train\\/E2EMJ1\\//
        - button "I missed this train"
        - 'button /Change train for leg 1: ZMA to ZMB.*/': Change train
        - 'button /Remove leg 1: ZMA to ZMB.*/': Remove leg
        - table "Journey timeline"
      `);
      // The second train's buttons differ from the first's only by the leg.
      await expect(legs.nth(1)).toMatchAriaSnapshot(`
        - paragraph: Leg 2 of 3
        - 'button /Change train for leg 2: ZMA to ZMB.*/': Change train
        - 'button /Remove leg 2: ZMA to ZMB.*/': Remove leg
      `);
    } finally {
      await deleteJourney(request, id);
    }
  });

  test('a journey leg card names its buttons by leg: an open window leg', async ({ page, context, request }) => {
    await logIn(context);
    const id = await createMultiLegJourney(request, 'E2E tree open');
    try {
      await page.goto(`/journeys/${id}`);
      const open = page.locator('[id^="leg-l_"]:visible').nth(2);
      await expect(open.getByRole('button', { name: /^Edit search/ })).toBeVisible();
      await expect(open).toMatchAriaSnapshot(`
        - paragraph: Leg 3 of 3
        - paragraph: /ZMB to ZMA, \\d+ \\w+ \\d{4}/
        - 'button /Remove leg 3: ZMB to ZMA.*/': Remove leg
        - paragraph: Departing at or after 11:00
        - 'button /Edit search for leg 3: ZMB to ZMA.*/': Edit search
        - combobox "Operator (optional)"
      `);
    } finally {
      await deleteJourney(request, id);
    }
  });

  test('a folded walking row is a named disclosure, and opening it shows the walk as a leg', async ({
    page,
    context,
    request,
  }) => {
    await logIn(context);
    const id = await createMultiLegJourney(request, 'E2E tree walk');
    try {
      await page.goto(`/journeys/${id}`);
      // Folded legs are not counted: the page numbers the three shown legs
      // 1 to 3 and the walk between the first two has no number.
      const fold = page.getByRole('button', { name: /^Walk to Fixture Parkway Tram, 5 min/ });
      await expect(fold).toHaveAttribute('aria-expanded', 'false');
      await expect(page.getByText(/^Leg \d of 3$/)).toHaveCount(3);
      await fold.click();
      await expect(fold).toHaveAttribute('aria-expanded', 'true');
      const walk = page.locator('[data-untracked-leg]');
      await expect(walk).toBeVisible();
      await expect(walk).toMatchAriaSnapshot(`
        - paragraph: Walk
        - 'button /Edit leg: Walk.*/': Edit leg
        - 'button /Remove leg: Walk.*/': Remove leg
      `);
    } finally {
      await deleteJourney(request, id);
    }
  });

  test('the Journeys list is a named list with one item per row', async ({ page, context, request }) => {
    await logIn(context);
    const id = await createMultiLegJourney(request, 'E2E tree row');
    try {
      await page.goto('/journeys');
      const upcoming = page.getByRole('region', { name: 'Upcoming' });
      await expect(upcoming.getByRole('list', { name: 'Upcoming journeys' })).toBeVisible();
      const row = upcoming.getByRole('listitem').filter({ has: page.getByRole('link', { name: 'E2E tree row' }) });
      await expect(row).toHaveCount(1);
      await expect(row).toMatchAriaSnapshot(`
        - listitem:
          - paragraph:
            - link "E2E tree row":
              - /url: /\\/journeys\\/j_/
          - text: Needs a train picked
          - paragraph: /ZMA to ZMA, \\d+ \\w+ \\d{4} · 4 legs/
      `);
      // A followed or shared row's buttons are named for their journey (the
      // seed's shared journeys; see journey-follow.spec.ts).
      const follow = upcoming.getByRole('button', { name: /^Follow this journey: / });
      expect(await follow.count()).toBeGreaterThan(1);
      const names = await follow.evaluateAll((buttons) => buttons.map((b) => b.getAttribute('aria-label')));
      expect(new Set(names).size).toBe(names.length);
    } finally {
      await deleteJourney(request, id);
    }
  });

  test('"Change train" lists earlier trains, the trains in the search and marks the current one', async ({
    page,
    context,
    request,
  }) => {
    await logIn(context);
    const id = await createMultiLegJourney(request, 'E2E tree change');
    try {
      await mockCandidates(page);
      await page.goto(`/journeys/${id}`);
      await page
        .locator('[id^="leg-l_"]')
        .first()
        .getByRole('button', { name: /^Change train/ })
        .click();
      const picker = page.locator('[id^="leg-l_"]:visible').first();
      await expect(picker.getByRole('list', { name: 'Earlier trains' })).toBeVisible();
      await expect(picker).toMatchAriaSnapshot(`
        - paragraph: Earlier trains
        - list "Earlier trains":
          - listitem
        - paragraph: Trains in your search
        - list "Trains in your search":
          - listitem
          - listitem
      `);
      await expect(picker.getByText('Current train')).toBeVisible();
      await expect(picker.getByRole('list', { name: 'Trains in your search' }).getByText('Current train')).toHaveCount(
        1,
      );
    } finally {
      await deleteJourney(request, id);
    }
  });

  test('the plan form has a name for every control', async ({ page }) => {
    await page.goto('/plan');
    const form = page.locator('#main-content');
    await expect(form.getByRole('combobox', { name: 'From' })).toBeVisible();
    await expect(form).toMatchAriaSnapshot(`
      - heading "Plan a journey" [level=1]
      - radiogroup "How do you want to start this journey?":
        - radio "Plan a route for me" [checked]
        - radio "I know my route"
        - radio "Tube, bus or walk"
      - combobox "From"
      - combobox "To"
      - button "Add a stop to call at"
      - textbox "Date"
      - radiogroup "Search by":
        - radio "Depart at" [checked]
        - radio "Arrive by"
      - textbox "Time (optional)"
      - radiogroup "Results":
        - radio "Fastest" [checked]
        - radio "Compare options"
      - button "Advanced options"
      - button "Find routes" [disabled]
    `);
  });
});

/** Answers the leg's candidates with one earlier train and two trains in the
 * search, the first of which is the one the leg is on (E2EMJ1). The seed has
 * no published timetable for the candidates route to search. */
async function mockCandidates(page: Page): Promise<void> {
  const row = (uid: string, scheduled: string, arrival: string) => ({
    uid,
    scheduled,
    destinationCrs: 'ZMB',
    originCrs: 'ZMA',
    destinationArrival: arrival,
    legOriginCrs: 'ZMA',
    legDestinationCrs: 'ZMB',
    legDestinationArrival: arrival,
    legDestinationArrivalDayOffset: 0,
    operator: null,
  });
  await page.route(/\/api\/Journeys\/[^/]+\/legs\/[^/]+\/candidates/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        results: [row('E2EMJ1', '09:00', '09:40'), row('E2EMJ2', '09:30', '10:10')],
        nextCursor: null,
        earlier: [row('E2EMJ0', '08:30', '09:10')],
      }),
    }),
  );
}
