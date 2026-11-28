import { Fragment, Suspense, cache, type ReactNode } from 'react';
import { Stack, Title, Text, Group, Divider } from '@mantine/core';
import { SectionTitle } from '@/components/SectionTitle';
import { notFound, permanentRedirect } from 'next/navigation';
import type { Metadata } from 'next';
import {
  getStopPointDisruption,
  getPreferences,
  getStationName,
  getStationSampleStats,
  getStationAccessibility,
  getAllTocs,
  getStationDayTimetable,
  getStationBoard,
  getTransitRailLinks,
  getPreviewStopPointDisruption,
  ApiNotFoundError,
  ApiBadRequestError,
} from '@/lib/api';
import { withStaleFallback } from '@/lib/liveDataCache';
import { LineStatusRow, LineStatusRowItem, LineStatusRowList } from '@/components/LineStatusRow';
import { StatusBadge } from '@/components/StatusBadge';
import { IssueList } from '@/components/IssueList';
import { PinToggle } from '@/components/PinToggle';
import { ShareButton } from '@/components/ShareButton';
import { StationAccessibilitySection } from '@/components/StationAccessibilitySection';
import { TextLink } from '@/components/TextLink';
import { StationBrowseIndex, StationLetterPage, stationBrowseMetadata } from '../StationBrowse';
import { isStationBrowseSegment, STATION_INDEX_SEGMENT } from '@/lib/stationBrowse';
import { StationTramLinks } from '@/components/TransitRailLinks';
import { NationalRailCredit } from '@/components/NationalRailCredit';
import { DataCredits, lineCredits } from '@/components/DataCredits';
import { RecentlyCleared } from '@/components/RecentlyCleared';
import { FoldedRecentlyCleared } from '@/components/FoldedRecentlyCleared';
import { StationFold } from '@/components/StationFold';
import { worstStatus, severityRank } from '@/lib/severity';
import { dedupeStationIssues } from '@/lib/stationIssues';
import { representativeStatus, formatSampleSummary } from '@/lib/sampleStats';
import type { LineStatusReport, Preferences, StationAccessibilityData, StationOperatorSampleStats } from '@/lib/types';
import { pageMetadata, previewImageAlt } from '@/lib/pageMetadata';
import { type StationDisruptionState, stationPreviewImage } from '@/lib/stationPreview';
import { stationJsonLd } from '@/lib/jsonLd';
import { londonToday } from '@/lib/londonWallClock';
import {
  STATION_TIMETABLE_LIMIT,
  factSentences,
  stationDescription,
  stationFacts,
  summariseTimetable,
  type StationFacts,
  type TimetableSummary,
} from '@/lib/stationSummary';
import { StationBoard } from '@/components/StationBoard';
import {
  STATION_BOARD_LIMIT,
  boardRowsOf,
  operatorOptions,
  parseBoardParam,
  parseOperatorParam,
  type BoardKind,
  type OperatorOption,
} from '@/lib/stationBoard';
import type { StationBoard as StationBoardData } from '@/lib/types';
import { StationAbout, StationTimetableSection } from '@/components/StationAbout';
import { stationDeparturesHref } from '@/lib/stationDepartures';
import { JsonLd, structuredDataOrigin } from '@/components/JsonLd';

/** Three outcomes, not two. The previous version collapsed "there is no
 * such station" and "the name lookup failed" into a single `null`, so the
 * page could not tell them apart — and rendered a cheerful "No disruptions
 * affecting this station." for `/stations/ZZZ`, complete with a working pin
 * button. An unknown code must 404; a lookup that merely failed must still
 * keep falling back to the bare CRS, since the disruption data is what
 * this page is actually for. */
type StationLookup = { outcome: 'found'; name: string } | { outcome: 'unknown' } | { outcome: 'unavailable' };

/** Every CRS code is exactly three letters, so a malformed one is answered
 * without troubling the API at all. */
const CRS_PATTERN = /^[A-Za-z]{3}$/;

// The exact shape getPreferences() already returns for a 401, named so the
// fallback below is typed as `Preferences` rather than inferred with
// `never[]` members. Per-user data fails closed during an outage instead of being stale-served.
const NO_PREFERENCES: Preferences = {
  pinnedLines: [],
  pinnedStations: [],
  pinnedOperators: [],
  silentPinnedLines: [],
  bankHolidayDivision: null,
};

