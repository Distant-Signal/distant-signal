# Island of Ireland pages: Iarnród Éireann and NI Railways

Design, 2026-11-04. Status: **proposed, built alongside** (DS-360). "§"
alone means a section of this document; "design §4" means
[the Ireland rail support design](2026-09-05-ireland-rail-support-design.md).

Irish rail data has been live in production since the Ireland rail support
plan, but only on the backend: nothing in `frontend/` reads it. This
document puts it in front of people. It follows
[the frontend design guide](../../frontend-design-guide.md) and
[the style guide](../../style-guide.md), and reuses the `/transit/[network]`
pages' parts wherever the data fits them.

## 1. What the data gives us

From ds-api's `crates/api/src/routes/island_of_ireland.rs`, all public and
unauthenticated:

| Route | What | Tier |
|---|---|---|
| `GET /public/island-of-ireland/stations[?network=]` | every station: `id`, `name`, `network`, optional lat/lon | A, both networks |
| `GET /public/island-of-ireland/lines[?network=]` | every line: `id`, `name`, `network`, ordered station ids | A, both networks |
| `GET /public/island-of-ireland/stations/{id}/departures` | the latest live board: train code, origin, destination, scheduled and expected times, minutes late, status, due in | B, Iarnród Éireann only |

`network` is `republic-of-ireland` or `northern-ireland` and means "whose
feed this row comes from", not where the station is (design §3, §4).

What there is not, and the pages must not pretend there is:

- **No line status or incidents** for either network (Tier C was rejected).
- **No live NI Railways times** (Tier B is Iarnród Éireann only).
- **No timetable** pages: the static feed gives each line one ordered
  stopping pattern, not trips.

## 2. Pages

One section, `/island-of-ireland`, with a page per network, line and
station. The URL mirrors the api's own name for the scope; "Ireland"
alone would read as the Republic only, which design §4 is careful not to
imply.

| Path | h1 and title | What it answers |
|---|---|---|
| `/island-of-ireland` | Ireland and Northern Ireland | Which networks we cover and what we have for each |
| `/island-of-ireland/iarnrod-eireann` | Iarnród Éireann | Its lines and stations |
| `/island-of-ireland/ni-railways` | NI Railways | Its lines and stations |
| `/island-of-ireland/[network]/lines/[line]` | the line's name | Where the line goes, its stations in order |
| `/island-of-ireland/[network]/stations/[station]` | the station's name | What's leaving soon (Iarnród Éireann), which lines call here |

The network slugs are the operators' names, not the api's
`republic-of-ireland`/`northern-ireland`, because the pages are about
whose trains these are. A small frontend map (`lib/ireland.ts`) turns the
api's `network` into the slug and the display name ("Iarnród Éireann",
"NI Railways"). The GB operator list (`tocs`) doesn't gain them: they
have no ATOC code and no GB line status.

### Overview

Two cards (`ClickableCard`), one per network that has any stations, each
with its name and a one-line summary of what we have: "18 lines, 152
stations. Live departures at its stations." or "4 lines, 47 stations.
Stations and lines only." Under them, one line saying we don't show line
status for either network. A network with no rows has no card; with none
at all, the page is not found (§6).

### Network page

The `/transit/[network]` layout:

1. h1 and a one-line notice of what we have and don't have:
   - Iarnród Éireann: "Lines and stations from the published timetable,
     with live departures at each station. We don't show line status for
     Iarnród Éireann."
   - NI Railways: "Lines and stations. We don't have live NI Railways
     times or line status."
2. **Lines** as `LineStatusRow`s in a `LineStatusRowList`, with no badge
   (§4) and a detail line naming the ends: "Dublin Connolly to Belfast".
3. **Stations**, A to Z, as a plain multi-column link list. There are at
   most a few hundred, so it is a list, not a type-ahead.
4. The network's credit (§7).

### Line page

h1 the line's name, the network as a link back, then the stations drawn
as a route strip with `TransitLineDiagram` (given a `stopHref` so it links
to these station pages), fed from the line's one ordered station list. A
note in place of a status badge (§4). No timetable link, no pin star: a
pin is a line-status subscription, and there is no status to follow.

### Station page

h1 the station's name, the network as a link, "Lines here" as a
`LinkSentence`, then:

- **A station with a live board** (`liveCode`, Iarnród Éireann only):
  **Departures**, a `ServiceRowList` like `TransitStopBoard`: the expected
  time, destination, the delay in words from `lateMinutes` ("5 min late",
  coloured as on the line pages' service rows), and a details line
  "Timetabled 22:39 · From Athlone · Train code A810" (the timetabled time
  only when it differs). No row links: there is no Irish train page. A train
  with no departure time (it terminates here) is left out. The upstream
  status words ("En Route", "No Information") are not shown: they are
  unedited feed text in title case, and the delay says the same thing in
  our words.
- **An Iarnród Éireann station without one:** "We don't have live
  departures for this station."
- **NI Railways:** no Departures section, one line: "We don't have live NI
  Railways times."

The page is server-rendered and the board is not cached (the api doesn't
cache it either), so a reload shows the latest board.

## 3. Navigation and search

- **Not a primary nav entry.** The bar has 74px of slack at 992px with
  "Trams and metros" in it; a ninth item would not fit, and this section
  is narrower than any in the bar.
- **`/lines`** links it in its header, as it already does each transit
  network ("Ireland and Northern Ireland").
- **`/stations` search** finds Irish stations: `searchStationsAndStops`
  gains a third extra source, the stations list (one cached fetch),
  matched with the same `searchKey`. Each row carries a new place kind,
  `{ kind: 'ireland', network, stationId }`, its detail is "Iarnród
  Éireann station" or "NI Railways station", and picking it opens the
  station page. Other pickers (the planner, untracked legs) don't get
  them: nothing there can use an Irish station.
- **Sitemap:** the overview, both network pages and every line and station
  page, while the api lists any (§6).

## 4. No line status, said once and plainly

The GB pages lead with a status badge. Showing none would be read as
"fine", and a made-up "Good service" would be false. So:

- No badge, no "Good service", no status colour anywhere in this section.
- The network page's notice and the overview's line say we don't show
  line status. The line page says, where the badge would be: "We don't
  have line status for this line."
- The country filter's `MODE_TO_COUNTRY` (`lib/modes.ts`) stays empty:
  no Irish line-status row exists for it to map (country filtering design,
  Decision 3). These pages don't touch `/lines`' status table.

## 5. Ireland, Northern Ireland and the border (design §4)

- **Naming.** The section is "Ireland and Northern Ireland"; networks are
  named by operator ("Iarnród Éireann", "NI Railways"), never "the Republic"
  or "NI" alone. "Irish Rail" is used only in credits that are
  licence text.
- **Cross-border.** Design §4 sources the Enterprise and the stations it
  shares with NI Railways (Belfast, Lisburn, Portadown, Lurgan, Newry) from
  Iarnród Éireann only. The pages follow the data: those stations are
  Iarnród Éireann station pages, with live departures, and NI Railways'
  lines skip them. Two notes make that visible without a jurisdiction
  field we don't have:
  - the NI Railways page: "Belfast Grand Central, Lisburn, Portadown,
    Lurgan and Newry are on the Enterprise, under Iarnród Éireann." with
    the link;
  - the Iarnród Éireann page: "Includes the Enterprise to Belfast, run
    with NI Railways."
- No station is listed twice, so nothing needs deduplicating.

## 6. Empty and switched-off states

The island-of-Ireland pollers are switched off by default; then the
catalogue routes return `[]`.

- No stations at all: every page in the section is not found, the
  `/lines` link and the sitemap entries are left out, and search adds
  nothing. Nothing about Ireland is visible, as for `/transit` while
  `API_TRANSIT_NETWORKS` is empty.
- One network empty: its card, page and search rows are missing; the
  other's stand alone.
- A station with no live board (`liveCode` null, or the departures
  route 404s): "We don't have live departures for this station."
- A board with nothing on it (200, `[]`): "No departures listed right
  now."
- The board's fetch fails: "Couldn't load departures." (`describeFailure`),
  with the rest of the page intact.
- The catalogue fetch fails: the page fails through `error.tsx`, as any
  other server page whose main data fails.
- A line whose stations aren't in the catalogue: those ids are dropped
  from the strip (never shown raw).

## 7. Credits

The statements on `/attribution` (`DATA_SOURCES` in
`components/OpenDataAttribution.tsx`, LEG-20 and LEG-21) are the
licence-checked wording. Each page in the section shows the ones for the
data on it, rendered from the same entries so the wording can't drift,
plus a "Data credits" link:

- Iarnród Éireann's stations and lines: the NTA's CC BY 4.0 statement
  (name, licence link, "as is").
- Its live departures: the courtesy credit to Iarnród Éireann's realtime
  data.
- NI Railways' stations and lines: the OGL v3.0 default statement, naming
  Translink and OpenDataNI.
- The overview: all three.

## 8. Data shapes and the data work it waits on

A parallel change (DS-359, in ds-api, ds-core and ds-pollers) fixes the
data's gaps and settles the contract, all additive:

- stations gain `liveCode` (the live board's code, `null` for every NI
  Railways row and any station without a board) and `rawName`; NI
  Railways names come title-cased without "Rail Halt"/"Rail Station";
- lines merge each directional pair into one corridor (`DUB-BFT-I` and
  `DUB-BFT-O` become `DUB-BFT`) and gain `shortName`, `agency`, `color`
  and `textColor` (`null` for NI Railways);
- the departures route also takes the catalogue id, resolving it through
  `liveCode`, and 404s when there is no board;
- the three response types are generated (`IslandOfIrelandStationResponse`,
  `IslandOfIrelandLineResponse`, `IslandOfIrelandDepartureResponse`).

The frontend pins that api (ds-api #12), so `lib/irelandTypes.ts` only
aliases the generated types. The departures route also sends the board's
poll time, `X-Polled-At` (RFC 3339) and `Last-Modified`; the station page
shows it as "Updated 4 min ago", and the `/api` proxy passes both through.

`liveCode` stays `null` until the new writer and the live poller have each
run once after a deploy, which the "no live departures" line covers.

The four page templates join the usage-event route list
(`lib/usageEvents.ts`), which must equal the api's allowlist, so ds-api
accepts them first (ds-api #10).

## 9. Open questions

1. **Primary nav.** If the section grows (NI Railways live times, status),
   it may earn a nav entry; today it doesn't fit.
2. **Planner.** Irish stations aren't routable; the station pages offer no
   "Plan a journey from here".
