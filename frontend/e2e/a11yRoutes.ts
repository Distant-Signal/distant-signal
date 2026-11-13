// The routes and fixture ids accessibility.spec.ts sweeps with axe, and the
// inputs of the route-coverage guard (accessibility-coverage.spec.ts), which
// fails when a page under app/ is neither scanned from here nor listed in
// ALLOWED_UNSCANNED. Kept apart from the spec because Playwright does not
// let one spec import another.

/** The raw token of the unlisted link to journey 900002 (seed.sql). */
export const SHARED_JOURNEY_TOKEN = 'fixture-leg-progress-token-12345';

export const REAL_LINE_ID = process.env.E2E_REAL_LINE_ID ?? 'gwr-main-line';
export const REAL_INCIDENT_ID = process.env.E2E_REAL_INCIDENT_ID ?? 'E879EB6C791C470AB6C2A7458AE68C3B';
export const REAL_STATION_CRS = process.env.E2E_REAL_STATION_CRS ?? 'PAD';
export const STATION_LETTER = REAL_STATION_CRS.slice(0, 1).toLowerCase();

/** Every route that renders the same thing to an anonymous visitor on any
 * deployment with data in it. Kept as data rather than 20 hand-written
 * `test()` calls so that adding a route to `app/` is a one-line change
 * here -- the gap this suite existed to have and didn't. */