async function lookupStation(crs: string): Promise<StationLookup> {
  if (!CRS_PATTERN.test(crs)) return { outcome: 'unknown' };
  try {
    const name = await getStationName(crs);
    return name === null ? { outcome: 'unknown' } : { outcome: 'found', name };
  } catch {
    return { outcome: 'unavailable' };
  }
}

/** A real, curated-catalogue distinction, not a network one:
 * `/StopPoint/{crs}/Disruption` now 404s when no line's `stations` list
 * covers this CRS at all (crates/api/src/routes/line_status.rs's
 * `get_stop_point_disruption`), which is a genuinely different fact from
 * "covered, and every covering line is Good Service" (`200 []`). By the
 * time this runs, `lookupStation` has already confirmed the CRS is a real,
 * known station -- so this 404 can only mean "not covered by our line-status
 * tracking," never "unknown station" (that's `notFound()`'s job, above).
 * `withStaleFallback` already rethrows `ApiNotFoundError` rather than
 * stale-serving it (see that function's own doc comment: it's "a
 * meaningful application state," not a connectivity blip), so catching it
 * here is exactly where that state should land. */
interface StationDisruptions {
  reports: LineStatusReport[];
  coverage: 'covered' | 'none';
}

async function fetchStationDisruptions(crs: string): Promise<StationDisruptions> {
  try {
    const reports = await withStaleFallback(`stopPointDisruption:${crs}`, () => getStopPointDisruption(crs));
    return { reports, coverage: 'covered' };
  } catch (err) {
    if (err instanceof ApiNotFoundError) {
      return { reports: [], coverage: 'none' };
    }
    throw err;
  }
}

/** A separate, orthogonal coverage question from `StationDisruptions`
 * above -- LDBWS live-sampling coverage, not line-status-catalogue
 * coverage, so a station can independently be `covered`/`none` for
 * disruptions and `sampled`/`not-sampled` for stats. Structurally mirrors
 * `fetchStationDisruptions`'s own 404-vs-other-failure split. See
 * docs/superpowers/specs/2026-09-03-per-station-stats-design.md. */
type StationSampleStatsResult =
  { coverage: 'not-sampled' } | { coverage: 'sampled'; operatorStats: StationOperatorSampleStats[] };

async function fetchStationSampleStats(crs: string): Promise<StationSampleStatsResult> {
  try {
    const operatorStats = await withStaleFallback(`stationSampleStats:${crs}`, () => getStationSampleStats(crs));
    return { coverage: 'sampled', operatorStats };
  } catch (err) {
    if (err instanceof ApiNotFoundError) return { coverage: 'not-sampled' };
    throw err;
  }
}

/** A third, independent coverage question from the two above -- whether
 * this app has ever captured `stations` reference data for this CRS at all
 * (`404`, `'unavailable'`), vs. whether it has but none of the twelve
 * allowlisted accessibility keys were present (`200 {}`, `'empty'`). See
 * docs/superpowers/specs/2026-09-12-station-accessibility-design.md. Those are two different,
 * already-representable
 * database states (the column is `NOT NULL DEFAULT '{}'`, but a CRS can
 * have no `stations` row at all) and must stay visibly distinct in the UI,
 * not collapsed into one "no data" message.
 *
 * `'unavailable'` is defence in depth rather than a routinely-reached
 * state on this page: `lookupStation` above resolves the heading through
 * `getStationName`, which searches the same `stations` table, so a CRS with
 * no row there already `notFound()`s the whole page before this runs. It
 * remains reachable if the row disappears between the two reads, and the
 * distinct copy is what the spec asks for regardless -- don't "simplify" it
 * away on the grounds that it looks unreachable. */
type StationAccessibilityResult =
  { coverage: 'unavailable' } | { coverage: 'empty' } | { coverage: 'present'; data: StationAccessibilityData };

async function fetchStationAccessibility(crs: string): Promise<StationAccessibilityResult> {
  try {
    const data = await withStaleFallback(`stationAccessibility:${crs}`, () => getStationAccessibility(crs));
    return Object.keys(data).length === 0 ? { coverage: 'empty' } : { coverage: 'present', data };
  } catch (err) {
    if (err instanceof ApiNotFoundError) return { coverage: 'unavailable' };
    throw err;
  }
}

/** Today's timetable facts for the station: its train companies, where its
 * trains go, its first and last train. One cached read of the api's train
 * search (an hour, `getStationDayTimetable`), shared by the page and its
 * metadata. `null` when there is none, whatever the reason (no schedule
 * published, no trains, the api down): the page then simply has no such
 * section, it never fails for it. */
