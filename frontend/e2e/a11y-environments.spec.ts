import { expect, test, type Page } from '@playwright/test';
import { CORE_ROUTES, expectNoViolations, gotoOk } from './a11y-helpers';

// Accessibility under user-environment settings that change what renders:
// a 320px-wide viewport (WCAG 1.4.10 reflow: a 1280px window at 400% zoom),
// prefers-reduced-motion (2.3.3 / user expectation) and forced colours
// (Windows high contrast). Desktop Chromium only; see playwright.config.ts.

/** Elements wider than the viewport that nothing scrolls: content a reader
 * at 400% zoom can't reach without scrolling the page sideways, or that is
 * cut off outright. An element inside its own horizontally scrolling or
 * clipping container (a table, a code block, a carousel) is that
 * container's business and is not reported. */
async function clippedOrOverflowing(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const out: string[] = [];
    if (document.documentElement.scrollWidth > vw + 1) {
      out.push(`page scrolls horizontally: scrollWidth ${document.documentElement.scrollWidth} > ${vw}`);
    }
    const scrolls = (el: Element) => {
      const s = getComputedStyle(el);
      return ['auto', 'scroll', 'hidden', 'clip'].includes(s.overflowX);
    };
    for (const el of Array.from(document.body.querySelectorAll('*'))) {
      const r = el.getBoundingClientRect();
      if (r.width <= 1 || r.height <= 1 || r.right <= vw + 1) continue;
      const s = getComputedStyle(el);
      if (s.visibility === 'hidden' || s.display === 'none' || s.position === 'fixed') continue;
      let contained = false;
      for (let p = el.parentElement; p && p !== document.documentElement; p = p.parentElement) {
        if (scrolls(p) && p.getBoundingClientRect().right <= vw + 1) {
          contained = true;
          break;
        }
      }
      if (contained) continue;
      const label = `${el.tagName.toLowerCase()}.${(el.getAttribute('class') ?? '').split(' ')[0]}`;
      out.push(`${label} right=${Math.round(r.right)} > ${vw}: ${el.textContent.trim().slice(0, 40)}`);
      if (out.length >= 10) break;
    }
    return out;
  });
}

test.describe('reflow at 320px (400% zoom)', () => {
  test.use({ viewport: { width: 320, height: 256 } });
  for (const [name, path] of CORE_ROUTES) {
    test(name, async ({ page }) => {
      await gotoOk(page, path);
      await page.waitForLoadState('networkidle');
      expect(await clippedOrOverflowing(page)).toEqual([]);
    });
  }
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });
  // Anything still running after the page settles that lasts longer than a
  // blink or loops forever. A loading indicator that has finished is gone by
  // then, so what is left is decoration the viewer asked not to get.
  const SHORT_MS = 100;
  for (const [name, path] of CORE_ROUTES) {
    test(name, async ({ page }) => {
      await gotoOk(page, path);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);
      const running = await page.evaluate((shortMs) => {
        return document
          .getAnimations()
          .filter((a) => {
            if (a.playState !== 'running') return false;
            const t = a.effect?.getComputedTiming();
            if (!t) return false;
            const total = typeof t.endTime === 'number' ? t.endTime : Infinity;
            return total > shortMs;
          })
          .map((a) => {
            const target = (a.effect as KeyframeEffect | null)?.target;
            const name =
              a instanceof CSSAnimation ? a.animationName : a instanceof CSSTransition ? a.transitionProperty : a.id;
            const where = target
              ? `${target.tagName.toLowerCase()}.${(target.getAttribute('class') ?? '').split(' ')[0]}`
              : '?';
            return `${where}: ${name}`;
          });
      }, SHORT_MS);
      expect(running, 'animations still running under prefers-reduced-motion').toEqual([]);
    });
  }
});

test.describe('forced colours', () => {
  test.use({ forcedColors: 'active' });
  // Smoke: axe's colour rules don't apply (the browser owns the colours), so
  // this catches structural problems that only show here and confirms the
  // pages still render under the emulation.
  const FORCED_ROUTES = CORE_ROUTES.filter(([name]) =>
    ['/', '/lines', 'a line', 'a station', '/plan', '/journeys (login prompt)'].includes(name),
  );
  for (const [name, path] of FORCED_ROUTES) {
    test(name, async ({ page }) => {
      await gotoOk(page, path);
      expect(await page.evaluate(() => matchMedia('(forced-colors: active)').matches)).toBe(true);
      await expect(page.locator('main')).toBeVisible();
      await expectNoViolations(page);
    });
  }
});
