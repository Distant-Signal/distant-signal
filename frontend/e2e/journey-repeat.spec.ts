import { test, expect, type APIRequestContext, type BrowserContext } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// "Track this journey again" and "Move this journey": the whole route
// planned again, the same trains preferred, shown before saving. Runs
// against the seeded e2e stack, logged in as the seed's owner, on journeys
// it makes for itself on the repeat fixture (seed.sql: E2ERP1 00:05 ZRA to
// ZRB, E2ERP2 00:45 ZRB to ZRC, and the 01:05 and 01:45 after them, on
// London's tomorrow and the day after).

const SESSION_COOKIE = process.env.E2E_SESSION_COOKIE;

function londonDate(offsetDays: number): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(
    new Date(Date.now() + offsetDays * 24 * 3600 * 1000),
  );
}

async function logIn(context: BrowserContext, base: URL) {
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

/** The two-leg journey on `date`: E2ERP1 then E2ERP2. */
async function saveJourney(request: APIRequestContext, base: URL, name: string, date: string): Promise<number> {
  const created = await request.post('/api/Journeys/itinerary', {
    headers: {
      cookie: `distant_signal_session=${SESSION_COOKIE}`,
      origin: base.origin,
      'content-type': 'application/json',
    },
    data: {
      customName: name,
      legs: [
        { trainUid: 'E2ERP1', serviceDate: date, originCrs: 'ZRA', destinationCrs: 'ZRB' },
        { trainUid: 'E2ERP2', serviceDate: date, originCrs: 'ZRB', destinationCrs: 'ZRC' },
      ],
    },
  });
  expect(created.ok(), await created.text()).toBe(true);
  return ((await created.json()) as { journeyId: number }).journeyId;
}

async function deleteJourney(request: APIRequestContext, base: URL, id: number) {
  await request.delete(`/api/Journeys/${id}`, {
    headers: { cookie: `distant_signal_session=${SESSION_COOKIE}`, origin: base.origin },
  });
}

test.describe('track again and move', () => {
  test.skip(!SESSION_COOKIE, 'set E2E_SESSION_COOKIE to the seed session');

  test('repeats a two-leg journey with the same trains', async ({ page, context, request }) => {
    const base = new URL(process.env.E2E_BASE_URL ?? 'http://localhost:3000');
    await logIn(context, base);
    const journeyId = await saveJourney(request, base, 'E2E repeat', londonDate(1));
    let repeatedId: number | null = null;
    try {
      await page.goto(`/journeys/${journeyId}`);
      await page.locator('#main-content').getByRole('button', { name: 'Track this journey again' }).click();

      const dialog = page.getByRole('dialog', { name: 'Track this journey again' });
      await expect(dialog.getByText('The same trains as before.')).toBeVisible();
      await expect(dialog.getByLabel('Time')).toHaveValue('00:05');
      const track = dialog.getByRole('button', { name: /^Track this journey, the 00:05 / });
      await expect(track).toBeVisible();
      const results = await new AxeBuilder({ page }).include('[role="dialog"]').analyze();
      expect(results.violations).toEqual([]);

      await track.click();
      await page.waitForURL(
        (url) => /^\/journeys\/\d+$/.test(url.pathname) && url.pathname !== `/journeys/${journeyId}`,
      );
      repeatedId = Number(new URL(page.url()).pathname.split('/').pop());
      // Both legs, the same trains, under the journey's own name.
      await expect(page.getByRole('heading', { level: 1, name: 'E2E repeat' })).toBeVisible();
      const legs = await request.get(`/api/Journeys/${repeatedId}`, {
        headers: { cookie: `distant_signal_session=${SESSION_COOKIE}` },
      });
      const detail = (await legs.json()) as { legs: { trackedTrainState: { trainUid: string } | null }[] };
      expect(detail.legs.map((leg) => leg.trackedTrainState?.trainUid)).toEqual(['E2ERP1', 'E2ERP2']);
    } finally {
      await deleteJourney(request, base, journeyId);
      if (repeatedId !== null) await deleteJourney(request, base, repeatedId);
    }
  });

  test('moves a journey to a later time', async ({ page, context, request }) => {
    const base = new URL(process.env.E2E_BASE_URL ?? 'http://localhost:3000');
    await logIn(context, base);
    const journeyId = await saveJourney(request, base, 'E2E move', londonDate(2));
    try {
      await page.goto(`/journeys/${journeyId}`);
      await page.locator('#main-content').getByRole('button', { name: 'Move this journey' }).click();

      const dialog = page.getByRole('dialog', { name: 'Move this journey' });
      await expect(dialog.getByText('The same trains as before.')).toBeVisible();
      await dialog.getByLabel('Time').fill('01:05');
      await dialog.getByRole('button', { name: 'Find trains' }).click();
      await expect(dialog.getByText('The same operator, close to your time.')).toBeVisible();
      const results = await new AxeBuilder({ page }).include('[role="dialog"]').analyze();
      expect(results.violations).toEqual([]);

      await dialog.getByRole('button', { name: /^Move to these trains, the 01:05 / }).click();
      await expect(dialog).toBeHidden();

      const moved = await request.get(`/api/Journeys/${journeyId}`, {
        headers: { cookie: `distant_signal_session=${SESSION_COOKIE}` },
      });
      const detail = (await moved.json()) as {
        customName: string | null;
        legs: { serviceDate: string; trackedTrainState: { trainUid: string } | null }[];
      };
      expect(detail.customName).toBe('E2E move');
      expect(detail.legs.map((leg) => leg.trackedTrainState?.trainUid)).toEqual(['E2ERP3', 'E2ERP4']);
      expect(detail.legs.every((leg) => leg.serviceDate === londonDate(2))).toBe(true);
    } finally {
      await deleteJourney(request, base, journeyId);
    }
  });
});
