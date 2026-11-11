import { test, expect, type APIRequestContext, type BrowserContext } from '@playwright/test';

// Deleting a journey waits 10 seconds before the DELETE is sent, so it can
// be undone (components/PendingDeleteToasts.tsx, lib/pendingDeletes.ts).
// Each test makes its own throwaway journey through the api (one walk, which
// needs no timetable), deletes it through the page and checks what the api
// still holds. Runs against the seeded e2e stack, logged in as the seed's
// owner.

const SESSION_COOKIE = process.env.E2E_SESSION_COOKIE;
const HEADERS = { cookie: `distant_signal_session=${SESSION_COOKIE}` };

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

const fromNow = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();

async function createJourney(request: APIRequestContext, name: string): Promise<number> {
  const created = await request.post('/api/Journeys', {
    headers: HEADERS,
    data: {
      customName: name,
      leg: {
        mode: 'untracked',
        transitMode: 'walk',
        originName: 'Islington',
        destinationName: 'Angel',
        plannedDeparture: fromNow(60 * 24 * 7),
        plannedArrival: fromNow(60 * 24 * 7 + 20),
      },
    },
  });
  expect(created.ok(), await created.text()).toBe(true);
  return ((await created.json()) as { journeyId: number }).journeyId;
}

const status = async (request: APIRequestContext, id: number) =>
  (await request.get(`/api/Journeys/${id}`, { headers: HEADERS })).status();

async function confirmDelete(page: import('@playwright/test').Page, id: number) {
  await page.goto(`/journeys/${id}`);
  await page.getByRole('button', { name: 'Delete journey', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('You can undo for a few seconds');
  await page.getByRole('button', { name: 'Confirm delete journey' }).click();
  await expect(page).toHaveURL(/\/journeys$/);
  await expect(page.getByRole('status', { name: 'Notifications' })).toContainText('Journey deleted');
}

test.describe('undoing a journey delete (logged in)', () => {
  test.skip(!SESSION_COOKIE, 'set E2E_SESSION_COOKIE to the seed session');

  let journeyId: number | null = null;

  test.beforeEach(async ({ context }) => {
    await logIn(context);
  });

  test.afterEach(async ({ request }) => {
    if (journeyId === null) return;
    await request.delete(`/api/Journeys/${journeyId}`, { headers: HEADERS });
    journeyId = null;
  });

  test('Undo keeps the journey: nothing is sent, and it stays after the window', async ({ page, request }) => {
    const name = 'E2E undo me';
    journeyId = await createJourney(request, name);
    await confirmDelete(page, journeyId);
    await expect(page.getByRole('link', { name })).toHaveCount(0);
    expect(await status(request, journeyId)).toBe(200);

    await page.getByRole('button', { name: 'Undo: Journey deleted' }).click();
    await expect(page.getByRole('link', { name })).toBeVisible();
    await page.waitForTimeout(11_000);
    expect(await status(request, journeyId)).toBe(200);
  });

  test('without Undo the DELETE is sent once the window has passed', async ({ page, request }) => {
    journeyId = await createJourney(request, 'E2E let it go');
    await confirmDelete(page, journeyId);
    expect(await status(request, journeyId)).toBe(200);
    await expect.poll(() => status(request, journeyId as number), { timeout: 20_000 }).toBe(404);
    await expect(page.getByText('Journey deleted')).toHaveCount(0);
  });

  test('leaving the page sends the DELETE at once', async ({ page, request }) => {
    journeyId = await createJourney(request, 'E2E leave the page');
    await confirmDelete(page, journeyId);
    // A full navigation fires pagehide, well inside the 10 seconds.
    await page.goto('/privacy');
    await expect.poll(() => status(request, journeyId as number), { timeout: 5_000 }).toBe(404);
  });
});
