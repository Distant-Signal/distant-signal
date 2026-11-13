import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { AXE_TAGS } from './a11y-helpers';
import { openNavDrawer } from './navDrawer';
import { LEGAL_ROUTES, LOGGED_IN_ROUTES, PUBLIC_ROUTES, REAL_LINE_ID, REAL_STATION_CRS } from './a11yRoutes';

// A repeatable axe-core sweep over EVERY route in `app/`, in both colour
// schemes, logged out and logged in, and across the interactive sub-states
// (tabs, accordions, modals, open comboboxes) whose DOM does not exist on
// first paint.
//
// Like every other spec in this directory (see e2e/chat.spec.ts's own
// comment), this drives the REAL app through `playwright.config.ts`'s
// `webServer` (a real `next dev`) or a real deployed target
// (`E2E_BASE_URL`) -- it does not stand up its own backend, so every route
// here needs a real, reachable `api` service to render anything beyond a
// skeleton/error state.
//
// ---------------------------------------------------------------------------
// Why this is no longer scoped to five rules
// ---------------------------------------------------------------------------
// This file used to run `.withRules(['color-contrast', 'landmark-one-main',
// 'region', 'heading-order', 'page-has-heading-one'])`, with the reason
// stated in-file as: "The five rule IDs this plan's tasks fix. Not axe's
// full default ruleset -- a broader failure (e.g. a rule this plan never
// touched) shouldn't fail this spec and get miscategorized as a regression
// in this work."
//
// That reasoning was about ONE plan's blast radius
// (docs/superpowers/plans/2026-09-02-frontend-accessibility-fixes.md, Step
// 6), not a judgement that the other rules don't apply here -- the audit
// that plan came from ran axe's full default ruleset, and the same file's
// own comment went on to NAME the rules the narrow list was missing
// (`scrollable-region-focusable`, `nested-interactive`, `aria-hidden-focus`,
// `button-name`). With that plan long merged, the constraint now only hides
// defects, so it is lifted: this runs the full default ruleset, and every
// rule that fires against this app today has been triaged and either fixed
// or explicitly waived in `WAIVED_RULES` below, with the evidence.
//
// There is no documented per-rule exclusion anywhere in
// docs/superpowers/specs/2026-09-02-frontend-accessibility-audit-research.md
// to carry forward; its "Explicitly out of scope" list is about things
// tooling cannot check at all (real-AT testing, full keyboard-trap sweeps,
// manual WCAG 2.2 AA), not about rules to suppress. Two things from it DO
// carry forward and are now discharged rather than dropped: it flagged
// `TrackedTrainStatusBadge`'s contrast as never measured (the test account
// had no tracked trains) and dark mode as never audited at all. Both are
// covered below, and both turned out to be real failures -- see
// app/globals.css's dark-scheme block.
//
// The deterministic palette assertions in `app/globals.test.ts` remain the
// PRIMARY net for contrast (they can check colour pairings that no live
// page happens to render this minute); this is the secondary, real-DOM one.
//
// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
// Anonymous, always-on routes default to identifiers that exist on this
// project's own deployment; override them for a different `E2E_BASE_URL`.
// Fixture ids (REAL_LINE_ID and friends) live in ./a11yRoutes.ts, with the route lists.

// Everything below has NO default on purpose, and the tests that need one
// `test.skip()` themselves when it is unset. Two different reasons:
//
//  - `E2E_SESSION_COOKIE` and the per-user ids (`E2E_GROUP_ID`, ...) are
//    account-specific. There is no shareable "real" value the way there is
//    for a public line or station, and hardcoding one would make the
//    logged-in half of this suite fail on every deployment but one.
//    `E2E_SESSION_COOKIE` is the RAW `distant_signal_session` cookie value
//    (the `sessions` table stores its SHA-256 hex -- see
//    crates/api/src/auth.rs `hash_session_token`).
//
//  - `E2E_TRAIN_UID`/`E2E_TRAIN_DATE` carry forward, unchanged, the reason
//    the previous version of this file gave for omitting
//    `/train/[uid]/[date]` (and so `JourneyProgress`) altogether: a
//    `train_uid`/date pair is only resolvable for as long as that schedule
//    is live in the feed, so there is no stable fixture to hardcode or
//    default an env var to -- a route added with a default would start
//    failing on a date nobody changed anything on. The route is no longer
//    skipped outright, because "no stable default" is an argument against a
//    DEFAULT, not against covering the route when a caller supplies a live
//    pair. When it is not supplied, the component's own invariants (the
//    diagram's `role="group"` + per-state `aria-label`, every focusable
//    tooltip trigger carrying a real role and name, nothing focusable left
//    inside an ARIA-removed subtree) are still asserted deterministically
//    in `components/JourneyProgress.test.tsx`'s "keyboard reachability"
//    block, exactly as before.
const SESSION_COOKIE = process.env.E2E_SESSION_COOKIE;
const LEGAL_PAGES_RENDERED = process.env.LEGAL_PAGES_PREVIEW === 'true' || process.env.LEGAL_PAGES_PUBLISHED === 'true';
const ANONYMOUS_ROUTES = [...PUBLIC_ROUTES, ...(LEGAL_PAGES_RENDERED ? LEGAL_ROUTES : [])];
const GROUP_ID = process.env.E2E_GROUP_ID;
const GROUP_INVITE_TOKEN = process.env.E2E_GROUP_INVITE_TOKEN;
const CUSTOM_LINE_ID = process.env.E2E_CUSTOM_LINE_ID;
// A tracked-train subscription id whose `resolution_status` is NOT
// 'resolved': `/train/by-id/[trackingId]` `redirect()`s a resolved one away
// to `/train/[uid]/[date]`, so a resolved id would silently audit the wrong
// page.
const TRACKING_ID = process.env.E2E_TRACKING_ID;
const TRAIN_UID = process.env.E2E_TRAIN_UID;
const TRAIN_DATE = process.env.E2E_TRAIN_DATE;
// A user with nothing in their account (seed.sql's `fixture-empty`), for the
// empty states. Not an env var: the raw token is a fixture constant, like
// SHARED_JOURNEY_TOKEN, and the seed stores its hash.
const EMPTY_USER_SESSION_COOKIE = 'fixture-empty-session-token-0123456789abcdef';

