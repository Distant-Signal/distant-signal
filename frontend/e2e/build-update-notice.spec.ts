import { test, expect } from '@playwright/test';
import { scanPageBothSchemes } from './a11y-helpers';

// The reload hint (components/BuildUpdateNotice.tsx) only exists once the
// operator sets FRONTEND_MIN_BUILD above the build's epoch, which the shared
// e2e stack never does (it would put a banner on every page). This spec
// forces the state the way the proxy would: an /api response carrying
// X-DS-Min-Build, which the page's fetch wrapper reads.

const MESSAGE = 'A new version of Distant Signal is available.';

test.describe('build update notice', () => {
  test('is absent by default', async ({ page }) => {
    await page.goto('/lines');
    await expect(page.getByRole('heading', { name: 'Lines', level: 1 })).toBeVisible();
    await expect(page.getByText(MESSAGE)).toHaveCount(0);
  });

  test('appears when an api response sets a higher floor, with no axe violations', async ({ page }) => {
    test.setTimeout(120_000);
    await page.route('**/api/test-min-build', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '{}',
        headers: { 'X-DS-Min-Build': '999999' },
      }),
    );
    await page.goto('/lines');
    await expect(page.getByRole('button', { name: 'Data freshness' })).toBeVisible();

    const status = page.getByRole('status').filter({ hasText: MESSAGE });
    // Retried until the page's fetch wrapper is installed (hydration).
    await expect(async () => {
      await page.evaluate(() => fetch('/api/test-min-build'));
      await expect(status).toBeVisible({ timeout: 500 });
    }).toPass({ timeout: 15_000 });

    await expect(page.getByRole('heading', { name: 'Lines', level: 1 })).toBeVisible();
    await expect(status.getByRole('button', { name: 'Reload' })).toBeVisible();

    const results = await scanPageBothSchemes(page);
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });
});
