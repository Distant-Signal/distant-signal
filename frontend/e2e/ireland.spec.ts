import { test, expect, type BrowserContext } from '@playwright/test';

// The island of Ireland pages against the live api and the seed's Irish
// stations, lines and Dublin Connolly's live board
// (frontend/e2e/fixtures/seed.sql). A smoke test: each page renders its
// data, says what we don't have, and never shows a line status.

test.describe('island of Ireland pages', () => {
  test('the overview lists both networks, and /lines links it', async ({ page }) => {
    await page.goto('/lines');
    await page.getByRole('link', { name: 'Ireland and Northern Ireland' }).click();
    await expect(page).toHaveURL(/\/island-of-ireland$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Ireland and Northern Ireland' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Iarnród Éireann', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'NI Railways', exact: true })).toBeVisible();
    await expect(page.getByText('Good service')).toHaveCount(0);
  });

  test("a network page lists its lines and stations, and a station's live board", async ({ page }) => {
    await page.goto('/island-of-ireland/iarnrod-eireann');
    await expect(page.getByRole('heading', { level: 1, name: 'Iarnród Éireann' })).toBeVisible();
    await expect(page.getByText("We don't show line status for Iarnród Éireann.", { exact: false })).toBeVisible();
    await page.getByRole('list', { name: 'Stations' }).getByRole('link', { name: 'Dublin Connolly' }).click();

    await expect(page.getByRole('heading', { level: 1, name: 'Dublin Connolly' })).toBeVisible();
    const board = page.getByRole('list', { name: 'Live departures' });
    await expect(board.getByRole('listitem')).toHaveCount(2);
    await expect(board.getByRole('listitem').first()).toContainText('08:05');
    await expect(board.getByRole('listitem').first()).toContainText('5 min late');
    await expect(page.getByText(/^Updated /)).toBeVisible();
    await expect(page.getByText('Live Irish Rail data from', { exact: false })).toBeVisible();
  });

  test("a board row opens its train's page, with its delay and calling points", async ({ page }) => {
    await page.goto('/island-of-ireland/iarnrod-eireann/stations/8220IR0007');
    const board = page.getByRole('list', { name: 'Live departures' });
    // "No Information": no report yet, never "On time".
    await expect(board.getByRole('listitem').nth(1)).toContainText('No report yet');
    await board.getByRole('link', { name: /to Belfast Grand Central/ }).click();

    // The board's station rides along, for "Track this train".
    await expect(page).toHaveURL(/\/island-of-ireland\/iarnrod-eireann\/trains\/A101\/2026-09-17\?from=CNLLY$/);
    await expect(
      page.getByRole('heading', { level: 1, name: '08:00 Dublin Connolly to Belfast Grand Central' }),
    ).toBeVisible();
    await expect(page.getByText('5 min late')).toBeVisible();
    await expect(page.getByText('Left Dublin Connolly')).toBeVisible();
    const calls = page.getByRole('list', { name: 'Calling points' }).getByRole('listitem');
    await expect(calls).toHaveCount(3);
    await expect(calls.nth(2)).toContainText('Belfast');
    await expect(calls.nth(2)).toContainText('Arrives');
    await calls.nth(1).getByRole('link').click();
    await expect(page.getByRole('heading', { level: 1, name: 'Drogheda' })).toBeVisible();
  });

  test('a train with no report says so, and an unseen train is not found', async ({ page }) => {
    await page.goto('/island-of-ireland/iarnrod-eireann/trains/D802/2026-09-17');
    await expect(page.getByText('No live report yet.')).toBeVisible();
    await expect(page.getByText('On time')).toHaveCount(0);

    const response = await page.goto('/island-of-ireland/iarnrod-eireann/trains/Z999/2026-09-17');
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1, name: "We haven't seen this train" })).toBeVisible();
  });

  test('a line page draws its stations, including a corridor id with a slash', async ({ page }) => {
    await page.goto('/island-of-ireland/iarnrod-eireann');
    await page.getByRole('link', { name: 'Dublin - Drogheda/Dundalk' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Dublin - Drogheda/Dundalk' })).toBeVisible();
    await expect(page.getByText("We don't have line status for this line.")).toBeVisible();

    await page.goto('/island-of-ireland/iarnrod-eireann/lines/DUB-BFT');
    const strip = page.getByRole('list', { name: /^Dublin - Belfast stations/ });
    await expect(strip.getByRole('link')).toHaveText(['Dublin Connolly', 'Drogheda', 'Belfast Grand Central']);
  });

  test("a station with no board, and NI Railways' pages, say so", async ({ page }) => {
    await page.goto('/island-of-ireland/iarnrod-eireann/stations/7020IR2162');
    await expect(page.getByText("We don't have live departures for this station.")).toBeVisible();

    await page.goto('/island-of-ireland/ni-railways/stations/nir-bangor');
    await expect(page.getByRole('heading', { level: 1, name: 'Bangor' })).toBeVisible();
    await expect(page.getByText("We don't have live NI Railways times.")).toBeVisible();
    await expect(page.getByRole('link', { name: 'Bangor Line' })).toBeVisible();
    await page.getByRole('link', { name: 'Bangor Line' }).click();
    // NI Railways' names as the api tidies them.
    await expect(page.getByRole('list', { name: /^Bangor Line stations/ }).getByRole('link')).toHaveText([
      'Lanyon Place',
      'Holywood',
      'Bangor',
    ]);
    await expect(page.getByText('Translink data from', { exact: false })).toBeVisible();
  });

  test('an unknown network, line or station is not found', async ({ page }) => {
    for (const path of [
      '/island-of-ireland/republic-of-ireland',
      '/island-of-ireland/ni-railways/lines/DUB-BFT',
      '/island-of-ireland/ni-railways/stations/nope',
      '/island-of-ireland/ni-railways/trains/A101/2026-09-17',
    ]) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(404);
    }
  });

  test('the station search finds an Irish station and opens its page', async ({ page }) => {
    await page.goto('/stations');
    await page.getByRole('combobox', { name: 'Station name or code' }).fill('Holywood');
    await page.getByRole('option', { name: /Holywood/ }).click();
    await page.getByRole('button', { name: 'Look up' }).click();
    await expect(page).toHaveURL(/\/island-of-ireland\/ni-railways\/stations\/nir-holywood$/);
  });
});

