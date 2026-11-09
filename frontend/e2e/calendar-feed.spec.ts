import { test, expect, request as playwrightRequest, type BrowserContext, type Page } from '@playwright/test';

// The opt-in calendar feed (app/account/preferences/CalendarFeedSection.tsx,
// ds-api's docs/calendar-feed.md) and a journey's "Download calendar file" button.
// Needs the api started with CALENDAR_FEED_ENABLED=true, as CI's frontend-e2e
// job does; without it the section is simply not offered and these skip.
//
// `E2E_SESSION_COOKIE` is the raw `distant_signal_session` value the seed's
// session backs (see e2e/nav.spec.ts's own comment); `E2E_JOURNEY_ID` is that
// user's journey.
const SESSION_COOKIE = process.env.E2E_SESSION_COOKIE;
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const JOURNEY_ID = process.env.E2E_JOURNEY_ID ?? '1';

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

/** Whether the api has the feature on (`calendarFeedEnabled` in the session
 * read), so a run against an api without it skips rather than fails. */
async function feedEnabled(page: Page): Promise<boolean> {
  const session = (await (await page.request.get('/api/auth/session')).json()) as { calendarFeedEnabled?: boolean };
  return session.calendarFeedEnabled === true;
}

test.describe('Calendar feed', () => {
  // One account, one link: the tests turn it on and off in turn.
  test.describe.configure({ mode: 'serial' });
  test.skip(!SESSION_COOKIE, 'set E2E_SESSION_COOKIE to a raw distant_signal_session value');

  test.beforeEach(async ({ context }) => {
    await logIn(context);
    // Start from "off", whatever an earlier run left.
    await context.request.delete('/api/account/calendar-feed', { headers: { Origin: new URL(BASE_URL).origin } });
  });

  test('turns on, shows the link once, serves a calendar to a client with no cookie, and turns off', async ({
    page,
  }) => {
    test.skip(!(await feedEnabled(page)), 'the api has the calendar feed off');
    await page.goto('/account/preferences');
    const section = page.getByRole('region', { name: 'Calendar feed' });
    await expect(section.getByText(/Anyone who has the link can see your journeys/)).toBeVisible();

    await section.getByRole('button', { name: 'Turn on calendar feed' }).click();
    const field = section.getByRole('textbox', { name: 'Calendar feed link' });
    await expect(field).toBeVisible();
    const link = await field.inputValue();
    expect(new URL(link).pathname).toMatch(/^\/api\/calendar\/[\w-]+\.ics$/);

    // A calendar app sends no cookie.
    const anonymous = await playwrightRequest.newContext({ baseURL: BASE_URL });
    const feed = await anonymous.get(new URL(link).pathname);
    expect(feed.status()).toBe(200);
    expect(feed.headers()['content-type']).toContain('text/calendar');
    const text = (await feed.text()).replace(/\r\n /g, '');
    expect(text).toContain('BEGIN:VCALENDAR');
    expect(text).toContain('powered by NationalRail');
    expect(text).not.toContain('distant_signal_session');

    await section.getByRole('button', { name: 'Turn off calendar feed' }).click();
    await expect(section.getByText('Turned off. The link no longer works.')).toBeVisible();
    expect((await anonymous.get(new URL(link).pathname)).status()).toBe(404);
    await anonymous.dispose();
  });

  test('making a new link stops the old one', async ({ page }) => {
    test.skip(!(await feedEnabled(page)), 'the api has the calendar feed off');
    await page.goto('/account/preferences');
    const section = page.getByRole('region', { name: 'Calendar feed' });
    await section.getByRole('button', { name: 'Turn on calendar feed' }).click();
    const first = new URL(await section.getByRole('textbox', { name: 'Calendar feed link' }).inputValue()).pathname;
    await section.getByRole('button', { name: 'Make a new link' }).click();
    await expect(async () => {
      const next = new URL(await section.getByRole('textbox', { name: 'Calendar feed link' }).inputValue()).pathname;
      expect(next).not.toBe(first);
    }).toPass();
    const anonymous = await playwrightRequest.newContext({ baseURL: BASE_URL });
    expect((await anonymous.get(first)).status()).toBe(404);
    await anonymous.dispose();
  });

  test('a journey downloads as a calendar file', async ({ page }) => {
    test.skip(!(await feedEnabled(page)), 'the api has the calendar feed off');
    await page.goto(`/journeys/${JOURNEY_ID}`);
    const add = page.getByRole('button', { name: 'Download calendar file' });
    await expect(add).toBeVisible();
    const [download] = await Promise.all([page.waitForEvent('download'), add.click()]);
    expect(download.suggestedFilename()).toBe(`journey-${JOURNEY_ID}.ics`);
    const response = await page.request.get(`/api/Journeys/${JOURNEY_ID}/calendar.ics`);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('text/calendar');
    expect(response.headers()['content-disposition']).toContain('attachment');
    expect(await response.text()).toContain('BEGIN:VEVENT');
  });
});
