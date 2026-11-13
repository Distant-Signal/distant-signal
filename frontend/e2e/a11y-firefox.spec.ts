import { test } from '@playwright/test';
import { MAIN_ROUTES, SESSION_COOKIE, expectNoViolations, gotoOk, sessionState } from './a11y-helpers';

// The `firefox-a11y` project: axe over the main routes in Gecko, whose
// computed styles and accessibility tree differ from Chromium's (the nav spec
// found a font-metric difference there). Light scheme only: colour tokens are
// engine-independent and the Chromium sweep already covers dark.
// WebKit is left out: it needs its own browser download and system packages
// in the job for a third engine whose axe results track Chromium's here.
test.describe('a11y firefox: anonymous', () => {
  for (const [name, path] of MAIN_ROUTES) {
    test(name, async ({ page }) => {
      await gotoOk(page, path);
      await expectNoViolations(page);
    });
  }
});

test.describe('a11y firefox: logged in', () => {
  test.skip(!SESSION_COOKIE, 'set E2E_SESSION_COOKIE to a raw distant_signal_session value');
  test.use({ storageState: SESSION_COOKIE ? sessionState(SESSION_COOKIE) : undefined });
  test('/journeys', async ({ page }) => {
    await gotoOk(page, '/journeys');
    await expectNoViolations(page);
  });
});