/**
 * Rules switched off, and only for the one assertion that needs it. Nothing
 * here is a blanket suppression: `waived` is passed per-call, so a rule
 * waived for an open combobox is still live on all ~60 other assertions.
 *
 * `region` / `scrollable-region-focusable` on an open Mantine combobox
 * dropdown. Both fire on the same element -- the `ScrollArea` viewport
 * inside `<div data-mantine-shared-portal-node>`, which Mantine renders as
 * a direct child of `<body>`, outside `<main>`.
 *
 *  - `scrollable-region-focusable` wants a scrollable container to be
 *    focusable or to contain focusable content. This one is neither, and
 *    correctly so: it is a `role="listbox"` driven by the standard ARIA
 *    combobox pattern, where focus stays on the `role="combobox"` input and
 *    the active option is tracked by `aria-activedescendant`. Options carry
 *    no `tabindex` BY DESIGN -- making them focusable would break the
 *    pattern. Verified empirically against this app rather than assumed:
 *    the `combobox keyboard reachability` test below drives the list with
 *    arrow keys and asserts both that `aria-activedescendant` moves and
 *    that the supposedly-unreachable region actually scrolls.
 *  - `region` (a best-practice rule, not WCAG) wants all page content
 *    inside a landmark. A transient popover owned by an in-landmark control
 *    via `aria-controls` is not loose page content, and the portal target
 *    is Mantine's, not this app's -- the only lever would be
 *    `withinPortal={false}` on every Combobox, which reintroduces the
 *    overflow-clipping this app hit before (see
 *    `components/TrackTrainForm.tsx`'s "Deliberately NOT wrapped in a
 *    ScrollArea" comments for the same class of bug).
 */
const COMBOBOX_PORTAL_WAIVERS = ['region', 'scrollable-region-focusable'];

/** The `region` half of the reasoning above, for the account menu's
 * dropdown (`components/AccountMenu.tsx`). Identical situation --
 * Mantine portals a `Popover` dropdown to `<div
 * data-mantine-shared-portal-node>` under `<body>`, outside every
 * landmark, and `region` (best-practice, not WCAG) counts that as loose
 * page content. It is a transient popover owned by an in-landmark button
 * via `aria-controls`, and the portal target is Mantine's own.
 *
 * NOT `scrollable-region-focusable`: this dropdown has no `ScrollArea`,
 * so that rule has nothing to fire on and stays live here. The menu's
 * other two findings were real and are fixed rather than waived -- see
 * `withInitialFocusPlaceholder` in AccountMenu.tsx
 * (`aria-required-children`) and `Drawer.defaultProps` in lib/theme.ts
 * (`button-name`, on the nav drawer's close button). */
const MENU_PORTAL_WAIVERS = ['region'];

async function expectNoViolations(page: Page, waived: string[] = []) {
  // Mantine names a modal (`aria-labelledby`) from an effect that runs just
  // after the modal mounts, so a scan in that instant sees an unnamed
  // dialog (`aria-dialog-name`) that is never unnamed to a user. Wait for
  // the name to arrive; a dialog that never gets one times out here, is
  // left as it is, and fails the scan below as before.
  await page
    .waitForFunction(
      () =>
        [...document.querySelectorAll('[role="dialog"], [role="alertdialog"]')].every(
          (dialog) => dialog.hasAttribute('aria-labelledby') || dialog.hasAttribute('aria-label'),
        ),
      undefined,
      { timeout: 3000 },
    )
    .catch(() => {});
  const builder = new AxeBuilder({ page }).withTags(AXE_TAGS);
  const results = await (waived.length ? builder.disableRules(waived) : builder).analyze();
  expect(
    results.violations,
    JSON.stringify(
      results.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        help: v.help,
        nodes: v.nodes.map((n) => ({ target: n.target, html: n.html, why: n.failureSummary })),
      })),
      null,
      2,
    ),
  ).toEqual([]);
}

/** The session cookie for the logged-in projects. Not `Secure`: the backend
 * derives that flag from `SSO_REDIRECT_URL`'s scheme
 * (crates/api/src/routes/auth.rs `cookie_secure`), so over a local
 * `http://localhost:3000` it is unset, and marking it Secure here would
 * make the browser drop it. `domain` is taken from `E2E_BASE_URL` so this
 * works against a deployed target too. */
function sessionState(value: string) {
  const base = new URL(process.env.E2E_BASE_URL ?? 'http://localhost:3000');
  return {
    cookies: [
      {
        name: 'distant_signal_session',
        value,
        domain: base.hostname,
        path: '/',
        expires: -1,
        httpOnly: true,
        secure: base.protocol === 'https:',
        sameSite: 'Lax' as const,
      },
    ],
    origins: [],
  };
}

test.describe('accessibility: anonymous, light scheme', () => {
  for (const [name, path] of ANONYMOUS_ROUTES) {
    test(name, async ({ page }) => {
      // Next's error shell is itself accessible, so without this a route that
      // 500s would pass the sweep (it did: /connect-claude, 2026-09-29).
      const response = await page.goto(path);
      expect(response?.status() ?? 0, `${path} returned a server error`).toBeLessThan(500);
      await expectNoViolations(page);
    });
  }
});

