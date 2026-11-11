import { test, expect, type BrowserContext, type Page } from '@playwright/test';

// Recently deleted journeys (app/journeys/recently-deleted, ds-api's
// routes::recently_deleted). Needs an api with RECENTLY_DELETED_ENABLED=true,
// as CI's frontend-e2e job sets; an api without the feature (or with it off)
// reports `recentlyDeletedEnabled` false, and these skip.
//
// Each test saves its own journey on the seed's train (E2E_TRAIN_UID on
// E2E_TRAIN_DATE, which the seed user already tracks, so its tracking is
// shared, not new), deletes it, and leaves nothing behind.
const SESSION_COOKIE = process.env.E2E_SESSION_COOKIE;
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const TRAIN_UID = process.env.E2E_TRAIN_UID ?? 'W12345';
const TRAIN_DATE = process.env.E2E_TRAIN_DATE ?? '2026-09-17';
const ORIGIN = { Origin: new URL(BASE_URL).origin };

async function logIn(context: BrowserContext): Promise<void> {
  const base = new URL(BASE_URL);
  await context.addCookies([
    {
      name: 'distant_signal_session',
      value: SESSION_COOKIE!,
      domain: base.hostname,
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
      expires: -1,
    },
  ]);
}

async function featureOn(page: Page): Promise<boolean> {
  const session = (await (await page.request.get('/api/auth/session')).json()) as { recentlyDeletedEnabled?: boolean };
  return session.recentlyDeletedEnabled === true;
}

/** Saves a one-train journey named `name` and deletes it; returns nothing. */
async function saveAndDelete(context: BrowserContext, name: string): Promise<void> {
  const saved = await context.request.post('/api/Journeys/itinerary', {
    headers: ORIGIN,
    data: { customName: name, legs: [{ trainUid: TRAIN_UID, serviceDate: TRAIN_DATE }] },
  });
  expect(saved.ok()).toBe(true);
  const { journeyId } = (await saved.json()) as { journeyId: number };
  const deleted = await context.request.delete(`/api/Journeys/${journeyId}`, { headers: ORIGIN });
  expect(deleted.status()).toBe(204);
}

test.describe('Recently deleted', () => {
  // One account, one list: the tests take turns.
  test.describe.configure({ mode: 'serial' });
  test.skip(!SESSION_COOKIE, 'set E2E_SESSION_COOKIE to a raw distant_signal_session value');

  test.beforeEach(async ({ context }) => {
    await logIn(context);
    await context.request.delete('/api/Journeys/recently-deleted', { headers: ORIGIN });
  });

  test.afterEach(async ({ context }) => {
    await context.request.delete('/api/Journeys/recently-deleted', { headers: ORIGIN });
  });

  test('is reached from Journeys, and saves a deleted journey again', async ({ page, context }) => {
    test.skip(!(await featureOn(page)), 'the api has Recently deleted off');
    await saveAndDelete(context, 'E2E recently deleted');

    await page.goto('/journeys');
    await page.getByRole('link', { name: 'Recently deleted' }).click();
    await expect(page).toHaveURL(/\/journeys\/recently-deleted$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Recently deleted' })).toBeVisible();
    const card = page.getByRole('article', { name: 'E2E recently deleted' });
    await expect(card.getByText(/^Deleted just now\./)).toBeVisible();

    await card.getByRole('button', { name: 'Save again' }).click();
    const saved = page.getByRole('status').filter({ hasText: 'Saved E2E recently deleted again.' });
    await expect(saved).toBeVisible();
    await expect(page.getByRole('article', { name: 'E2E recently deleted' })).toHaveCount(0);
    await saved.getByRole('link', { name: 'Open the journey' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'E2E recently deleted' })).toBeVisible();

    // Clean up: delete the saved journey, then empty the list (afterEach).
    const journeyId = new URL(page.url()).pathname.split('/').pop();
    await context.request.delete(`/api/Journeys/${journeyId}`, { headers: ORIGIN });
  });

  test('deletes one permanently and empties the list', async ({ page, context }) => {
    test.skip(!(await featureOn(page)), 'the api has Recently deleted off');
    await saveAndDelete(context, 'E2E deleted first');
    await saveAndDelete(context, 'E2E deleted second');

    await page.goto('/journeys/recently-deleted');
    const first = page.getByRole('article', { name: 'E2E deleted first' });
    const confirm = page.getByRole('button', { name: 'Confirm delete permanently E2E deleted first' });
    // Retried: a click before the page hydrates opens no dialog.
    await expect(async () => {
      await first.getByRole('button', { name: 'Delete permanently' }).click();
      await expect(confirm).toBeVisible({ timeout: 1000 });
    }).toPass();
    await confirm.click();
    await expect(first).toHaveCount(0);
    await expect(page.getByRole('article', { name: 'E2E deleted second' })).toBeVisible();

    await page.getByRole('button', { name: 'Empty now' }).click();
    await page.getByRole('button', { name: 'Confirm empty now' }).click();
    await expect(page.getByText(/^Nothing deleted in the last \d+ days\./)).toBeVisible();
  });
});
