import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import type { JourneyTemplateListItem, TripPlanResponse } from '../lib/types';
import { ITINERARY_DEFAULTS, SEGMENT_DEFAULTS, TRIP_PLAN_DEFAULTS, plannedTrainLeg } from '../test/apiDefaults';

// Regular journeys (docs/superpowers/specs/2026-11-06-regular-journeys-design.md
// §4.4): the old /journeys/templates pages redirect, a regular journey is
// made from Plan a journey, and "Skip next" skips (and undoes) a date.
//
// Drives the real app and api, logged in as the seed's fixture-owner (see
// e2e/nav.spec.ts's comment on `E2E_SESSION_COOKIE`). Each test makes its
// own regular journeys and deletes them again; the seed's pair (900201 and
// 900202) is the visual spec's and is left alone. The plan request is
// answered here (`/Trips/plan` is rate limited, and plan.spec.ts spends
// that budget on real plans).

const SESSION_COOKIE = process.env.E2E_SESSION_COOKIE;
const SEEDED = new Set([900201, 900202]);

async function logIn(context: BrowserContext): Promise<void> {
  const base = new URL(process.env.E2E_BASE_URL ?? 'http://localhost:3000');
  await context.addCookies([
    {
      name: 'distant_signal_session',
      value: SESSION_COOKIE!,
      domain: base.hostname,
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    },
  ]);
}

/** Deletes every regular journey of the seed user's that this spec made. */
async function deleteOwn(page: Page, keep: ReadonlySet<number> = SEEDED): Promise<void> {
  const mine = await page.request.get('/api/JourneyTemplates/mine');
  if (!mine.ok()) return;
  for (const template of (await mine.json()) as JourneyTemplateListItem[]) {
    if (!keep.has(template.id) && template.target !== null) {
      await page.request.delete(`/api/JourneyTemplates/${template.id}`);
    }
  }
}

const KGX_EUS_PLAN: TripPlanResponse = {
  ...TRIP_PLAN_DEFAULTS,
  results: 'options',
  segments: [
    {
      ...SEGMENT_DEFAULTS,
      originCrs: 'KGX',
      destinationCrs: 'EUS',
      itineraries: [
        {
          ...ITINERARY_DEFAULTS,
          changeCount: 0,
          totalDurationMinutes: 25,
          legs: [
            plannedTrainLeg({
              trainUid: 'W90301',
              serviceDate: '2026-09-17',
              originCrs: 'KGX',
              destinationCrs: 'EUS',
              scheduledDeparture: '08:10:00',
              scheduledArrival: '08:35:00',
            }),
          ],
        },
      ],
    },
  ],
};

/** `/Trips/plan?results=fastest&count=5`'s answer for KGX to EUS: a train
 * every 15 minutes from `first` (minutes after midnight), in departure
 * order. */
