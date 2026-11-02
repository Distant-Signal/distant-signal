import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Opens the phone-viewport nav drawer and returns it.
 *
 * `page.goto` resolves on `load`, which can land before React has hydrated
 * the server-rendered burger button; a click in that window does nothing, so
 * the drawer never opens and anything waiting on it times out. That was the
 * cause of the intermittent nav-drawer failures in `nav.spec.ts` and
 * `accessibility.spec.ts`. Retrying the click until the dialog is actually
 * visible makes the open deterministic: a pre-hydration no-op click is simply
 * repeated, and once the drawer is visible no further click is made.
 */
export async function openNavDrawer(page: Page): Promise<Locator> {
  await waitForSessionNav(page);
  const burger = page
    .getByRole('navigation', { name: 'Main', exact: true })
    .getByRole('button', { name: 'Navigation menu' });
  const drawer = page.getByRole('dialog', { name: 'Menu' });
  await expect(async () => {
    if (!(await drawer.isVisible())) {
      await burger.click();
    }
    await expect(drawer).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
  return drawer;
}

/**
 * Waits until the nav bar is the one the session check rendered.
 *
 * app/layout.tsx streams the bar: the first bytes carry a logged-out
 * fallback (marked by React's `<template id="B:…">` just before it), and
 * the finished bar follows in a `<div hidden>` that React swaps in a few
 * hundred ms later. Anything done to the fallback in that window (focus, an
 * opened drawer) goes with it. Settled means: one bar, and no pending
 * boundary marker in front of it.
 */
export async function waitForSessionNav(page: Page): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            document.querySelectorAll('nav[aria-label="Main"]').length === 1 &&
            document.querySelector('template[id^="B:"] + nav[aria-label="Main"]') === null,
        ),
      { message: 'the nav bar to finish streaming in' },
    )
    .toBe(true);
}
