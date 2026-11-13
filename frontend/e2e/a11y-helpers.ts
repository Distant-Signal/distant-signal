import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

/** The tags every axe scan in the e2e specs runs: WCAG 2.0 to 2.2 A and AA,
 * plus axe's best-practice rules. Spelled out so a library upgrade cannot
 * quietly change what is checked. */
export const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];

type Scheme = 'light' | 'dark';

/** Scans the whole page (nav and footer included) in the current colour
 * scheme. Prefer this over `.include('main')`: chrome regressions then fail
 * every spec that reaches the page. */
export async function scanPage(page: Page) {
  return new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
}

/** Scans the page once per colour scheme, for states that exist only after
 * an interaction (so the route sweep cannot reach them) and are set up once.
 * Violations carry the scheme they were found in. Leaves the emulation reset. */
export async function scanPageBothSchemes(page: Page) {
  const violations = [];
  for (const scheme of ['light', 'dark'] as const satisfies readonly Scheme[]) {
    await page.emulateMedia({ colorScheme: scheme });
    // Mantine follows `prefers-color-scheme` live; wait until it has.
    await expect(page.locator('html')).toHaveAttribute('data-mantine-color-scheme', scheme);
    const results = await scanPage(page);
    violations.push(...results.violations.map((v) => ({ ...v, scheme })));
  }
  await page.emulateMedia({ colorScheme: null });
  return { violations };
}