export const PUBLIC_ROUTES: [name: string, path: string][] = [
  ['/', '/'],
  ['/lines', '/lines'],
  [`/lines/${REAL_LINE_ID}`, `/lines/${REAL_LINE_ID}`],
  [`/lines/${REAL_LINE_ID}/history`, `/lines/${REAL_LINE_ID}/history`],
  [`/lines/${REAL_LINE_ID}/timetable`, `/lines/${REAL_LINE_ID}/timetable`],
  ['/lines/new', '/lines/new'],
  ['/stations', '/stations'],
  [`/stations/${REAL_STATION_CRS}`, `/stations/${REAL_STATION_CRS}`],
  // The station A to Z: the plain-link route to every station page.
  ['/stations/a-z', '/stations/a-z'],
  [`/stations/${STATION_LETTER}`, `/stations/${STATION_LETTER}`],
  // A TfL stop's live arrivals (the seed's stops; scripts/tfl-arrivals-stub.py
  // answers King's Cross with a board and Russell Square with a 503).
  ['/tfl/stops/940GZZLUKSX', '/tfl/stops/940GZZLUKSX'],
  ['/tfl/stops/940GZZLURSQ (TfL unavailable)', '/tfl/stops/940GZZLURSQ'],
  // The seed's Metrolink pages: the network's disruptions link the stops
  // they name, the line lists its stops, the timetable's row headers are
  // stop links.
  ['/transit/metrolink', '/transit/metrolink'],
  ['/transit/metrolink/incidents/E2E-S1', '/transit/metrolink/incidents/E2E-S1'],
  ['/transit/metrolink/stops', '/transit/metrolink/stops'],
  ['/transit/tfl', '/transit/tfl'],
  ['/transit/metrolink/lines/blue', '/transit/metrolink/lines/blue'],
  ['/transit/tfl/lines/dlr (a branch)', '/transit/tfl/lines/dlr'],
  [
    '/transit/metrolink/lines/blue/timetable',
    '/transit/metrolink/lines/blue/timetable?date=2026-09-17&direction=outbound&from=07:00',
  ],
  // The seed's island of Ireland pages: a live board, a station with
  // none, a NI Railways station and a corridor id with a slash.
  ['/island-of-ireland', '/island-of-ireland'],
  ['/island-of-ireland/iarnrod-eireann', '/island-of-ireland/iarnrod-eireann'],
  ['/island-of-ireland/ni-railways', '/island-of-ireland/ni-railways'],
  ['/island-of-ireland/iarnrod-eireann/lines/DUB-DRO%2FDUN', '/island-of-ireland/iarnrod-eireann/lines/DUB-DRO%2FDUN'],
  ['/island-of-ireland/iarnrod-eireann/stations/8220IR0007', '/island-of-ireland/iarnrod-eireann/stations/8220IR0007'],
  ['/island-of-ireland/iarnrod-eireann/stations/7020IR2162', '/island-of-ireland/iarnrod-eireann/stations/7020IR2162'],
  ['/island-of-ireland/ni-railways/stations/nir-bangor', '/island-of-ireland/ni-railways/stations/nir-bangor'],
  [
    '/island-of-ireland/iarnrod-eireann/trains/A101/2026-09-17',
    '/island-of-ireland/iarnrod-eireann/trains/A101/2026-09-17',
  ],
  // A train running today, with "Track this train" (the seed's A102,
  // dated Dublin's today).
  [
    '/island-of-ireland/iarnrod-eireann/trains/A102/[today]',
    `/island-of-ireland/iarnrod-eireann/trains/A102/${new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Dublin',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date())}?from=CNLLY`,
  ],
  ['/incidents', '/incidents'],
  [`/incidents/${REAL_INCIDENT_ID}`, `/incidents/${REAL_INCIDENT_ID}`],
  ['/trains', '/trains'],
  // The Trains section's other views, with results (the seed's W62001).
  ['/trains (departures)', '/trains?station=ZFA&date=2099-01-05'],
  ['/trains (arrivals)', '/trains?station=ZFC&board=arrivals&date=2099-01-05'],
  ['/trains (between stations)', '/trains?from=ZFA&to=ZFC&date=2099-01-05'],
  ['/trains (headcode)', '/trains?headcode=2Z42&date=2099-01-05'],
  ['/track', '/track'],
  // Plan a journey (DS-194, which merged New journey into it): opens on
  // the planner; `?mode=known` is the train form, `?mode=untracked` the
  // Tube, bus or walk form. `/journeys/new` redirects here.
  ['/plan', '/plan'],
  ['/plan?mode=known', '/plan?mode=known'],
  ['/plan?mode=untracked', '/plan?mode=untracked'],
  ['/journeys/new (redirected to /plan)', '/journeys/new?mode=known'],
  ['/groups/new', '/groups/new'],
  ['/connect-claude', '/connect-claude'],
  // The retired consent bridge's "this moved" note.
  ['/connect-claude/authorize', '/connect-claude/authorize'],
  // A client-only page, and the only route here reachable without any
  // backend state. Visited with no OAuth params on purpose: that is its
  // error branch, which is the state a user actually lands in when the
  // callback goes wrong, and it is one of the `<Text c="...">{error}</Text>`
  // sites the contrast work below covers.
  ['/chat/callback', '/chat/callback'],
  // Deliberate 404, exercising not-found.tsx + the `<main>` landmark every
  // not-found.tsx inherits from app/layout.tsx.
  ['a deliberate 404', '/lines/nonexistent-line-slug'],
  // The app-wide 404 (app/not-found.tsx), for a URL no route matches.
  ['an unmatched-route 404', '/this-route-does-not-exist'],
  // These gate on a session and, logged out, render a heading plus an
  // auto-opened `LoginPromptModal`. That modal state is a real, reachable,
  // first-paint DOM for an anonymous visitor -- and is where the Mantine
  // close-button `button-name` defect lived -- so it is audited here rather
  // than treated as "logged-in only".
  ['/journeys (anonymous)', '/journeys'],
  ['/groups (anonymous login prompt)', '/groups'],
  ['/chat (anonymous login prompt)', '/chat'],
  ['/account/preferences', '/account/preferences'],
  ['/account/notifications (anonymous login prompt)', '/account/notifications'],
  ['/attribution', '/attribution'],
  ['/developers', '/developers'],
  ['/developers/api', '/developers/api'],
  // The rest of the account and regular-journey pages, the shared journey
  // link (seed.sql's unlisted link to journey 900002), the status pages,
  // the operators pages and the transit index, lines and stops. Gated pages
  // render their login prompt here; LOGGED_IN_ROUTES has them signed in.
  ['/account', '/account'],
  ['/account/deleted', '/account/deleted'],
  ['/account/connected-apps (anonymous login prompt)', '/account/connected-apps'],
  // No such app is registered on the e2e api, so signed in this is the
  // consent page's "couldn't load" state; anonymous it is the login prompt.
  ['/account/connected-apps/[client] (anonymous login prompt)', '/account/connected-apps/e2e-app'],
  ['/journeys/regular (anonymous login prompt)', '/journeys/regular'],
  ['/journeys/regular/new (anonymous login prompt)', '/journeys/regular/new'],
  ['/journeys/regular/[id] (anonymous login prompt)', '/journeys/regular/900201'],
  ['/journeys/recently-deleted (anonymous login prompt)', '/journeys/recently-deleted'],
  ['/journeys/shared/[token]', `/journeys/shared/${SHARED_JOURNEY_TOKEN}`],
  // Retired: redirects to /journeys (the page's own comment).
  ['/track/mine/add-ticket (redirected to /journeys)', '/track/mine/add-ticket'],
  ['/status', '/status'],
  ['/network/history', '/network/history'],
  ['/operators', '/operators'],
  ['/operators/[code]/history', '/operators/CC/history'],
  ['/transit', '/transit'],
  ['/transit/metrolink/lines/green', '/transit/metrolink/lines/green'],
  ['/transit/tfl/lines/victoria', '/transit/tfl/lines/victoria'],
  ['/transit/metrolink/stops/[stop]', '/transit/metrolink/stops/9400ZZMAPIC?date=2026-09-17'],
  ['/transit/tfl/stops/[stop]', '/transit/tfl/stops/9400ZZLUKSX?date=2026-09-17'],
  ['/transit/tfl/lines/dlr/timetable', '/transit/tfl/lines/dlr/timetable?date=2026-09-17'],
  ['/transit/tfl/incidents/[id] (not found)', '/transit/tfl/incidents/NOPE'],
];