// Dark mode was never audited before (the research doc says so in as many
// words), and the first sweep that did found a real, previously-invisible
// regression in `--mantine-color-dimmed` -- the app's single most
// widespread text style. `colorScheme: 'dark'` is enough on its own:
// app/layout.tsx mounts `<ColorSchemeScript defaultColorScheme="auto">`, so
// with no stored preference the app follows `prefers-color-scheme`.
test.describe('accessibility: anonymous, dark scheme', () => {
  test.use({ colorScheme: 'dark' });
  for (const [name, path] of ANONYMOUS_ROUTES) {
    test(name, async ({ page }) => {
      // Next's error shell is itself accessible, so without this a route that
      // 500s would pass the sweep (it did: /connect-claude, 2026-09-29).
      const response = await page.goto(path);
      expect(response?.status() ?? 0, `${path} returned a server error`).toBeLessThan(500);
      await expectNoViolations(page);
    });
  }
});

// Every severity pill (`StatusBadge`), rendered for real, in both schemes.
// The route sweep above only ever saw the seed's current statuses, minor
// delays and good service, so the red, blue and gray pills were never
// checked by axe at all; the worst of them (black on red) was the one
// people reported. The seed's line history carries one past status in each
// of the other three groups, and this asserts all five are on the page
// before it runs axe, so the coverage can't quietly lapse with the data.
// `app/globals.test.ts` ("status pill contrast") is still the primary
// net: axe only checks WCAG 2's ratio, which those black-on-colour pills
// passed.
test.describe('accessibility: every severity pill', () => {
  test.skip(!process.env.E2E_REAL_LINE_ID, 'needs the seeded line history (frontend/e2e/fixtures/seed.sql)');
  for (const colorScheme of ['light', 'dark'] as const) {
    test.describe(colorScheme, () => {
      test.use({ colorScheme });
      test(`/lines/${REAL_LINE_ID}/history shows and passes every severity group`, async ({ page }) => {
        await page.goto(`/lines/${REAL_LINE_ID}/history`);
        for (const group of ['good', 'informational', 'planned', 'mild', 'severe']) {
          await expect(page.locator(`[data-status-badge][data-severity-group="${group}"]`).first()).toBeVisible();
        }
        await expectNoViolations(page);
      });
    });
  }
});

// The nav's data freshness panel (`DataFreshnessInfo`), open, in both
// schemes. A Mantine tooltip only exists while it is open, so the route
// sweep never saw it, and every row in it was dimmed text at under 2:1 on
// the tooltip's inverted surface (app/globals.css, `.mantine-Tooltip-tooltip`).
// Opened by focusing its button, as a keyboard user would: the trigger is
// a real button in the tab order and the tooltip opens on focus.
test.describe('accessibility: data freshness panel open', () => {
  for (const colorScheme of ['light', 'dark'] as const) {
    test.describe(colorScheme, () => {
      test.use({ colorScheme });
      test('opened from the keyboard', async ({ page }) => {
        // A short page: the panel is in the nav on every one.
        await page.goto('/attribution');
        const trigger = page.getByRole('button', { name: 'Data freshness' });
        // Tabbed to rather than `focus()`ed: the tooltip opens on
        // keyboard focus (`:focus-visible`), not on a scripted focus.
        for (
          let presses = 0;
          presses < 20 && !(await trigger.evaluate((el) => el === document.activeElement));
          presses++
        ) {
          await page.keyboard.press('Tab');
        }
        await expect(trigger).toBeFocused();
        const panel = page.locator('.mantine-Tooltip-tooltip').filter({ hasText: 'Stations' });
        await expect(panel).toBeVisible();
        // Announced, not just shown: the panel is a `role="tooltip"` and the
        // focused trigger names it in `aria-describedby`, so a screen reader
        // reads the freshness rows after the button's name.
        await expect(panel).toHaveRole('tooltip');
        const panelId = await panel.getAttribute('id');
        expect(panelId).toBeTruthy();
        await expect(trigger).toHaveAttribute('aria-describedby', panelId!);
        await expect(trigger).toHaveAccessibleDescription(/Stations/);
        // `region` only, as for the account menu: Mantine portals the open
        // tooltip under <body>, outside every landmark. `color-contrast`
        // stays live, and is the rule this test is for.
        await expectNoViolations(page, MENU_PORTAL_WAIVERS);
      });
    });
  }
});

