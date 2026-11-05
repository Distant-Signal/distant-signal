import { test, expect, type Page } from '@playwright/test';

// Each source is credited beside its data (components/DataCredits.tsx);
// the footer carries only its links. Seeded ids: the frontend-e2e job's env.
const LINE_ID = process.env.E2E_REAL_LINE_ID ?? 'lner-ecml';
const STATION_CRS = process.env.E2E_REAL_STATION_CRS ?? 'KGX';
const TRAIN_UID = process.env.E2E_TRAIN_UID ?? 'W12345';
const TRAIN_DATE = process.env.E2E_TRAIN_DATE ?? '2026-09-17';
const INCIDENT_ID = process.env.E2E_REAL_INCIDENT_ID ?? 'FIXTURE-INCIDENT-1';

const NRIL = 'Contains Information of Network Rail Infrastructure Limited licensed under the following licence';

function credits(page: Page) {
  return page.getByRole('main').locator('[data-data-credits]');
}

/** Darwin's and Knowledgebase Stations' strings, the link's text being
 * "powered by NationalRail" (its "(opens in a new tab)" is visually hidden). */
async function expectNationalRail(page: Page) {
  const line = credits(page).locator('[data-credit="national-rail"]');
  await expect(line.getByRole('link', { name: 'powered by NationalRail (opens in a new tab)' })).toBeVisible();
  await expect(line).toHaveText(/^powered by NationalRail.* \(Train Information Services Ltd\)$/);
}

test('the footer keeps its links and carries no credit lines', async ({ page }) => {
  await page.goto('/attribution');
  const footer = page.getByRole('contentinfo');
  for (const name of ['Data sources and licences', 'Source code', 'Developers']) {
    await expect(footer.getByRole('link', { name: new RegExp(`^${name}`) })).toBeVisible();
  }
  await expect(footer.getByText(/Powered by TfL Open Data|powered by NationalRail|Network Rail|RSP/)).toHaveCount(0);
});

test("a National Rail line's page credits Darwin and TRUST beside its status", async ({ page }) => {
  await page.goto(`/lines/${LINE_ID}`);
  await expectNationalRail(page);
  await expect(credits(page).getByRole('link', { name: NRIL })).toBeVisible();
  await expect(credits(page).getByRole('link', { name: 'Data credits' })).toHaveAttribute('href', '/attribution');
});

test("a station's page credits Knowledgebase Stations under its information", async ({ page }) => {
  await page.goto(`/stations/${STATION_CRS}`);
  await expectNationalRail(page);
});

test("a train's page credits its timetable, movements and live samples", async ({ page }) => {
  await page.goto(`/train/${TRAIN_UID}/${TRAIN_DATE}`);
  await expect(credits(page).getByText(/^Source: RSP/)).toBeVisible();
  await expect(credits(page).getByRole('link', { name: NRIL })).toBeVisible();
  await expectNationalRail(page);
});

test('an incident names its publisher', async ({ page }) => {
  await page.goto(`/incidents/${INCIDENT_ID}`);
  await expect(
    credits(page).getByText('Incidents from the Knowledgebase, published by Rail Delivery Group.'),
  ).toBeVisible();
});