function kgxEusTrains(date: string, first: number): TripPlanResponse {
  const clock = (minutes: number) =>
    `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  const rows = [0, 15, 30, 45, 60].map((offset) => first + offset);
  return {
    ...TRIP_PLAN_DEFAULTS,
    results: 'fastest',
    count: 5,
    segments: [
      {
        ...SEGMENT_DEFAULTS,
        originCrs: 'KGX',
        destinationCrs: 'EUS',
        itineraries: rows.map((departs) => ({
          ...ITINERARY_DEFAULTS,
          changeCount: 0,
          totalDurationMinutes: 25,
          legs: [
            plannedTrainLeg({
              trainUid: `W9${clock(departs).replace(':', '')}`,
              serviceDate: date,
              originCrs: 'KGX',
              destinationCrs: 'EUS',
              scheduledDeparture: `${clock(departs)}:00`,
              scheduledArrival: `${clock(departs + 25)}:00`,
            }),
          ],
        })),
      },
    ],
    journeys: rows.map((departs) => ({
      changeCount: 0,
      accessChangeCount: 0,
      departure: { time: `${clock(departs)}:00`, dayOffset: 0 },
      arrival: { time: `${clock(departs + 25)}:00`, dayOffset: 0 },
      totalDurationMinutes: 25,
    })),
  };
}

test.describe('the old journey templates pages', () => {
  test('redirect to Regular journeys for good', async ({ request }) => {
    for (const [path, expected] of [
      ['/journeys/templates', '/journeys/regular'],
      ['/journeys/templates/12', '/journeys/regular/12'],
    ]) {
      const response = await request.get(path!, { maxRedirects: 0 });
      expect(response.status(), path).toBe(308);
      expect(new URL(response.headers().location!, 'http://x').pathname, path).toBe(expected);
    }
  });
});

test.describe('regular journeys', () => {
  test.skip(!SESSION_COOKIE, 'set E2E_SESSION_COOKIE to a raw distant_signal_session value');
  // One at a time: each test's clean-up deletes the regular journeys the
  // seed user has made, so a test running beside another would delete
  // that one's mid-test.
  test.describe.configure({ mode: 'serial' });

  test('makes a regular journey from Plan a journey', async ({ page, context }) => {
    await logIn(context);
    await page.route('**/api/Trips/plan?*', async (route) => {
      await route.fulfill({ json: KGX_EUS_PLAN });
    });
    // As for someone who hasn't chosen whose bank holidays to skip (the
    // seed's user has: England and Wales), so the form asks once, inline.
    await page.route('**/api/preferences', async (route) => {
      const response = await route.fetch();
      await route.fulfill({ response, json: { ...(await response.json()), bankHolidayDivision: null } });
    });
    const divisionSaved = page.waitForRequest(
      (request) => request.method() === 'PUT' && request.url().endsWith('/api/preferences/bank-holiday-division'),
    );
    try {
      // The date picker's first day is today: keep the query's date in range.
      await page.clock.setFixedTime(new Date('2026-09-17T06:00:00Z'));
      await page.goto('/plan?origin=KGX&destination=EUS&date=2026-09-17&departAfter=08:00');
      await page.getByRole('button', { name: 'Find routes' }).click();
      // The card's stretched label covers its radio (a clickable card).
      const option = page.getByRole('radio', { name: /^08:10 / });
      await expect(option).toBeAttached();
      await option.check({ force: true });
      await page.getByRole('button', { name: 'Make this a regular journey' }).click();

      await expect(page).toHaveURL(/\/journeys\/regular\/new$/);
      await expect(page.getByRole('heading', { level: 1, name: 'New regular journey' })).toBeVisible();
      await expect(page.getByText('Your usual train: 08:10 London Kings Cross to London Euston')).toBeVisible();
      await expect(page.getByRole('switch', { name: 'Skip bank holidays' })).toBeChecked();
      await expect(page.getByRole('combobox', { name: /Whose bank holidays/ })).toHaveValue('England and Wales');
      const axe = await new AxeBuilder({ page }).include('main').analyze();
      expect(axe.violations).toEqual([]);

      await page.getByRole('button', { name: 'Save regular journey' }).click();
      // The answer is saved to Preferences (the seed's own choice again).
      expect((await divisionSaved).postDataJSON()).toEqual({ division: 'england-and-wales' });
      await expect(page).toHaveURL(/\/journeys\/regular$/);
      await expect(
        page.getByRole('link', { name: 'London Kings Cross to London Euston, leave after 08:00' }),
      ).toBeVisible();
    } finally {
      await deleteOwn(page);
    }
  });

  test('skips the next date with its return journey, and undoes it', async ({ page, context }) => {
    await logIn(context);
    const leg = (trainUid: string, originCrs: string, destinationCrs: string, departs: string) => ({
      trainUid,
      originCrs,
      destinationCrs,
      departs,
    });
    const created = await page.request.post('/api/JourneyTemplates', {
      data: {
        mode: 'plan',
        originCrs: 'KGX',
        destinationCrs: 'EUS',
        target: { kind: 'depart_after', time: '07:15', dayOffset: 0 },
        usualItinerary: { legs: [leg('W90401', 'KGX', 'EUS', '07:20')] },
        daysOfWeek: 127,
        return: {
          target: { kind: 'depart_after', time: '18:00', dayOffset: 0 },
          usualItinerary: { legs: [leg('W90402', 'EUS', 'KGX', '18:05')] },
        },
      },
    });
    expect(created.ok(), await created.text()).toBe(true);
    const { templateId, returnTemplateId } = (await created.json()) as {
      templateId: number;
      returnTemplateId: number;
    };

    try {
      await page.goto('/journeys/regular');
      const card = page.locator('[data-regular-pair]', { hasText: 'leave after 07:15' });
      await expect(
        card.getByRole('link', { name: 'London Euston to London Kings Cross, leave after 18:00' }),
      ).toBeVisible();
      const axe = await new AxeBuilder({ page }).include('main').analyze();
      expect(axe.violations).toEqual([]);

      await card.getByRole('button', { name: 'Skip next' }).click();
      const dialog = page.getByRole('dialog', { name: /^Skip \d{1,2} [A-Z][a-z]{2} \d{4}\?$/ });
      await expect(dialog.getByRole('checkbox', { name: 'Skip the return journey too' })).toBeChecked();
      await dialog.getByRole('button', { name: /^Skip \d/ }).click();
      await expect(card.getByText(/^Skipped \d{1,2} [A-Z][a-z]{2} \d{4}\.$/)).toBeVisible();

      for (const id of [templateId, returnTemplateId]) {
        const detail = await page.request.get(`/api/JourneyTemplates/${id}`);
        expect(((await detail.json()) as { skippedDates: string[] }).skippedDates).toHaveLength(1);
      }

      await card.getByRole('button', { name: 'Undo' }).click();
      await expect(card.getByRole('button', { name: 'Skip next' })).toBeVisible();
      for (const id of [templateId, returnTemplateId]) {
        const detail = await page.request.get(`/api/JourneyTemplates/${id}`);
        expect(((await detail.json()) as { skippedDates: string[] }).skippedDates).toEqual([]);
      }
    } finally {
      await deleteOwn(page);
    }
  });

  test('switches its next dates off and on, skips several at once, and previews dates', async ({ page, context }) => {
    await logIn(context);
    const created = await page.request.post('/api/JourneyTemplates', {
      data: {
        mode: 'plan',
        originCrs: 'KGX',
        destinationCrs: 'EUS',
        target: { kind: 'depart_after', time: '06:45', dayOffset: 0 },
        usualItinerary: {
          legs: [{ trainUid: 'W90501', originCrs: 'KGX', destinationCrs: 'EUS', departs: '06:50' }],
        },
        daysOfWeek: 127,
        skipBankHolidays: false,
      },
    });
    expect(created.ok(), await created.text()).toBe(true);
    const { templateId } = (await created.json()) as { templateId: number };
    const skipped = async () => {
      const detail = await page.request.get(`/api/JourneyTemplates/${templateId}`);
      return ((await detail.json()) as { skippedDates: string[] }).skippedDates;
    };

    try {
      await page.goto(`/journeys/regular/${templateId}`);
      const dates = page.getByRole('group', { name: 'Next dates' });
      // Every day: the next 8 days, each on.
      await expect(dates.getByRole('checkbox')).toHaveCount(8);
      const axe = await new AxeBuilder({ page }).include('main').analyze();
      expect(axe.violations).toEqual([]);

      const second = dates.getByRole('checkbox').nth(1);
      // Mantine's chip hides its input: the label is what a person taps.
      const secondLabel = dates.locator('label').nth(1);
      await expect(second).toBeChecked();
      await secondLabel.click();
      await expect(second).not.toBeChecked();
      await expect(dates.getByText('Skipped')).toBeVisible();
      await expect.poll(skipped).toHaveLength(1);
      await secondLabel.click();
      await expect(second).toBeChecked();
      await expect.poll(skipped).toEqual([]);

      await page.getByRole('button', { name: 'Skip next' }).click();
      const dialog = page.getByRole('dialog');
      await dialog.getByRole('combobox', { name: 'How many dates' }).selectOption('3');
      await expect(dialog).toHaveAccessibleName('Skip 3 dates?');
      await dialog.getByRole('button', { name: 'Skip 3 dates' }).click();
      await expect(page.getByText(/^Skipped 3 dates, from /)).toBeVisible();
      expect(await skipped()).toHaveLength(3);
      await page.getByRole('button', { name: 'Undo' }).click();
      await expect(page.getByRole('button', { name: 'Skip next' })).toBeVisible();
      expect(await skipped()).toEqual([]);

      // The form's preview comes from the same rule.
      await page.goto('/journeys/regular/new');
      await expect(page.getByText(/^Next dates: /)).toBeVisible();
    } finally {
      await deleteOwn(page);
    }
  });

  test('pauses until a date, and time away in Preferences skips every regular journey', async ({ page, context }) => {
    await logIn(context);
    const created = await page.request.post('/api/JourneyTemplates', {
      data: {
        mode: 'plan',
        originCrs: 'KGX',
        destinationCrs: 'EUS',
        target: { kind: 'depart_after', time: '06:30', dayOffset: 0 },
        usualItinerary: {
          legs: [{ trainUid: 'W90701', originCrs: 'KGX', destinationCrs: 'EUS', departs: '06:35' }],
        },
        daysOfWeek: 127,
        skipBankHolidays: false,
      },
    });
    expect(created.ok(), await created.text()).toBe(true);
    const { templateId } = (await created.json()) as { templateId: number };
    const detail = async () =>
      (await (await page.request.get(`/api/JourneyTemplates/${templateId}`)).json()) as {
        pausedUntil: string | null;
        upcomingDates: { date: string; skipReason: string | null }[];
      };
    const awayIds: number[] = [];

    try {
      // Pause until the third upcoming date: the first two show "Paused".
      const { upcomingDates } = await detail();
      const restart = upcomingDates[2]!.date;
      const res = await page.request.put(`/api/JourneyTemplates/${templateId}/paused-until`, {
        data: { pausedUntil: restart },
      });
      expect(res.ok()).toBe(true);
      await page.goto(`/journeys/regular/${templateId}`);
      await expect(page.getByText(/^Paused until \d{1,2} [A-Z][a-z]{2} \d{4}\.$/)).toBeVisible();
      await expect(page.getByRole('group', { name: 'Next dates' }).getByText('Paused')).toHaveCount(2);
      const axe = await new AxeBuilder({ page }).include('main').analyze();
      expect(axe.violations).toEqual([]);
      await page.getByRole('button', { name: 'Start again now' }).click();
      await expect(page.getByRole('button', { name: 'Pause until' })).toBeVisible();
      await expect.poll(async () => (await detail()).pausedUntil).toBeNull();

      // The Pause until dialog passes axe too.
      await page.getByRole('button', { name: 'Pause until' }).click();
      await expect(page.getByRole('dialog', { name: 'Pause until a date?' })).toBeVisible();
      // Once it has faded in: mid-transition, axe reads its colours half-mixed.
      await expect(page.locator('.mantine-Modal-content')).toHaveCSS('opacity', '1');
      const dialogAxe = await new AxeBuilder({ page }).include('[role="dialog"]').analyze();
      expect(dialogAxe.violations).toEqual([]);
      await page.getByRole('button', { name: 'Cancel' }).click();

      // Time away, added in Preferences, skips this regular journey's dates.
      const away = await page.request.post('/api/preferences/time-away', {
        data: { startsOn: upcomingDates[1]!.date, endsOn: upcomingDates[1]!.date, label: 'E2E away' },
      });
      expect(away.ok(), await away.text()).toBe(true);
      awayIds.push(((await away.json()) as { period: { id: number } }).period.id);
      await page.goto('/account/preferences');
      const section = page.getByRole('region', { name: 'Time away' });
      await expect(section.getByText(/^E2E away: /)).toBeVisible();
      // The whole page, with the new card's period and Connected apps on it.
      const prefsAxe = await new AxeBuilder({ page }).analyze();
      expect(prefsAxe.violations).toEqual([]);
      await expect.poll(async () => (await detail()).upcomingDates[1]!.skipReason).toBe('away');

      await section.getByRole('button', { name: /^Delete time away, E2E away/ }).click();
      await expect(section.getByText(/Journeys for those dates are added again as usual\./)).toBeVisible();
      awayIds.length = 0;
      await expect.poll(async () => (await detail()).upcomingDates[1]!.skipReason).toBeNull();
    } finally {
      for (const id of awayIds) await page.request.delete(`/api/preferences/time-away/${id}`);
      await page.request.delete(`/api/JourneyTemplates/${templateId}`);
    }
  });

  test('repeats every other week or on chosen dates, and keeps a later date', async ({ page, context }) => {
    await logIn(context);
    const created = await page.request.post('/api/JourneyTemplates', {
      data: {
        mode: 'plan',
        originCrs: 'KGX',
        destinationCrs: 'EUS',
        target: { kind: 'depart_after', time: '06:15', dayOffset: 0 },
        usualItinerary: {
          legs: [{ trainUid: 'W90901', originCrs: 'KGX', destinationCrs: 'EUS', departs: '06:20' }],
        },
        daysOfWeek: 5,
        intervalWeeks: 2,
        anchorWeek: new Date().toISOString().slice(0, 10),
        skipBankHolidays: false,
      },
    });
    expect(created.ok(), await created.text()).toBe(true);
    const { templateId } = (await created.json()) as { templateId: number };

    try {
      await page.goto('/journeys/regular');
      await expect(page.getByText(/^Mon, Wed, every other week/).first()).toBeVisible();

      // "Add a date" ten days ahead keeps the date for the evening before.
      await page.goto(`/journeys/regular/${templateId}`);
      await page.getByRole('button', { name: 'Add a date' }).click();
      const later = new Date(Date.now() + 10 * 24 * 3600 * 1000);
      const shown = later.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'Europe/London',
      });
      const field = page.getByRole('dialog', { name: 'Add a date' }).getByLabel('Date');
      await field.fill(shown);
      await field.blur();
      await page.getByRole('button', { name: 'Add journey' }).click();
      await expect(page.getByText(/The journey is added the evening before\.$/)).toBeVisible();
      const detail = (await (await page.request.get(`/api/JourneyTemplates/${templateId}`)).json()) as {
        extraDates: string[];
      };
      expect(detail.extraDates).toHaveLength(1);

      // The form: every other week asks which week, a list of dates asks for dates.
      await page.goto('/journeys/regular/new');
      await page.getByRole('combobox', { name: 'Repeats' }).click();
      await page.getByRole('option', { name: 'Every other week' }).click();
      await expect(page.getByRole('radio', { name: 'Starting this week' })).toBeChecked();
      await expect(page.getByText(/^Next dates: /)).toBeVisible();
      const axe = await new AxeBuilder({ page }).include('main').analyze();
      expect(axe.violations).toEqual([]);
      await page.getByRole('combobox', { name: 'Repeats' }).click();
      await page.getByRole('option', { name: 'On dates I choose' }).click();
      await expect(page.getByText('Choose at least one date.')).toBeVisible();
    } finally {
      await page.request.delete(`/api/JourneyTemplates/${templateId}`);
    }
  });

  test('finds five trains to pick the usual one from, and pages later and earlier', async ({ page, context }) => {
    await logIn(context);
    const searches: URL[] = [];
    await page.route('**/api/Trips/plan?*', async (route) => {
      const url = new URL(route.request().url());
      searches.push(url);
      const date = url.searchParams.get('date')!;
      const later = url.searchParams.get('departAfter') === '09:01:00';
      await route.fulfill({ json: kgxEusTrains(date, later ? 9 * 60 + 15 : 8 * 60) });
    });
    await page.goto('/journeys/regular/new');
    await page.getByRole('combobox', { name: 'From' }).fill('KGX');
    await page.getByRole('combobox', { name: 'To' }).fill('EUS');
    await page.getByLabel('Time').first().fill('07:55');
    await page.getByRole('button', { name: 'Find trains' }).click();
    await expect(page.getByText(/Pick the one you usually take\.$/)).toBeVisible();
    expect(searches[0]!.searchParams.get('results')).toBe('fastest');
    expect(searches[0]!.searchParams.get('count')).toBe('5');
    expect(searches[0]!.searchParams.get('direct')).toBe('all');
    expect(searches[0]!.searchParams.get('departAfter')).toBe('07:55:00');
    for (const departs of ['08:00', '08:15', '08:30', '08:45', '09:00']) {
      await expect(page.getByRole('radio', { name: new RegExp(`^${departs} `) })).toBeAttached();
    }
    // The card's stretched label covers its radio (a clickable card).
    await page.getByRole('radio', { name: /^08:15 / }).check({ force: true });
    await expect(page.getByText('Your usual train: 08:15 London Kings Cross to London Euston')).toBeVisible();
    const axe = await new AxeBuilder({ page }).include('main').analyze();
    expect(axe.violations).toEqual([]);

    await page.getByRole('button', { name: 'Later trains' }).click();
    await expect(page.getByRole('radio', { name: /^10:15 / })).toBeAttached();
    expect(searches.at(-1)!.searchParams.get('departAfter')).toBe('09:01:00');
    await page.getByRole('button', { name: 'Earlier trains' }).click();
    await expect(page.getByRole('radio', { name: /^08:15 / })).toBeChecked();
    expect(searches.at(-1)!.searchParams.get('arriveBy')).toBe('09:39:00');
  });

  test('a different time on some days shows on the card and page, and the form offers it', async ({
    page,
    context,
  }) => {
    await logIn(context);
    const created = await page.request.post('/api/JourneyTemplates', {
      data: {
        mode: 'plan',
        originCrs: 'KGX',
        destinationCrs: 'EUS',
        target: { kind: 'depart_after', time: '06:15', dayOffset: 0 },
        usualItinerary: {
          legs: [{ trainUid: 'W90901', originCrs: 'KGX', destinationCrs: 'EUS', departs: '06:20' }],
        },
        daysOfWeek: 31,
        skipBankHolidays: false,
        dayOverrides: [
          {
            weekday: 5,
            target: { kind: 'depart_after', time: '05:15', dayOffset: 0 },
            usualItinerary: {
              legs: [{ trainUid: 'W90902', originCrs: 'KGX', destinationCrs: 'EUS', departs: '05:20' }],
            },
          },
        ],
      },
    });
    expect(created.ok(), await created.text()).toBe(true);
    const { templateId } = (await created.json()) as { templateId: number };

    try {
      await page.goto('/journeys/regular');
      await expect(page.getByText('Fridays: leave after 05:15').first()).toBeVisible();

      await page.goto(`/journeys/regular/${templateId}`);
      await expect(page.getByText(/^Fridays: leave after 05:15\. Your usual train: 05:20 /)).toBeVisible();

      await page.goto('/journeys/regular/new');
      await page.getByRole('switch', { name: /Different time on some days/ }).check();
      await expect(page.getByRole('combobox', { name: 'Day' })).toHaveValue('Fridays');
      await expect(page.getByText('Choose a time first.')).toBeVisible();
      const axe = await new AxeBuilder({ page }).include('main').analyze();
      expect(axe.violations).toEqual([]);
    } finally {
      await page.request.delete(`/api/JourneyTemplates/${templateId}`);
    }
  });

  test('a regular journey page passes axe', async ({ page, context }) => {
    await logIn(context);
    await page.goto('/journeys/regular/900201');
    await expect(
      page.getByRole('heading', { level: 1, name: 'London Kings Cross to London Euston, leave after 09:00' }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'The return journey' })).toHaveAttribute(
      'href',
      '/journeys/regular/900202',
    );
    const axe = await new AxeBuilder({ page }).include('main').analyze();
    expect(axe.violations).toEqual([]);
  });

  test('a Remind-me day looks for trains around the usual one', async ({ page, context }) => {
    await logIn(context);
    const searches: URL[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/legs/') && request.url().includes('/candidates'))
        searches.push(new URL(request.url()));
    });
    await page.goto('/journeys/900203');
    // The leg's own window is the usual 09:00, five minutes either way.
    await expect(page.getByText('Departing between 08:30 and 10:00')).toBeVisible();
    await expect.poll(() => searches.at(-1)?.searchParams.get('departBefore')).toBe('10:00');
    expect(searches.at(-1)!.searchParams.get('departAfter')).toBe('08:30');
    const axe = await new AxeBuilder({ page }).include('main').analyze();
    expect(axe.violations).toEqual([]);
  });

  test("shows the day's suggested train and tracks it", async ({ page, context }) => {
    await logIn(context);
    // Answered here, so the seed's journey keeps its suggestion for the
    // visual spec (the accept replaces its legs for real).
    let accepted: unknown = null;
    await page.route('**/api/Journeys/900203/regular-plan/accept', async (route) => {
      accepted = route.request().postDataJSON();
      await route.fulfill({
        json: { journeyId: 900203, revisionNo: 1, newLegIds: [1], undoRevisionNo: null },
      });
    });
    await page.goto('/journeys/900203');
    const card = page.getByRole('region', { name: 'Your usual train: 09:00 London Kings Cross to London Euston' });
    await expect(card).toBeVisible();
    await expect(card.getByRole('heading', { level: 3, name: 'Other trains' })).toBeVisible();
    await expect(card.getByText('Arrives 11:40, 1 change')).toBeVisible();
    const axe = await new AxeBuilder({ page }).include('main').analyze();
    expect(axe.violations).toEqual([]);

    await card.getByRole('button', { name: 'Track this train, the 09:15 London Kings Cross to London Euston' }).click();
    await expect.poll(() => accepted).toEqual({ index: 1, plannedAt: '2026-09-01T18:00:00Z' });
  });
});