/** The draft legal pages 404 unless the server has LEGAL_PAGES_PREVIEW or
 * LEGAL_PAGES_PUBLISHED on (frontend/lib/legal.ts). CI sets
 * LEGAL_PAGES_PREVIEW for this job, and the same env reaches this process. */
export const LEGAL_ROUTES: [name: string, path: string][] = [
  ['/privacy', '/privacy'],
  ['/terms', '/terms'],
  ['/cookies', '/cookies'],
  ['/contact', '/contact'],
  ['/accessibility', '/accessibility'],
];

/** The routes whose signed-in DOM differs from the anonymous one (the
 * anonymous run shows a login prompt instead), scanned in both colour
 * schemes. `/` gains the pinned sections, `/journeys` and `/groups` replace
 * a login modal with content, `/lines` gains pin controls. */
export const LOGGED_IN_ROUTES: [name: string, path: string][] = [
  ['/', '/'],
  ['/lines', '/lines'],
  [`/lines/${REAL_LINE_ID}`, `/lines/${REAL_LINE_ID}`],
  [`/stations/${REAL_STATION_CRS}`, `/stations/${REAL_STATION_CRS}`],
  ['/journeys', '/journeys'],
  ['/groups', '/groups'],
  ['/chat', '/chat'],
  ['/account', '/account'],
  ['/account/notifications', '/account/notifications'],
  ['/account/preferences (logged in)', '/account/preferences'],
  ['/account/connected-apps', '/account/connected-apps'],
  ['/account/connected-apps/[client]', '/account/connected-apps/e2e-app'],
  ['/journeys/regular', '/journeys/regular'],
  ['/journeys/regular/new', '/journeys/regular/new'],
  ['/journeys/regular/[id]', '/journeys/regular/900201'],
  ['/journeys/recently-deleted', '/journeys/recently-deleted'],
  ['/journeys/900301 (reliability and Delay Repay)', '/journeys/900301'],
  ['/journeys/900203 (a regular journey in remind mode)', '/journeys/900203'],
  ['/journeys/[id] (journey 1, with a walk)', '/journeys/1'],
  ['/track/mine/add-ticket (redirected to /journeys)', '/track/mine/add-ticket'],
  ['/plan (logged in)', '/plan'],
  ['/plan?mode=known (logged in)', '/plan?mode=known'],
];

/** Route patterns (the page's folder under app/, `[x]` for a dynamic
 * segment) that dedicated tests in accessibility.spec.ts scan with fixtures
 * only some environments carry (E2E_GROUP_ID and so on), so they are not in
 * the lists above. If you rename one of those tests, keep this in step. */
export const SCANNED_BY_DEDICATED_TESTS: string[] = [
  '/groups/[id]', // E2E_GROUP_ID, signed in
  '/groups/join/[token]', // E2E_GROUP_INVITE_TOKEN
  '/lines/[id]/edit', // E2E_CUSTOM_LINE_ID, signed in
  '/train/by-id/[trackingId]', // E2E_TRACKING_ID, signed in
  '/train/[uid]/[date]', // E2E_TRAIN_UID and E2E_TRAIN_DATE, and W81181
];

/** Pages deliberately not scanned, each with the reason. Empty on purpose:
 * add a page here only with a justification a reviewer would accept (for
 * example "redirects with no UI of its own"), never to get a red build
 * green. */
export const ALLOWED_UNSCANNED: Record<string, string> = {};