const fetchStationTimetable = cache(async (crs: string): Promise<TimetableSummary | null> => {
  try {
    const page = await getStationDayTimetable(crs, londonToday(), STATION_TIMETABLE_LIMIT);
    return summariseTimetable(page, crs);
  } catch {
    return null;
  }
});

/** The station's departures board, or `null` for every way it can be
 * missing: the api's switch is off (404), the station has no timetable for
 * the day (404), the api is slow or down. The board is an extra, so the page
 * then renders exactly as it did without it, with no empty section and no
 * error text. Not stale-served: an old board would be a wrong one. */
async function fetchStationBoard(
  crs: string,
  operator?: string,
  kind: BoardKind = 'departures',
): Promise<StationBoardData | null> {
  try {
    return await requestStationBoard(crs, operator, kind);
  } catch {
    return null;
  }
}

/** One board request, throwing as `getStationBoard` does. */
async function requestStationBoard(crs: string, operator: string | undefined, kind: BoardKind) {
  if (kind === 'arrivals') return getStationBoard(crs, STATION_BOARD_LIMIT, operator, 'arrivals');
  return operator === undefined
    ? getStationBoard(crs, STATION_BOARD_LIMIT)
    : getStationBoard(crs, STATION_BOARD_LIMIT, operator);
}

/** The board for an operator filter. The api answers 400 to an operator code
 * it does not know (`?operator=ZZ`); the board is then fetched once more
 * without it and shown unfiltered, with the picker on "All operators",
 * rather than losing the whole board. `operator` is the one the board is
 * really filtered to. */
async function fetchStationBoardFor(
  crs: string,
  operator: string | undefined,
  kind: BoardKind,
): Promise<{ board: StationBoardData | null; operator: string | null }> {
  if (operator === undefined) return { board: await fetchStationBoard(crs, undefined, kind), operator: null };
  try {
    return { board: await requestStationBoard(crs, operator, kind), operator };
  } catch (error) {
    if (!(error instanceof ApiBadRequestError)) return { board: null, operator };
    return { board: await fetchStationBoard(crs, undefined, kind), operator: null };
  }
}

/** The station's facilities and accessibility facts for its prose and
 * description, from the hour-cached accessibility read. `null` when there
 * is none (no row, an empty one, an outage). */
async function readStationFacts(crs: string): Promise<StationFacts | null> {
  try {
    const data = await getStationAccessibility(crs);
    return Object.keys(data).length === 0 ? null : stationFacts(data);
  } catch {
    return null;
  }
}

/** A well-formed code in lower or mixed case (`/stations/eus`) answers
 * with a permanent redirect to its upper-case page, the one canonical URL.
 * The name lookup is case-insensitive but the disruption lookup is not, so
 * the lower-case page used to render with the wrong content. */
function redirectToUpperCase(crs: string): void {
  if (CRS_PATTERN.test(crs) && crs !== crs.toUpperCase()) {
    permanentRedirect(`/stations/${crs.toUpperCase()}`);
  }
}

/** Per-page `<title>`, description, canonical URL and link-preview cards
 * for a station. The description is evergreen (what the page offers, not
 * today's status), because a search snippet outlives any status by days.
 * Reuses `lookupStation`, which the page component calls too, so the fetch
 * is deduped by Next's request memoization. Mirrors the page component's
 * own `notFound()` for an unknown CRS. */
export async function generateMetadata({ params }: { params: Promise<{ crs: string }> }): Promise<Metadata> {
  const { crs } = await params;
  // `/stations/a-z` and `/stations/k`: the A to Z of stations, never a code.
  if (isStationBrowseSegment(crs)) return stationBrowseMetadata(crs);
  redirectToUpperCase(crs);

  const lookup = await lookupStation(crs);
  if (lookup.outcome === 'unknown') {
    notFound();
  }

  const heading = lookup.outcome === 'found' ? `${lookup.name} (${crs})` : crs;
  // Real facts when the station's data has them (its train companies, where
  // its trains go, its step-free category, its platforms), the evergreen
  // generic line when it has none. All three reads are hour-cached and
  // shared with the page.
  const [timetable, facts, tocs] = await Promise.all([
    fetchStationTimetable(crs),
    readStationFacts(crs),
    getAllTocs().catch(() => []),
  ]);
  const tocNames = new Map(tocs.map((toc) => [toc.code, toc.name]));
  const description = stationDescription(heading, timetable, facts, (code) => tocNames.get(code));
  // The live state goes in the preview image (`card.png`), its URL versioned
  // by it. Read through the image route's own shared, minute-cached entry
  // (`getPreviewStopPointDisruption`), not the page's per-visitor read: Next
  // doesn't dedupe `generateMetadata`'s fetches with the page's here, so
  // that would be a second api call per view, and this way the version and
  // the image come from the same data. An outage leaves the URL unversioned
  // rather than failing the page's metadata.
  const state = await previewDisruptionState(crs);
  return pageMetadata(heading, description, {
    path: `/stations/${crs}`,
    image: stationPreviewImage(crs, heading, state, previewImageAlt(heading)),
  });
}

