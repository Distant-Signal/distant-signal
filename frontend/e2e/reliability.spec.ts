import { test, expect } from '@playwright/test';

// Reliability and Delay Repay on journey legs (2026-11-06), against the
// seeded backend: fixture-owner's two-revision journey 900301 (seed.sql),
// whose booked W93001 was cancelled and replaced by W93002, 12 minutes
// late. The pages are server-rendered from the api, so nothing here is
// stood in for with `page.route`. The ticket test removes what it saves,
// so the other specs see the journey as seeded.

const SESSION_COOKIE = process.env.E2E_SESSION_COOKIE;
const JOURNEY_ID = '900301';

test.describe('reliability from journey legs', () => {
  test.skip(!SESSION_COOKIE, 'E2E_SESSION_COOKIE is unset');

  test.beforeEach(async ({ context }) => {
    const base = new URL(process.env.E2E_BASE_URL ?? 'http://localhost:3000');
    await context.addCookies([
      {
        name: 'distant_signal_session',
        value: SESSION_COOKIE!,
        domain: base.hostname,
        path: '/',
        expires: -1,
        httpOnly: true,
        secure: base.protocol === 'https:',
        sameSite: 'Lax',
      },
    ]);
  });

  test('counts the replaced booked train as a cancellation, and Delay Repay against the booked arrival', async ({
    page,
  }) => {
    const response = await page.request.get('/api/Journeys/reliability');
    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      trains: { journeyId: number; trainUid: string | null; cancelled: boolean; replacedBecause: string | null }[];
      journeys: { journeyId: number; delayMinutes: number | null; againstBookedPlan: boolean }[];
    };
    const trains = body.trains.filter((t) => t.journeyId === Number(JOURNEY_ID));
    expect(trains).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ trainUid: 'W93001', cancelled: true, replacedBecause: 'cancelled' }),
        expect.objectContaining({ trainUid: 'W93002', cancelled: false }),
      ]),
    );
    expect(body.journeys.find((j) => j.journeyId === Number(JOURNEY_ID))).toMatchObject({
      delayMinutes: 42,
      againstBookedPlan: true,
    });

    await page.goto('/journeys');
    const digest = page.locator('.mantine-Card-root').filter({ hasText: 'Your reliability' });
    await expect(digest.getByText(/booked train the railway replaced/)).toBeVisible();
    await expect(digest.getByText('42 minutes late against the train you booked')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Add a ticket' })).toHaveCount(0);
  });

  test("shows the leg's Delay Repay with no ticket, and saves and removes ticket details", async ({ page }) => {
    await page.goto(`/journeys/${JOURNEY_ID}`);
    // The leg's own delay, from its recorded outcome (the journey's 42
    // minutes against the booked train is the rollup's, above).
    await expect(page.getByText('12 minutes late', { exact: true })).toBeVisible();
    await page.getByText('Delay Repay', { exact: true }).click();
    await expect(page.getByRole('link', { name: /See how to claim from the operator/ })).toHaveAttribute(
      'href',
      /lner/,
    );
    await expect(page.getByText('No ticket details. None needed for Delay Repay.')).toBeVisible();
    try {
      await page.getByRole('button', { name: 'Add ticket details' }).click();
      await page.getByRole('combobox', { name: 'Ticket type' }).click();
      await page.getByRole('option', { name: 'Return' }).click();
      await page.getByRole('button', { name: 'Save' }).click();
      await expect(page.getByText('Ticket: Return')).toBeVisible();
    } finally {
      await page.request.delete(`/api/Journeys/${JOURNEY_ID}/legs/${await legId(page)}/ticket`);
    }
    await page.reload();
    await expect(page.getByText('No ticket details. None needed for Delay Repay.')).toBeVisible();
  });

  test('the retired ticket page sends you to Journeys', async ({ page }) => {
    await page.goto('/track/mine/add-ticket');
    await expect(page).toHaveURL(/\/journeys$/);
  });
});

async function legId(page: import('@playwright/test').Page): Promise<number> {
  const response = await page.request.get(`/api/Journeys/${JOURNEY_ID}`);
  const journey = (await response.json()) as { legs: { id: number }[] };
  return journey.legs[0]!.id;
}
