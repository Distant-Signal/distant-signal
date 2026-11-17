import { test, expect } from '@playwright/test';
import { asUser, CLOSED_JOURNEY, firstLegId, logInAs, MISS_SESSION_COOKIE, MISSED_JOURNEY } from './missFixtures';

// "I missed this train" after the train has run (the missed-train redesign,
// DS-534), against the seed's `fixture-miss` journeys (seed.sql, "The
// missed-train flow"): 900401's one leg left 20 minutes before the seeding
// and arrived 5 minutes before it, so it is finished and inside its miss
// window, and E2EMS2 and E2EMS3 leave its boarding station hours later;
// 900402's window has closed. Nothing here takes a train, so the journey
// stays as seeded (the take and undo flow is journey-mid-change.spec.ts).

test.describe('missed train, after the train has run', () => {
  test.beforeEach(async ({ context }) => {
    await logInAs(context, MISS_SESSION_COOKIE);
  });

  test('a finished leg offers "I missed this one", asks once, then lists other trains', async ({ page }) => {
    await page.goto(`/journeys/${MISSED_JOURNEY}`);
    const main = page.locator('#main-content');
    await main.getByRole('button', { name: 'I missed this one' }).click();

    // The api's facts say the train reached its destination: ask once.
    const sheet = page.getByRole('dialog');
    await expect(sheet.getByText('This train has already reached its destination.')).toBeVisible();
    await expect(sheet.getByText("Only use this if you didn't get on it.")).toBeVisible();
    await expect(sheet.getByRole('button', { name: 'Take this one' })).toHaveCount(0);

    await sheet.getByRole('button', { name: "I didn't get on it" }).click();
    await expect(sheet.getByText('Searching from ZXA')).toBeVisible();
    await expect(sheet.getByRole('button', { name: "I'm somewhere else" })).toBeVisible();
    // The seeded trains, hours ahead: the planner finds them.
    await expect(sheet.getByRole('button', { name: 'Take this one' }).first()).toBeVisible();
    await expect(sheet.getByText(/Your booked plan stays saved under Earlier plans\./)).toBeVisible();
  });

  test('"Cancel" on the soft confirm closes the sheet and changes nothing', async ({ page }) => {
    await page.goto(`/journeys/${MISSED_JOURNEY}`);
    await page.locator('#main-content').getByRole('button', { name: 'I missed this one' }).click();
    const sheet = page.getByRole('dialog');
    await expect(sheet.getByText('This train has already reached its destination.')).toBeVisible();
    await sheet.getByRole('button', { name: 'Cancel' }).click();
    await expect(sheet).toBeHidden();
    await expect(page.locator('#main-content').getByRole('button', { name: 'I missed this one' })).toBeVisible();
  });

  test('"I\'m somewhere else" opens the station chooser, and an unknown station is refused in words', async ({
    page,
  }) => {
    await page.goto(`/journeys/${MISSED_JOURNEY}`);
    await page.locator('#main-content').getByRole('button', { name: 'I missed this one' }).click();
    const sheet = page.getByRole('dialog');
    await sheet.getByRole('button', { name: "I didn't get on it" }).click();
    await sheet.getByRole('button', { name: "I'm somewhere else" }).click();

    const field = sheet.getByRole('combobox', { name: "Station you're at" });
    await expect(field).toBeVisible();
    await field.fill('ZZZ');
    await sheet.getByRole('button', { name: 'Search from here' }).click();
    await expect(sheet.getByRole('alert')).toContainText("We don't recognise that station.");
    // Still searching from the boarding station.
    await expect(sheet.getByText('Searching from ZXA')).toBeVisible();

    await sheet.getByRole('button', { name: 'Cancel' }).click();
    await expect(field).toBeHidden();
    await expect(sheet.getByRole('button', { name: "I'm somewhere else" })).toBeVisible();
  });

  test('a closed window shows no button, and the api refuses it through the proxy as written', async ({
    page,
    request,
  }) => {
    await page.goto(`/journeys/${CLOSED_JOURNEY}`);
    await expect(page.locator('#main-content').getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: /I missed this/ })).toHaveCount(0);

    const leg = await firstLegId(request, CLOSED_JOURNEY);
    const refused = await request.get(`/api/Journeys/${CLOSED_JOURNEY}/legs/${leg}/alternatives?cause=missed`, {
      headers: asUser(MISS_SESSION_COOKIE),
    });
    expect(refused.status()).toBe(409);
    expect(await refused.text()).toBe("It's too late to change this journey.");
  });

  test('"Choose another train" on a train that has arrived is refused as "already travelled"', async ({ request }) => {
    const leg = await firstLegId(request, MISSED_JOURNEY);
    const refused = await request.get(`/api/Journeys/${MISSED_JOURNEY}/legs/${leg}/alternatives?cause=choice`, {
      headers: asUser(MISS_SESSION_COOKIE),
    });
    expect(refused.status()).toBe(409);
    expect(await refused.text()).toBe('This leg is already travelled.');
  });

  test('the sheet words a window that closes while it is open, with a way on', async ({ page }) => {
    // The window can't close on cue against a live clock: answer the load as
    // the api does once it has, and check what the person is told.
    await page.route('**/api/Journeys/*/legs/*/alternatives?*', (route) =>
      route.fulfill({
        status: 409,
        contentType: 'text/plain; charset=utf-8',
        body: "It's too late to change this journey.",
      }),
    );
    await page.goto(`/journeys/${MISSED_JOURNEY}`);
    await page.locator('#main-content').getByRole('button', { name: 'I missed this one' }).click();
    const sheet = page.getByRole('dialog');
    await expect(sheet.getByText("It's too late to change this journey.")).toBeVisible();
    await expect(sheet.getByRole('link', { name: 'Plan a journey' })).toHaveAttribute('href', '/plan');
    await expect(sheet.getByText("Couldn't load other trains.")).toHaveCount(0);
  });
});