/** The station's disruptions as its preview card reads them, or null when
 * they can't be read. */
async function previewDisruptionState(crs: string): Promise<StationDisruptionState | null> {
  try {
    return { coverage: 'covered', reports: await getPreviewStopPointDisruption(crs) };
  } catch (err) {
    return err instanceof ApiNotFoundError ? { coverage: 'none' } : null;
  }
}

/** A section, folded under its own heading while the departures board is
 * showing (it pushes the rest of the page down), as it always was otherwise. */
function Foldable({ folded, title, children }: { folded: boolean; title: string; children: ReactNode }) {
  return folded ? <StationFold title={title}>{children}</StationFold> : <>{children}</>;
}

export default async function StationDisruptionPage({
  params,
  searchParams,
}: {
  params: Promise<{ crs: string }>;
  searchParams?: Promise<{ operator?: string | string[]; board?: string | string[] }>;
}) {
  const { crs } = await params;
  const query = await searchParams;
  const requestedOperator = parseOperatorParam(query?.operator);
  const boardKind = parseBoardParam(query?.board);
  if (crs === STATION_INDEX_SEGMENT) return <StationBrowseIndex />;
  if (isStationBrowseSegment(crs)) return <StationLetterPage letter={crs} />;
  redirectToUpperCase(crs);

  // Deliberately awaited before the disruption fetch rather than in
  // parallel with it: `getStationName` is an hour-cached reference lookup,
  // so the serialization costs nothing in the common case, and an unknown
  // code should 404 without ever asking for its (empty) disruption list.
  const lookup = await lookupStation(crs);
  if (lookup.outcome === 'unknown') {
    notFound();
  }

  const [
    { reports, coverage },
    preferences,
    sampleStatsResult,
    accessibilityResult,
    tocs,
    tramLinks,
    origin,
    timetable,
    boardResult,
  ] = await Promise.all([
    fetchStationDisruptions(crs),
    // Per-user, so it fails closed to "nothing pinned" (the shape a 401
    // already returns) rather than being stale-served. The pin button reads as unpinned during an outage.
    getPreferences().catch(() => NO_PREFERENCES),
    fetchStationSampleStats(crs),
    fetchStationAccessibility(crs),
    // Hour-cached reference data used only to label operator rows in the
    // sample-stats section below; an empty list degrades to bare ATOC
    // codes rather than the whole page -- same pattern as
    // app/lines/page.tsx's own getAllTocs() call.
    getAllTocs().catch(() => []),
    // Tram stops to change to (transit spec §12.1); empty while no tram
    // network is served, and never throws.
    getTransitRailLinks(crs),
    // For the structured data's absolute URLs.
    structuredDataOrigin(),
    // Today's timetable facts, cached for an hour (see the function);
    // run alongside the reads above so it adds no round trip.
    fetchStationTimetable(crs),
    // The departures board; `null` when the api has none (see the function).
    fetchStationBoardFor(crs, requestedOperator ?? undefined, boardKind),
  ]);
  const { board, operator } = boardResult;
  // A filtered board only lists its own operator, so the picker's choices
  // come from the unfiltered one (the same cached read the board makes
  // without a filter).
  const boardOperators: OperatorOption[] =
    board === null
      ? []
      : operatorOptions(
          boardRowsOf(operator === null ? board : ((await fetchStationBoard(crs, undefined, boardKind)) ?? board)),
        );
  const heading = lookup.outcome === 'found' ? `${lookup.name} (${crs})` : crs;
  // The page shows no departures itself: "Departures" goes to the train
  // search, pre-filled with this station.
  const departuresHref = stationDeparturesHref(crs);

  // Stamped once for the whole page (all per-line IssueLists share it) so
  // their buckets don't depend on a `Date.now()` that differs between the
  // SSR pass and hydration. Fresh on every request (this route is dynamic)
  // and re-stamped by AutoRefresh.
  // eslint-disable-next-line react-hooks/purity -- server component: one timestamp per request, passed down so SSR and hydration agree
  const now = Date.now();

  const items = dedupeStationIssues(reports);
  // Worst first, then alphabetical — the previous order was whatever the
  // API iterated, which visibly differed between viewports on the same data.
  const orderedReports = [...reports].sort((a, b) => {
    const rankDiff = severityRank(worstStatus(b).statusSeverity) - severityRank(worstStatus(a).statusSeverity);
    return rankDiff !== 0 ? rankDiff : a.name.localeCompare(b.name);
  });

  const stationName = lookup.outcome === 'found' ? lookup.name : null;
  const facts = accessibilityResult.coverage === 'present' ? stationFacts(accessibilityResult.data) : null;

  const hasAbout = stationName !== null && facts !== null && factSentences(stationName, facts).length > 0;
  // With the board on top, the sections below it fold: they open from the
  // "On this page" row and from a URL hash (`StationFold`).
  const folded = board !== null;

  // The "On this page" row: the sections that exist for this station.
  const pageLinks = [
    ...(hasAbout ? [{ href: '#about', label: 'About' }] : []),
    { href: '#disruptions', label: 'Disruptions' },
    ...(stationName !== null && timetable !== null ? [{ href: '#timetable', label: 'Trains today' }] : []),
    { href: '#stats', label: 'Stats' },
    { href: board !== null ? '#board' : departuresHref, label: 'Departures' },
    { href: '#accessibility', label: 'Accessibility & facilities' },
  ];

  // Same code-to-name resolution AllLinesTable.tsx:81 already establishes,
  // falling back to the bare ATOC code when `tocs` (hour-cached, fed by an
  // independent poller from `station_samples`) has no match.
  const tocNameByCode = new Map(tocs.map((toc) => [toc.code, toc.name]));

  return (
    <Stack p="lg" gap="md">
      {/* A `<script>` is `display: none`, so it takes no flex gap. Only for
          a station the lookup named: structured data with a bare code for
          a name would say less than the page. Coordinates (`geo`) once a
          station read carries them. */}
      {lookup.outcome === 'found' && origin !== null && (
        <JsonLd data={stationJsonLd({ origin, crs, name: lookup.name })} />
      )}
      <Group justify="space-between">
        {/* The heading matches `generateMetadata`'s title form; the "On this page" row below restores the
            page's framing (what it is for) as navigation rather than prose, since most of the page is
            accessibility and facilities content with no other way to jump to it. Not a tabs rewrite:
            accessibility stays last. */}
        <Title order={1}>{heading}</Title>
        <Group gap="md">
          <TextLink href={`/track?origin=${crs}`}>Track a train from here</TextLink>
          <TextLink href={`/plan?origin=${crs}`}>Plan a journey from here</TextLink>
          <PinToggle
            kind="station"
            id={crs}
            name={heading}
            initiallyPinned={preferences.pinnedStations.includes(crs)}
          />
          <ShareButton />
        </Group>
      </Group>

      <Group component="nav" aria-label="On this page" gap="sm" c="dimmed" fz="sm">
        {pageLinks.map((link, index) => (
          <Fragment key={link.href}>
            {index > 0 && (
              <Text span c="dimmed">
                ·
              </Text>
            )}
            <TextLink href={link.href} underline="always" inline>
              {link.label}
            </TextLink>
          </Fragment>
        ))}
      </Group>

      {/* Departures first: what most visitors came for. Only when the api
          answered with a board. */}
      {board !== null && (
        <>
          <StationBoard
            board={board}
            crs={crs}
            fallbackName={stationName ?? crs}
            operator={operator}
            operators={boardOperators}
          />
          <Divider />
        </>
      )}

      <StationTramLinks links={tramLinks} />

      {/* Prose from the station's own data, server-rendered; the named stations only (a bare code would say
          less than the heading). */}
      {stationName !== null && (
        <Foldable folded={folded && hasAbout} title={`About ${stationName}`}>
          <StationAbout name={stationName} facts={facts} />
        </Foldable>
      )}

      {/* Two different absences, said honestly rather than collapsed into
          one cheerful "no disruptions" that would just as easily describe a
          station we've never modelled at all (see fetchStationDisruptions's doc comment above). Wrapped with
          the reports list below in one `id="disruptions"` container, the "On this page" row's jump target. */}
      <Stack gap="md" id="disruptions">
        {coverage === 'none' && (
          <Text c="dimmed">This station isn&apos;t covered by our line-status tracking yet.</Text>
        )}
        {coverage === 'covered' && reports.length === 0 && (
          <Text c="dimmed">No disruptions affecting this station.</Text>
        )}

        {orderedReports.length > 0 && (
          <>
            <Divider />
            {/* Per-line attribution, once — replacing three full copies of
                the same filter block, tab bar and issue list. The headings
                are links now, which the review asked for and the previous
                plain `Text` headings weren't. */}
            <LineStatusRowList label="Lines at this station" columns={2}>
              {orderedReports.map((report) => (
                <LineStatusRowItem key={report.id}>
                  <LineStatusRow
                    href={`/lines/${report.id}`}
                    name={report.name}
                    badge={<StatusBadge severity={worstStatus(report).statusSeverity} />}
                  >
                    <Text size="xs" c="dimmed">
                      {formatSampleSummary(representativeStatus(report.lineStatuses))}
                    </Text>
                  </LineStatusRow>
                </LineStatusRowItem>
              ))}
            </LineStatusRowList>
            <Divider />
            <IssueList items={items} now={now} subject="station" urlPrefix="issue" />
          </>
        )}

        {/* Info only, placed through the same lines as the disruptions
            above; hidden when empty. */}
        <Suspense fallback={null}>
          {folded ? (
            <FoldedRecentlyCleared crs={crs} now={now} />
          ) : (
            <RecentlyCleared scope={{ station: crs }} now={now} showLines />
          )}
        </Suspense>
      </Stack>

      {stationName !== null && (
        <>
          {timetable !== null && <Divider />}
          <Foldable folded={folded && timetable !== null} title={`Trains from ${stationName} today`}>
            <StationTimetableSection
              crs={crs}
              name={stationName}
              timetable={timetable}
              nameOf={(code) => tocNameByCode.get(code)}
            />
          </Foldable>
        </>
      )}

      {/* Sample stats by operator -- an independent block from the
          disruption section above, keyed by LDBWS live-sampling coverage rather than line-status-catalogue
          coverage. Three honest states, mirroring the disruption section's own coverage-vs-empty split. */}
      <Divider />
      <Foldable folded={folded} title="Sample stats by operator">
        <Stack gap="xs" id="stats">
          <SectionTitle>Sample stats by operator</SectionTitle>
          {sampleStatsResult.coverage === 'not-sampled' && (
            <Text c="dimmed">This station isn&apos;t part of our live departure sampling.</Text>
          )}
          {sampleStatsResult.coverage === 'sampled' && sampleStatsResult.operatorStats.length === 0 && (
            <Text c="dimmed">No live departures currently recorded at this station.</Text>
          )}
          {sampleStatsResult.coverage === 'sampled' &&
            sampleStatsResult.operatorStats.map((entry) => (
              <Group key={entry.operator} justify="space-between" wrap="nowrap" gap="sm">
                <Text size="sm">{tocNameByCode.get(entry.operator) ?? entry.operator}</Text>
                <Text size="xs" c="dimmed">
                  {formatSampleSummary(entry)}
                </Text>
              </Group>
            ))}
          {/* LEG-23: these figures come from National Rail's live departure
            boards (LDBWS), so the National Rail credit sits right under
            them. */}
          {sampleStatsResult.coverage === 'sampled' && <NationalRailCredit />}
        </Stack>
      </Foldable>

      <Divider />
      {/* No board here: departures live on the train search. The id stays
          so an old `#departures` link still lands on the way there. */}
      <Stack gap="xs" id="departures">
        <SectionTitle>Departures</SectionTitle>
        <TextLink href={departuresHref}>See departures from {lookup.outcome === 'found' ? lookup.name : crs}</TextLink>
      </Stack>

      {/* Accessibility & facilities: a fourth independent block, keyed by whether this app has any `stations`
          reference row for this CRS at all. Headed "Accessibility & facilities" rather than bare
          "Accessibility", which in this codebase means WCAG. */}
      <Divider />
      <Foldable folded={folded} title="Accessibility & facilities">
        <div id="accessibility">
          <StationAccessibilitySection result={accessibilityResult} />
        </div>
      </Foldable>
      {/* The station's information is Knowledgebase Stations' and its
          lines' status is worked out from Darwin and TRUST (or is TfL's):
          the credits sit under the last of it. */}
      <DataCredits credits={['national-rail', ...lineCredits(orderedReports.map((report) => report.id))]} />
    </Stack>
  );
}