test.describe('accessibility: logged in', () => {
  test.skip(!SESSION_COOKIE, 'set E2E_SESSION_COOKIE to a raw distant_signal_session value');
  test.use({ storageState: SESSION_COOKIE ? sessionState(SESSION_COOKIE) : undefined });

  // LOGGED_IN_ROUTES (./a11yRoutes.ts): the routes whose logged-in DOM
  // differs from the anonymous one. The dark run below scans the same list.
  for (const [name, path] of LOGGED_IN_ROUTES) {
    test(name, async ({ page }) => {
      // Next's error shell is itself accessible, so without this a route that
      // 500s would pass the sweep (it did: /connect-claude, 2026-09-29).
      const response = await page.goto(path);
      expect(response?.status() ?? 0, `${path} returned a server error`).toBeLessThan(500);
      await expectNoViolations(page);
    });
  }

  // The seed's two-revision journey (900301): a leg's Delay Repay, open
  // because it may qualify, and its ticket details form (2026-11-06).
  test('/journeys/[id], Delay Repay and the ticket details form', async ({ page }) => {
    await page.goto('/journeys/900301');
    await expect(page.getByText('Delay Repay', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Add ticket details' }).click();
    await expect(page.getByRole('combobox', { name: 'Ticket type' })).toBeVisible();
    await expectNoViolations(page);
  });

  test('/groups/[id]', async ({ page }) => {
    test.skip(!GROUP_ID, 'set E2E_GROUP_ID to a group the E2E_SESSION_COOKIE user belongs to');
    await page.goto(`/groups/${GROUP_ID}`);
    await expectNoViolations(page);
  });

  test('/groups/join/[token]', async ({ page }) => {
    test.skip(!GROUP_INVITE_TOKEN, 'set E2E_GROUP_INVITE_TOKEN to a live invite token');
    await page.goto(`/groups/join/${GROUP_INVITE_TOKEN}`);
    // The token must actually resolve: an unknown/expired one renders the
    // (equally accessible) "Invite link not found" page, which is how this
    // test kept passing while seed.sql's invite insert silently failed
    // against the hashed `token_hash` column. Accepts both resolved
    // branches -- anonymous ("Join X?") and already-a-member.
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^(Join .+\?|You[’']re already in .+)$/);
    await expectNoViolations(page);
  });

  test('/lines/[id] for a custom line', async ({ page }) => {
    test.skip(!CUSTOM_LINE_ID, 'set E2E_CUSTOM_LINE_ID to a custom line the user can read');
    await page.goto(`/lines/${CUSTOM_LINE_ID}`);
    await expectNoViolations(page);
  });

  test('/lines/[id]/edit', async ({ page }) => {
    // Distinct from `/lines/new`, and not redundant with it: the form here
    // is PREFILLED, so it renders the station chips (and their remove
    // buttons) and any tag pills that an empty form never shows.
    test.skip(!CUSTOM_LINE_ID, 'set E2E_CUSTOM_LINE_ID to a custom line the user owns');
    await page.goto(`/lines/${CUSTOM_LINE_ID}/edit`);
    await expectNoViolations(page);
  });

  test('/train/by-id/[trackingId]', async ({ page }) => {
    test.skip(!TRACKING_ID, 'set E2E_TRACKING_ID to an UNRESOLVED tracked-train subscription id');
    await page.goto(`/train/by-id/${TRACKING_ID}`);
    // A resolved subscription redirects to /train/[uid]/[date]; asserting
    // we are still here is what stops this silently auditing that page
    // instead and reporting a pass for a route it never visited.
    expect(page.url()).toContain(`/train/by-id/${TRACKING_ID}`);
    await expectNoViolations(page);
  });
});

test.describe('accessibility: /train/[uid]/[date]', () => {
  // See the `TRAIN_UID` comment at the top of this file for why this pair
  // has no default.
  test.skip(
    !TRAIN_UID || !TRAIN_DATE,
    'set E2E_TRAIN_UID and E2E_TRAIN_DATE (YYYY-MM-DD) to a schedule that is live right now',
  );

  test('anonymous', async ({ page }) => {
    await page.goto(`/train/${TRAIN_UID}/${TRAIN_DATE}`);
    await expectNoViolations(page);
  });

  // The page with the most badges (delay, platform, stop states), in both
  // schemes: the changed platform's blue and its struck-through number.
  test.describe('dark scheme', () => {
    test.use({ colorScheme: 'dark' });
    test('anonymous', async ({ page }) => {
      await page.goto(`/train/${TRAIN_UID}/${TRAIN_DATE}`);
      await expectNoViolations(page);
    });
  });

  test('as the tracking owner', async ({ browser }) => {
    test.skip(!SESSION_COOKIE, 'set E2E_SESSION_COOKIE');
    // The owner view adds the rename/stop-tracking/share controls, none of
    // which the anonymous view renders.
    const context = await browser.newContext({ storageState: sessionState(SESSION_COOKIE!) });
    const owned = await context.newPage();
    await owned.goto(`/train/${TRAIN_UID}/${TRAIN_DATE}`);
    await expectNoViolations(owned);
    await context.close();
  });

  // A train cut short (DS-181, the seed's W81181): the red notice, and the
  // struck-through call with its "Cancelled" badge, in both schemes.
  for (const colorScheme of ['light', 'dark'] as const) {
    test.describe(`part cancelled, ${colorScheme} scheme`, () => {
      test.use({ colorScheme });
      test('anonymous', async ({ page }) => {
        await page.goto('/train/W81181/2026-12-03');
        await expect(page.getByRole('alert').filter({ hasText: 'Terminates at York' })).toBeVisible();
        await expectNoViolations(page);
      });
    });
  }
});

// The states below do not exist in any page's first-paint DOM, so a
// route-level sweep cannot see them however many rules it runs. Every one
// of these found at least one real defect on its first run.
for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`accessibility: interactive sub-states${colorScheme === 'dark' ? ', dark scheme' : ''}`, () => {
    test.use({ colorScheme });
    test(`/lines/${REAL_LINE_ID}/history, Trends tab`, async ({ page }) => {
      await page.goto(`/lines/${REAL_LINE_ID}/history`);
      await page.getByRole('tab', { name: 'Trends' }).click();
      await expect(page.getByRole('tabpanel')).toBeVisible();
      await expectNoViolations(page);
    });

    test(`/lines/${REAL_LINE_ID}, every issue accordion expanded`, async ({ page }) => {
      // `IssueList` is `keepMounted={false}`, so `DisruptionDetail` and its
      // badges and "View full incident details" link do not exist in the DOM
      // until the panel is opened.
      await page.goto(`/lines/${REAL_LINE_ID}`);
      await expandAllAccordions(page);
      await expectNoViolations(page);
    });

    test(`/stations/${REAL_STATION_CRS}, every disclosure expanded`, async ({ page }) => {
      // Every `StationAccessibilitySection` disclosure is `keepMounted={false}`;
      // that is where duplicate `role="region"` landmark names showed up.
      await page.goto(`/stations/${REAL_STATION_CRS}`);
      await expandAllAccordions(page);
      await expectNoViolations(page);
    });

    test('/incidents, results rendered', async ({ page }) => {
      await page.goto('/incidents?period=all');
      await expect(page.locator('[data-incident-results]')).toBeVisible();
      await expectNoViolations(page);
    });

    test('/incidents, filters panel open', async ({ page }) => {
      await page.goto('/incidents?period=custom');
      await page.getByRole('button', { name: 'Filters' }).click();
      await expect(page.getByRole('dialog', { name: 'Filters' })).toBeVisible();
      await expectNoViolations(page);
    });

    test('/trains, filters panel open after a search', async ({ page }) => {
      await page.goto(`/trains?station=${REAL_STATION_CRS}&stops_at=PBO`);
      await page.getByRole('button', { name: 'Filters' }).click();
      await expect(page.getByRole('dialog', { name: 'Filters' })).toBeVisible();
      await expectNoViolations(page);
    });

    // "Find a stop", the search-only bar (the e2e seed has no operators, so
    // /operators has no cards to search).
    test('/transit/metrolink/stops, stops searched', async ({ page }) => {
      await page.goto('/transit/metrolink/stops?q=picc');
      await expect(page.getByRole('textbox', { name: 'Find a stop' })).toHaveValue('picc');
      await expectNoViolations(page);
    });

    // The network page's "Find a stop" type-ahead, open on its matches and
    // with one highlighted, and with none.
    test('/transit/metrolink, stop finder open', async ({ page }) => {
      await page.goto('/transit/metrolink');
      const finder = page.getByRole('combobox', { name: 'Find a stop' });
      await finder.fill('a');
      await expect(page.getByRole('listbox')).toBeVisible();
      await finder.press('ArrowDown');
      await expect(finder).toHaveAttribute('aria-expanded', 'true');
      await expectNoViolations(page);
      await finder.fill('zzzz');
      await expect(page.getByRole('option', { name: /No stops match/ })).toBeVisible();
      await expectNoViolations(page);
    });

    test('/trains, results rendered', async ({ page }) => {
      await page.goto(`/trains?station=${REAL_STATION_CRS}`);
      await expectNoViolations(page);
    });

    test('/track, departure picker populated', async ({ page }) => {
      // The picker's cancelled rows are the only place in the app that dims a
      // whole row, which is how a `filled` badge -- already AA-safe at full
      // strength -- ended up composited below AA.
      await page.goto(`/track?origin=${REAL_STATION_CRS}`);
      await expectNoViolations(page);
    });

    test('/track, a station picked in a station field', async ({ page }) => {
      // The field shows the station by name with its clear button, and its
      // live region says what was picked.
      await page.goto('/track');
      const origin = page.getByRole('combobox', { name: 'Origin station' });
      await origin.fill(REAL_STATION_CRS);
      await origin.press('Tab');
      await expect(origin).toHaveValue(new RegExp(`\\(${REAL_STATION_CRS}\\)$`));
      await expect(page.getByRole('button', { name: 'Clear Origin station' })).toBeVisible();
      await expect(page.getByRole('status').filter({ hasText: 'Origin station set to' })).toBeAttached();
      await expectNoViolations(page);
    });

    test('/lines/new, advanced options expanded', async ({ page }) => {
      await page.goto('/lines/new');
      await page.getByRole('button', { name: /Show advanced options/i }).click();
      await expectNoViolations(page);
    });

    test('/lines, filters panel open', async ({ page }) => {
      await page.goto('/lines');
      await page.getByRole('button', { name: 'Filters' }).click();
      await expect(page.getByRole('dialog', { name: 'Filters' })).toBeVisible();
      await expectNoViolations(page);
    });

    test('/lines, filters sheet open on a phone viewport', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto('/lines');
      await page.getByRole('button', { name: 'Filters' }).click();
      await expect(page.getByRole('dialog', { name: 'Filters' })).toBeVisible();
      await expectNoViolations(page);
    });

    test('/lines, operator filter dropdown open', async ({ page }) => {
      await page.goto('/lines');
      await page.getByRole('button', { name: 'Filters' }).click();
      await page.getByRole('combobox', { name: 'Operator' }).click();
      await expect(page.getByRole('listbox', { name: 'Operator' })).toBeVisible();
      await expectNoViolations(page, COMBOBOX_PORTAL_WAIVERS);
    });

    // `/lines`'s operator filter is not the only combobox in the app, and a
    // dropdown that is never opened is a dropdown that is never scanned --
    // the whole reason this describe block exists. These are the other three
    // surfaces that mount one.
    test('/incidents, operator and line comboboxes open', async ({ page }) => {
      await page.goto('/incidents');
      await page.getByRole('button', { name: 'Filters' }).click();
      await page.getByRole('combobox', { name: /Operator/i }).click();
      await expect(page.getByRole('listbox').first()).toBeVisible();
      await expectNoViolations(page, COMBOBOX_PORTAL_WAIVERS);
      // Escape closes only the open list, never the whole panel.
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog', { name: 'Filters' })).toBeVisible();
      await page.getByRole('combobox', { name: /^Line/i }).click();
      await expect(page.getByRole('listbox').first()).toBeVisible();
      await expectNoViolations(page, COMBOBOX_PORTAL_WAIVERS);
    });

    test('/trains, station autocomplete open with suggestions', async ({ page }) => {
      await page.goto('/trains');
      await page
        .getByRole('combobox', { name: /Station/i })
        .first()
        .fill('Lon');
      await expect(page.getByRole('listbox').first()).toBeVisible();
      await expectNoViolations(page, COMBOBOX_PORTAL_WAIVERS);
    });

    test('/lines/new, station autocomplete open with suggestions', async ({ page }) => {
      await page.goto('/lines/new');
      await page
        .getByRole('combobox', { name: /Add station/i })
        .first()
        .fill('Lon');
      await expect(page.getByRole('listbox').first()).toBeVisible();
      await expectNoViolations(page, COMBOBOX_PORTAL_WAIVERS);
    });

    // A conditional banner, not an interaction: the yellow retention `Alert`
    // only renders when the requested range reaches past the server's real
    // `line_status_history` ceiling, so the default `/lines/[id]/history` view
    // never shows it -- and a whole failing `variant="light"` colour hid
    // behind exactly that. Included as the standing reminder that "every
    // route, every sub-state" has to mean data-conditional states too.
    test(`/lines/${REAL_LINE_ID}/history, retention shortfall banner`, async ({ page }) => {
      await page.goto(`/lines/${REAL_LINE_ID}/history?range=30d`);
      const banner = page.getByText(/isn't available/i);
      test.skip(
        (await banner.count()) === 0,
        "this deployment's history retention covers 30 days, so the banner never renders",
      );
      await expectNoViolations(page);
    });

    test('combobox keyboard reachability (the evidence behind COMBOBOX_PORTAL_WAIVERS)', async ({ page }) => {
      // Not a duplicate of the axe run above: this is the assertion that
      // earns the `scrollable-region-focusable` waiver, by demonstrating the
      // thing that rule cannot see. If Mantine ever changes its combobox away
      // from `aria-activedescendant`, or the list stops scrolling to the
      // active option, this fails and the waiver has to be re-argued.
      await page.goto('/lines');
      await page.getByRole('button', { name: 'Filters' }).click();
      const combobox = page.getByRole('combobox', { name: 'Operator' });
      await combobox.click();
      await expect(page.getByRole('listbox', { name: 'Operator' })).toBeVisible();
      expect(await combobox.getAttribute('aria-activedescendant')).toBeNull();

      await page.keyboard.press('ArrowDown');
      expect(await combobox.getAttribute('aria-activedescendant')).not.toBeNull();

      // Scoped to the portal node, which is the exact element axe reports:
      // `.mantine-ScrollArea-viewport` on its own also matches in-page scroll
      // areas, and a page-level one that never scrolls would make this pass
      // or fail for the wrong reason.
      const viewport = page.locator('[data-mantine-shared-portal-node] .mantine-ScrollArea-viewport');
      const { scrollable, options } = await viewport.evaluate((el) => ({
        scrollable: el.scrollHeight > el.clientHeight,
        options: el.querySelectorAll('[role="option"]').length,
      }));
      // A deployment with few enough operators to fit the dropdown without
      // scrolling has nothing to prove here -- and `scrollable-region-focusable`
      // would not have fired against it in the first place.
      test.skip(!scrollable, 'operator list is short enough not to scroll on this deployment');
      expect(await viewport.evaluate((el) => el.scrollTop)).toBe(0);

      // Stop one short of the end: Mantine's combobox WRAPS from the last
      // option back to the first, which would scroll the viewport back to 0
      // and make an over-long loop here look like a failure.
      for (let i = 0; i < options - 2; i++) await page.keyboard.press('ArrowDown');
      await expect.poll(() => viewport.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
    });

    // The nav drawer (components/AppNavDrawer.tsx) is this app's first
    // `Drawer`, and it exists only below `md` -- so on the desktop viewport
    // every other case here uses, it is not merely closed, it is unmountable.
    // Its contents are the ENTIRE navigation on a phone, which makes an
    // unaudited opened state the single largest a11y blind spot the mobile
    // collapse could have introduced.
    test('the nav drawer, opened on a phone viewport', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto('/lines');
      await openNavDrawer(page);
      await expectNoViolations(page);
    });

    test('skip link: first focusable element, visible on focus, targets main content', async ({ page }) => {
      // WCAG 2.4.1 (Bypass Blocks): skip link must be the first focusable
      // element, must be visible on keyboard focus, and must target the main
      // content area. This test verifies all three requirements.
      await page.goto('/lines');

      // Get the skip link
      const skipLink = page.getByRole('link', { name: 'Skip to content' });

      // Verify it exists
      await expect(skipLink).toBeAttached();

      // Verify it's a real anchor with the correct href
      const href = await skipLink.getAttribute('href');
      expect(href).toBe('#main-content');

      // Verify the target main element exists and has the id
      const mainElement = page.locator('#main-content');
      await expect(mainElement).toBeAttached();

      // Tab once from page load to focus the skip link (it should be first)
      await page.keyboard.press('Tab');
      await expect(skipLink).toBeFocused();

      // Verify it becomes visible on focus (check computed style)
      const skipLinkBox = await skipLink.boundingBox();
      expect(skipLinkBox).not.toBeNull();
      // After focus, the link should be in a reasonable position on screen
      // (not off at -9999px anymore)
      expect(skipLinkBox?.x).toBeGreaterThanOrEqual(0);
      expect(skipLinkBox?.y).toBeGreaterThanOrEqual(0);

      // I3 (2026-09-17 whole-branch review): the link's own filled-blue
      // background used to be 3.56:1 against its white text -- below WCAG
      // 1.4.3's 4.5:1 AA threshold, and axe's own `color-contrast` rule
      // catches it. Running the full sweep here, WHILE the link is focused
      // (its only visible state), is what actually exercises that pairing --
      // every other sweep in this file never focuses it, so this is the one
      // place a regression here would be caught.
      await expectNoViolations(page);
    });
  });
}

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`accessibility: interactive sub-states, logged in${colorScheme === 'dark' ? ', dark scheme' : ''}`, () => {
    test.use({ colorScheme });
    test.skip(!SESSION_COOKIE, 'set E2E_SESSION_COOKIE to a raw distant_signal_session value');
    test.use({ storageState: SESSION_COOKIE ? sessionState(SESSION_COOKIE) : undefined });

    // The account menu (components/AccountMenu.tsx) is this app's first
    // `Menu`, it only exists for an authenticated visitor, and its dropdown
    // is portalled -- so nothing else in this suite has ever put its DOM in
    // front of axe. It is also the one control that now carries the display
    // name solely as an accessible name, which is exactly the kind of thing
    // a full-ruleset sweep is here to keep honest.
    test('the account menu, opened', async ({ page }) => {
      await page.goto('/lines');
      await page
        .locator('nav[aria-label="Main"]')
        .getByRole('button', { name: /, account menu for / })
        .click();
      await expect(page.getByRole('menu')).toBeVisible();
      await expectNoViolations(page, MENU_PORTAL_WAIVERS);
    });

    test('/journeys, stop-tracking confirmation modal', async ({ page }) => {
      // Mantine's `Modal` close button has no accessible name of its own;
      // `lib/theme.ts` supplies one for every modal in the app through
      // `components.Modal.defaultProps`. This is the live check on that.
      //
      // Task 3.6.7: the row's Rename/Stop-tracking controls now live behind
      // one overflow-kebab menu (`More actions for ...`) instead of a
      // free-standing "Delete" button -- open that first, then its "Stop
      // tracking" menu item.
      await page.goto('/journeys');
      await page
        .getByRole('button', { name: /^More actions for/ })
        .first()
        .click();
      await page.getByRole('menuitem', { name: 'Stop tracking' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Close' })).toBeVisible();
      await expectNoViolations(page);
    });

    test('/groups/[id], share-a-train modal', async ({ page }) => {
      test.skip(!GROUP_ID, 'set E2E_GROUP_ID');
      await page.goto(`/groups/${GROUP_ID}`);
      await page.getByRole('button', { name: /Add one of my trains/i }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await expectNoViolations(page);
    });

    test('/groups/[id], share-a-custom-line modal', async ({ page }) => {
      test.skip(!GROUP_ID, 'set E2E_GROUP_ID');
      await page.goto(`/groups/${GROUP_ID}`);
      await page.getByRole('button', { name: /Share one of my custom lines/i }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await expectNoViolations(page);
    });

    test('/groups/[id], rename modal', async ({ page }) => {
      test.skip(!GROUP_ID, 'set E2E_GROUP_ID');
      await page.goto(`/groups/${GROUP_ID}`);
      await page
        .getByRole('button', { name: /^Rename$/ })
        .first()
        .click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await expectNoViolations(page);
    });

    // The state class that got away the first time round. Sixteen components
    // render a failed action as an inline red `<Text>`, and NONE of them is
    // reachable by navigating or clicking -- the mutation has to actually
    // fail. Every one of those sixteen shipped below AA in both colour
    // schemes, and no amount of route coverage or modal-opening would have
    // found it, because axe can only see states the page is actually in.
    //
    // Failing the request at the network layer, rather than pointing the app
    // at a broken backend, keeps this a deterministic check of the ERROR
    // RENDERING and not of the API.
    test('a failed mutation renders its inline error text readably', async ({ page }) => {
      await page.goto('/journeys');
      // A 500 on purpose: a stop-tracking delete shows the API's own sentence
      // only for a readable 400/403/409/422 body (`failureFromResponse`), so a
      // 500 always takes `describeFailure('stop tracking', 'this train', 500)`
      // -- "Couldn't stop tracking this train. Try again." -- a string this
      // test can match without depending on whatever prose a backend happens
      // to return. The delete is sent after the 10 second undo window, and
      // the failure is a toast.
      await page.route('**/api/**', (route) =>
        route.request().method() === 'GET' ? route.fallback() : route.fulfill({ status: 500, body: '' }),
      );
      // Task 3.6.7: open the row's overflow-kebab menu first, same as the
      // confirmation-modal test above.
      await page
        .getByRole('button', { name: /^More actions for/ })
        .first()
        .click();
      await page.getByRole('menuitem', { name: 'Stop tracking' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.getByRole('button', { name: 'Confirm stop tracking' }).click();
      // The assertion that keeps this from passing vacuously: if the error
      // text never rendered, there is nothing here to have measured.
      await expect(page.getByText("Couldn't stop tracking this train. Try again.").first()).toBeVisible({
        timeout: 20_000,
      });
      await expectNoViolations(page);
    });
  });
}

test.describe('accessibility: logged in, dark scheme', () => {
  // The logged-in pages carry most of this app's `c="dimmed"` density (the
  // tracked-train and group cards), which is exactly where the dark-scheme
  // contrast regression showed up -- so the two halves are crossed rather
  // than each tested only in the light scheme.
  test.skip(!SESSION_COOKIE, 'set E2E_SESSION_COOKIE to a raw distant_signal_session value');
  test.use({
    colorScheme: 'dark',
    storageState: SESSION_COOKIE ? sessionState(SESSION_COOKIE) : undefined,
  });

  for (const [name, path] of LOGGED_IN_ROUTES) {
    test(name, async ({ page }) => {
      // Next's error shell is itself accessible, so without this a route that
      // 500s would pass the sweep (it did: /connect-claude, 2026-09-29).
      const response = await page.goto(path);
      expect(response?.status() ?? 0, `${path} returned a server error`).toBeLessThan(500);
      await expectNoViolations(page);
    });
  }

  test('/groups/[id]', async ({ page }) => {
    test.skip(!GROUP_ID, 'set E2E_GROUP_ID');
    await page.goto(`/groups/${GROUP_ID}`);
    await expectNoViolations(page);
  });
});

// Loading, empty and error states. Like the interactive states above, none of
// them is on a route's settled first paint, so the route sweeps never see
// them: a skeleton is on screen for a moment, an empty list needs an account
// or a search with nothing in it, and an error needs a request that fails.
// Each test asserts the state is really showing before it runs axe, so it
// can't pass vacuously. Both colour schemes, as everywhere else.
//
// Not covered: `app/error.tsx` (the error boundary). It renders only when a
// Server Component throws, and no request the browser makes can make the
// server's own fetch fail, so there is no deterministic way to reach it here;
// `app/error.test.tsx` renders it under vitest instead.
for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`accessibility: loading, empty and error states, ${colorScheme} scheme`, () => {
    test.use({ colorScheme });

    // Anonymous empty states: searches that match nothing.
    for (const [name, path, empty] of [
      ['/trains, no train with that headcode', '/trains?headcode=9Z99&date=2099-01-05', /No train runs as 9Z99/],
      ['/incidents, no incidents match', '/incidents?q=zzzz-no-such-incident', /No incidents match/],
      ['/lines, no lines match', '/lines?q=zzzz-no-such-line', /No lines match|No lines/],
    ] as const) {
      test(name, async ({ page }) => {
        const response = await page.goto(path);
        expect(response?.status() ?? 0).toBeLessThan(500);
        await expect(page.getByText(empty).first()).toBeVisible();
        await expectNoViolations(page);
      });
    }

    test('/operators, a search with no operator', async ({ page }) => {
      await page.goto('/operators');
      await page
        .getByRole('textbox', { name: /Find an operator|Search/i })
        .first()
        .fill('zzzz-no-such-operator');
      await expect(page.getByText(/No operators match|No operators/i).first()).toBeVisible();
      await expectNoViolations(page);
    });

    // /plan: the planner's own request held (loading), failed (error) and
    // answered with nothing (empty). Mocked at the browser, so this stays
    // inside `/Trips/plan`'s rate limit, which plan.spec.ts also draws on.
    const PLAN_URL = '/plan?origin=KGX&destination=EUS&date=2026-09-17&departAfter=08:00';

    test('/plan, route search in flight', async ({ page }) => {
      let release!: () => void;
      const gate = new Promise<void>((resolve) => (release = resolve));
      await page.route('**/api/Trips/plan?*', async (route) => {
        await gate;
        await route.fulfill({ status: 500, body: '' });
      });
      await page.goto(PLAN_URL);
      await page.getByRole('button', { name: 'Find routes' }).click();
      // In flight: the form's button reads "Searching" with its spinner, disabled.
      await expect(page.getByRole('button', { name: 'Searching' })).toBeDisabled();
      await expectNoViolations(page);
      release();
    });

    test('/plan, route search failed', async ({ page }) => {
      await page.route('**/api/Trips/plan?*', (route) => route.fulfill({ status: 500, body: '' }));
      await page.goto(PLAN_URL);
      await page.getByRole('button', { name: 'Find routes' }).click();
      await expect(page.getByText("Couldn't plan this trip").first()).toBeVisible();
      await expectNoViolations(page);
    });

    // The Journeys skeleton (app/journeys/loading.tsx), held on screen by
    // delaying the client navigation's own request: `Link` shows the
    // route's loading boundary until the page's payload arrives.
    test('/journeys, skeleton while the page loads', async ({ page }) => {
      await page.goto('/attribution');
      // Once the nav's links have been prefetched, which is what puts the
      // route's loading boundary on screen the moment one is followed.
      await page.waitForLoadState('networkidle');
      let release!: () => void;
      const gate = new Promise<void>((resolve) => (release = resolve));
      await page.route(/\/journeys\?_rsc=/, async (route) => {
        const headers = route.request().headers();
        if (headers['next-router-prefetch'] || headers['next-router-segment-prefetch']) return route.fallback();
        await gate;
        return route.fallback();
      });
      await page.locator('nav[aria-label="Main"]').getByRole('link', { name: 'Journeys' }).first().click();
      await expect(page.locator('[data-page-skeleton]')).toBeVisible();
      // `page-has-heading-one` is waived for this one assertion: a route's
      // skeleton is deliberately headingless (components/PageSkeleton.tsx:
      // one `role="status"` region named by a visually hidden label, with
      // the bars `aria-hidden`), for the moment before the page's own h1
      // arrives. Every settled page keeps the rule, in every other scan.
      await expectNoViolations(page, ['page-has-heading-one']);
      release();
    });

    // Signed in with nothing in the account: every list's empty state.
    test.describe('an account with nothing in it', () => {
      test.use({ storageState: sessionState(EMPTY_USER_SESSION_COOKIE) });
      for (const [name, path] of [
        ['/', '/'],
        ['/journeys', '/journeys'],
        ['/groups', '/groups'],
        ['/journeys/regular', '/journeys/regular'],
        ['/journeys/recently-deleted', '/journeys/recently-deleted'],
        ['/account/connected-apps', '/account/connected-apps'],
        ['/account/notifications', '/account/notifications'],
        ['/account', '/account'],
      ] as const) {
        test(name, async ({ page }) => {
          const response = await page.goto(path);
          expect(response?.status() ?? 0, `${path} returned a server error`).toBeLessThan(500);
          // The signed-in page, not the login prompt: the empty user's
          // session must be live, or this would audit the wrong state.
          await expect(page.getByRole('button', { name: /^Log in/ })).toHaveCount(0);
          await expectNoViolations(page);
        });
      }
    });
  });
}

/** Opens every `Accordion` control on the page. Both accordion users in
 * this app are `keepMounted={false}`, so their panels are not merely hidden
 * -- they are not in the DOM at all, and axe cannot see them unopened. */
async function expandAllAccordions(page: Page) {
  const controls = page.locator('button.mantine-Accordion-control[aria-expanded="false"]');
  // Re-queried each pass rather than iterated once: opening one panel can
  // mount another accordion inside it (a station's accessibility groups do
  // exactly this), and a stale locator list would miss those.
  for (let pass = 0; pass < 4; pass++) {
    const count = await controls.count();
    if (count === 0) break;
    for (let i = 0; i < count; i++) {
      const control = controls.nth(0);
      if ((await control.count()) === 0) break;
      await control.click();
      await page.waitForTimeout(150);
    }
  }
  // Give any fetch a panel kicked off (the station timetable's
  // `/api/trains/search`) a chance to render before axe reads the DOM.
  await page.waitForLoadState('networkidle').catch(() => {});
}