// Tracking (2b) and sharing (4) an Iarnród Éireann train, logged in as
// the seed's fixture-owner. Serial, and the train tracked here is untracked
// again: other specs and the visual screenshots read the same rows.
const SESSION_COOKIE = process.env.E2E_SESSION_COOKIE;
const GROUP_ID = process.env.E2E_GROUP_ID ?? 'fixture-group-1';

async function logIn(context: BrowserContext) {
  const base = new URL(process.env.E2E_BASE_URL ?? 'http://localhost:3000');
  await context.addCookies([
    {
      name: 'distant_signal_session',
      value: SESSION_COOKIE ?? '',
      domain: base.hostname,
      path: '/',
      expires: -1,
      httpOnly: true,
      secure: base.protocol === 'https:',
      sameSite: 'Lax',
    },
  ]);
}

/** Dublin's date now, as the seed dates A102. */
function dublinToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Dublin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

test.describe('tracking an Iarnród Éireann train', () => {
  test.describe.configure({ mode: 'serial' });
  test.skip(!SESSION_COOKIE, 'needs E2E_SESSION_COOKIE');

  test('a train running today is tracked from its page, then untracked', async ({ page, context }) => {
    await logIn(context);
    const date = dublinToday();
    await page.goto(`/island-of-ireland/iarnrod-eireann/trains/A102/${date}?from=CNLLY`);
    await expect(page.getByRole('heading', { level: 1, name: '09:00 Dublin Connolly to Drogheda' })).toBeVisible();
    await page.getByRole('button', { name: 'Track this train' }).click();
    // fixture-owner has a group, so the picker asks where to: Personal.
    await page.getByRole('dialog').getByRole('button', { name: 'Confirm' }).click();

    await expect(page).toHaveURL(/\/journeys\/\d+$/);
    await expect(page.getByRole('heading', { level: 1, name: /Dublin Connolly to Drogheda/ })).toBeVisible();
    await page.getByRole('link', { name: 'Train A102' }).click();

    await expect(page).toHaveURL(new RegExp(`/island-of-ireland/iarnrod-eireann/trains/A102/${date}$`));
    await expect(page.getByRole('button', { name: 'Track this train' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Open journey' })).toBeVisible();

    // Stop tracking it, from the same page: the button comes back.
    await page.getByRole('button', { name: /stop tracking/i }).click();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: /stop tracking/i })
      .click();
    await expect(page.getByRole('button', { name: 'Track this train' })).toBeVisible();
  });

  test('a shared Irish train and journey are named by their boards and link to the train', async ({
    page,
    context,
  }) => {
    await logIn(context);
    await page.goto(`/groups/${GROUP_ID}`);
    // The shared journey, named by its ends (no codes), opens to its leg.
    const journey = page.getByRole('link', {
      name: 'Dublin Connolly to Belfast Grand Central, 17 Sep 2026',
      exact: true,
    });
    await expect(journey).toHaveAttribute('href', '/journeys/900121');
    // The shared train links straight to its Irish page.
    const train = page.getByRole('link', { name: /^Dublin Connolly to Belfast Grand Central, 17 Sep 2026 · / });
    await train.click();
    await expect(page).toHaveURL(/\/island-of-ireland\/iarnrod-eireann\/trains\/A101\/2026-09-17$/);

    await page.goto('/journeys/900121');
    await page.getByRole('link', { name: 'Train A101' }).click();
    await expect(page).toHaveURL(/\/island-of-ireland\/iarnrod-eireann\/trains\/A101\/2026-09-17$/);
  });
});
