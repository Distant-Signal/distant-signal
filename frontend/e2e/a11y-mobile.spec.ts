import { test } from '@playwright/test';
import {
  CORE_LOGGED_IN_ROUTES,
  CORE_ROUTES,
  SESSION_COOKIE,
  expectNoViolations,
  gotoOk,
  sessionState,
} from './a11y-helpers';

// The `chromium-mobile` project (Pixel 7 emulation at 390px wide):
// the nav collapses into a drawer and tables and cards reflow, so the DOM
// axe sees differs from the desktop sweep in accessibility.spec.ts.
for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`a11y mobile: anonymous, ${colorScheme}`, () => {
    test.use({ colorScheme });
    for (const [name, path] of CORE_ROUTES) {
      test(name, async ({ page }) => {
        await gotoOk(page, path);
        await expectNoViolations(page);
      });
    }
  });

  test.describe(`a11y mobile: logged in, ${colorScheme}`, () => {
    test.skip(!SESSION_COOKIE, 'set E2E_SESSION_COOKIE to a raw distant_signal_session value');
    test.use({ colorScheme, storageState: SESSION_COOKIE ? sessionState(SESSION_COOKIE) : undefined });
    for (const [name, path] of CORE_LOGGED_IN_ROUTES) {
      test(name, async ({ page }) => {
        await gotoOk(page, path);
        await expectNoViolations(page);
      });
    }
  });
}
