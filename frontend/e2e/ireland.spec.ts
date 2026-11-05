import { test, expect } from '@playwright/test';

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

    await expect(page).toHaveURL(/\/island-of-ireland\/iarnrod-eireann\/trains\/A101\/2026-09-17$/);
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
