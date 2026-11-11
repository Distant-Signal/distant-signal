import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// The site footer carries no data credits (components/OpenDataAttribution.tsx
// has why that still meets each licence): every page that shows a
// provider's data credits it in place. So every page either renders one of
// the credit notes or is listed here, with why it shows no third-party
// data. A new page fails this test until it decides which.
const CREDIT_NOTES = /<(DataCredits|IrelandAttributionNote|TransitAttributionNote)\b/;

const NO_THIRD_PARTY_DATA: Readonly<Record<string, string>> = {
  'accessibility/page.tsx': 'legal page',
  'contact/page.tsx': 'legal page',
  'cookies/page.tsx': 'legal page',
  'privacy/page.tsx': 'legal page',
  'terms/page.tsx': 'legal page',
  'attribution/page.tsx': 'the full credits themselves',
  'account/page.tsx': "the visitor's own account",
  'account/connected-apps/page.tsx': "the visitor's own connected apps",
  'account/connected-apps/[client]/page.tsx': "the visitor's own connected apps",
  'account/deleted/page.tsx': 'a confirmation',
  'account/notifications/page.tsx': "the visitor's own notification settings",
  'account/preferences/page.tsx': "the visitor's own preferences",
  'chat/callback/page.tsx': 'a sign-in redirect',
  'connect-claude/page.tsx': 'connection instructions',
  'connect-claude/authorize/page.tsx': 'a consent screen',
  'developers/page.tsx': 'documentation with made-up example values',
  'developers/api/page.tsx': 'documentation with made-up example values',
  'groups/page.tsx': "the visitor's group names",
  'groups/new/page.tsx': 'a form',
  'groups/join/[token]/page.tsx': 'an invitation',
  // A template holds train legs only, each between two CRS stations: the
  // api drops a journey's untracked legs and needs both codes on every leg
  // (ds-api crates/api/src/routes/journey_templates.rs), so no TfL-picked
  // place can be in one. Credit TfL's stops here if that ever changes.
  'journeys/regular/page.tsx': "the visitor's saved plans: National Rail station names and times, no live data",
  'journeys/regular/[id]/page.tsx': "the visitor's saved plan: National Rail station names and times, no live data",
  'journeys/recently-deleted/page.tsx':
    "the visitor's own deleted journeys, as Connected apps lists them: station codes, places, dates and train IDs, no live data",
  'lines/new/page.tsx': "a form over Distant Signal's own line catalogue",
  'lines/[id]/edit/page.tsx': "a form over Distant Signal's own line catalogue",
  'track/mine/add-ticket/page.tsx': 'a redirect to the Journeys page',
  'transit/page.tsx': 'network names only; each network page credits its data',
};

const APP = join(__dirname);

function pages(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    // `app/api` is the proxy to the api, not pages.
    if (statSync(path).isDirectory()) return path === join(APP, 'api') ? [] : pages(path);
    return name === 'page.tsx' ? [path] : [];
  });
}

describe('data credits on every page', () => {
  const all = pages(APP).map((path) => ({
    page: relative(APP, path).replace(/^\(home\)\//, ''),
    source: readFileSync(path, 'utf8'),
  }));

  it.each(all)('$page credits its data or shows none', ({ page, source }) => {
    const credited = CREDIT_NOTES.test(source);
    if (page in NO_THIRD_PARTY_DATA) {
      // Stale entries go: a page that now credits data is no longer one
      // that shows none.
      expect(credited, `${page} is listed as showing no third-party data`).toBe(false);
    } else {
      expect(credited, `${page} renders no data credits; add DataCredits or list it with a reason`).toBe(true);
    }
  });

  it('lists only pages that exist', () => {
    const known = new Set(all.map(({ page }) => page));
    expect(Object.keys(NO_THIRD_PARTY_DATA).filter((page) => !known.has(page))).toEqual([]);
  });
});
