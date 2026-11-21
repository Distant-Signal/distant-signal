import { test, expect } from '@playwright/test';
import { logIn, ownerHeaders, SESSION_COOKIE } from './screenReaderFixtures';
import { REFRESH_INTERVAL_MS } from '../lib/refresh';

// The auto-refresh is silent to a screen reader, by design, and this test
// documents that. Every `REFRESH_INTERVAL_MS` the root layout's AutoRefresh
// calls `router.refresh()`, which swaps the changed text in place:
//
//  - focus stays on the same element (a person reading or typing is not moved),
//  - the scroll position does not change,
//  - no live region (`aria-live`, `role="status"`, `role="alert"`, `role="log"`)
//    is mutated, so nothing is announced on its own, and
//  - the new text is in the page for the next time the reader reaches it.
//
// If a change makes a refresh announce, move focus or scroll, this fails and
// the design has changed: decide it deliberately (docs/style-guide.md,
// "Accessibility") rather than by accident. The clock is Playwright's, so the
// 30 seconds pass at once; the data change is a real edit through the api on
// a journey the test makes for itself.

test.describe('auto-refresh and screen readers', () => {
  test.skip(!SESSION_COOKIE, 'set E2E_SESSION_COOKIE to the seed session');

  test('a refresh updates the text in place without moving focus or announcing', async ({ page, context, request }) => {
    await logIn(context);
    const departs = new Date(Date.now() + 7 * 24 * 3600 * 1000);
    const walk = (to: string) => ({
      transitMode: 'walk',
      originName: 'Islington',
      destinationName: to,
      plannedDeparture: departs.toISOString(),
      plannedArrival: new Date(departs.getTime() + 20 * 60_000).toISOString(),
    });
    const created = await request.post('/api/Journeys', {
      headers: { ...ownerHeaders(), 'content-type': 'application/json' },
      data: { customName: 'E2E silent refresh', leg: { mode: 'untracked', ...walk('Angel') } },
    });
    expect(created.ok(), await created.text()).toBe(true);
    const { journeyPublicId, legPublicId } = (await created.json()) as {
      journeyPublicId: string;
      legPublicId: string;
    };

    try {
      await page.clock.install();
      const refreshes: string[] = [];
      page.on('request', (req) => {
        if (req.headers().rsc === '1') refreshes.push(req.url());
      });
      await page.setViewportSize({ width: 1000, height: 360 });
      await page.goto(`/journeys/${journeyPublicId}`);
      const places = page.getByText('Islington to Angel', { exact: true });
      await expect(places).toBeVisible();

      // Focus a control, scroll a little and watch every DOM change.
      const focused = page.getByRole('button', { name: 'Delete journey', exact: true });
      await focused.focus();
      const before = await page.evaluate(() => {
        window.scrollTo(0, 40);
        const active = document.activeElement;
        if (!(active instanceof HTMLElement)) throw new Error('nothing has focus');
        active.dataset.marked = 'yes';
        const live = '[aria-live], [role=status], [role=alert], [role=log]';
        const liveMutations: string[] = [];
        const textMutations: string[] = [];
        new MutationObserver((records) => {
          for (const record of records) {
            const element = record.target instanceof Element ? record.target : record.target.parentElement;
            if (element?.closest(live)) liveMutations.push(`${record.type} in ${element.tagName}`);
            if (record.type === 'characterData' || record.addedNodes.length > 0) {
              textMutations.push(element?.textContent.trim().slice(0, 40) ?? '');
            }
          }
        }).observe(document.body, { subtree: true, childList: true, characterData: true });
        Object.assign(window, { __liveMutations: liveMutations, __textMutations: textMutations });
        return { scrollY: window.scrollY, label: active.textContent.trim() };
      });
      expect(before.label).toBe('Delete journey');
      expect(before.scrollY).toBeGreaterThan(0);

      // The change, then the 30 seconds.
      const edited = await request.put(`/api/Journeys/${journeyPublicId}/legs/${legPublicId}`, {
        headers: { ...ownerHeaders(), 'content-type': 'application/json' },
        data: walk('Highbury'),
      });
      expect(edited.ok(), await edited.text()).toBe(true);
      await page.clock.runFor(REFRESH_INTERVAL_MS + 1000);

      // The text updates in place.
      await expect(page.getByText('Islington to Highbury', { exact: true })).toBeVisible();
      expect(refreshes.length).toBeGreaterThan(0);

      const after = await page.evaluate(() => {
        const active = document.activeElement;
        return {
          scrollY: window.scrollY,
          sameNode: active instanceof HTMLElement && active.dataset.marked === 'yes',
          liveMutations: (window as unknown as { __liveMutations: string[] }).__liveMutations,
          textMutations: (window as unknown as { __textMutations: string[] }).__textMutations,
        };
      });
      // Focus is on the very node it was on, and the page did not scroll.
      expect(after.sameNode).toBe(true);
      expect(after.scrollY).toBe(before.scrollY);
      await expect(focused).toBeFocused();
      // The text changed, and no live region was part of it.
      expect(after.textMutations.length).toBeGreaterThan(0);
      expect(after.liveMutations).toEqual([]);
    } finally {
      await request.delete(`/api/Journeys/${journeyPublicId}`, { headers: ownerHeaders() });
    }
  });
});
