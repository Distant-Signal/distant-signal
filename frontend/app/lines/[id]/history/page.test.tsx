import { describe, it, expect, beforeAll, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithMantine } from '@/test/render';
import LineHistoryPage, { generateMetadata, HistoryResults } from './page';
import * as api from '@/lib/api';
import type { LineStatusReport, LineDailyStats } from '@/lib/types';
import { formatDate } from '@/lib/dateFormat';

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return {
    ...actual,
    getLineStatus: vi.fn(),
    getLineStatusHistory: vi.fn(),
    getHistoryRetention: vi.fn(),
    getLineDailyStats: vi.fn(),
    getLineDailyCoverageStats: vi.fn(),
  };
});
// `notFound` mocked as a no-op (the real one throws a Next-internal,
// digest-carrying error that only framework machinery above the page
// recognises) -- same convention `app/lines/[id]/page.test.tsx`/
// `app/journeys/[id]/page.test.tsx` already use for the same function.
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }), notFound: vi.fn() }));
// Same rationale as TrendsResults.test.tsx's own mock -- this repo's
// convention is not to assert on Recharts' SVG output.
vi.mock('@mantine/charts', () => ({
  LineChart: () => <div data-testid="line-chart" />,
  BarChart: () => <div data-testid="bar-chart" />,
}));

function report(id: string, name: string): LineStatusReport {
  return {
    $type: 'DistantSignal.LineStatusReport',
    attribution: [],
    id,
    name,
    modeName: 'national-rail',
    operators: ['CC'],
    computedAt: '2026-08-31T09:00:00Z',
    lineStatuses: [],
  };
}

function dailyStatsRow(overrides: Partial<LineDailyStats> = {}): LineDailyStats {
  return {
    day: '2026-08-30',
    sampleCycles: 500,
    total: 100,
    delayed: 10,
    cancelled: 2,
    skipped: 1,
    avgDelayMinutes: 3.5,
    delayRate: 0.1,
    cancellationRate: 0.02,
    skipRate: 0.01,
    ...overrides,
  };
}

async function renderPage(searchParams: { from?: string; to?: string; range?: string } = {}) {
  const element = await LineHistoryPage({
    params: Promise.resolve({ id: 'c2c' }),
    searchParams: Promise.resolve(searchParams),
  });
  return renderWithMantine(element);
}

// Regression coverage for the actual "/lines/[id]/history currently does
// not work" bug: this page is an async Server Component, and Mantine's
// `Tabs` carries a `"use client"` directive -- reaching its `List`/`Tab`/
// `Panel` sub-components via the `Tabs.List`/`Tabs.Tab`/`Tabs.Panel`
// dot-notation compound API (rather than the flat `TabsList`/`TabsTab`/
// `TabsPanel` named exports `page.tsx` now uses) resolved to `undefined`
// once Next actually compiled the Server/Client boundary, 500ing the whole
// route with "Element type is invalid ... got: undefined". This was
// confirmed live against a running dev server (`next dev`/`next build`),
// not caught by this file alone -- jsdom + `@testing-library/react`
// render everything as one ordinary client tree and never enforce that
// boundary, so these tests would pass identically against either form of
// the JSX. They're kept anyway as basic regression coverage for the page's
// rendering logic (which was previously completely untested), not as a
// substitute for the live check.
// TrendsCharts loads its Recharts half on demand (next/dynamic); load it once
// up front so the first chart assertion isn't timed against a cold import.
beforeAll(async () => {
  await import('@/app/lines/[id]/history/TrendsChartParts');
});

describe('LineHistoryPage', () => {
  beforeEach(() => {
    vi.mocked(api.getLineStatus).mockResolvedValue([report('c2c', 'c2c (London, Tilbury & Southend line)')]);
    vi.mocked(api.getHistoryRetention).mockResolvedValue({
      historyRetentionDays: 7,
      dailyStatsRetentionDays: 300,
      halfHourlyStatsRetentionHours: 840,
    });
    vi.mocked(api.getLineStatusHistory).mockResolvedValue([]);
    vi.mocked(api.getLineDailyStats).mockResolvedValue([]);
    vi.mocked(api.getLineDailyCoverageStats).mockResolvedValue([]);
  });

  it('renders both tabs, defaulting to Timeline, with no crash', async () => {
    await renderPage();
    expect(screen.getByRole('tab', { name: 'Timeline', selected: true })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Trends' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to line' })).toHaveAttribute('href', '/lines/c2c');
  });

  // Finding 3 of the 2026-09-24 security review: a malformed id (a `../`
  // segment, an embedded `?`/`#`) used to reach `getLineStatus`/
  // `getLineStatusHistory` completely unvalidated. This page has no
  // existing "id doesn't exist" render of its own to reuse -- `notFound()`
  // is the fallback, same convention `app/lines/[id]/page.tsx`'s own
  // identical check uses.
  it('calls notFound() for a malformed id, before this page renders anything', async () => {
    const { notFound } = await import('next/navigation');
    vi.mocked(notFound).mockClear();
    await LineHistoryPage({
      params: Promise.resolve({ id: '../evil' }),
      searchParams: Promise.resolve({}),
    });
    expect(notFound).toHaveBeenCalled();
  });

  // The Timeline panel's Suspense fallback must have an accessible name, so a screen reader announces
  // something while `getLineStatusHistory` is in flight. A call that never resolves keeps the boundary
  // suspended for the life of the test, so the fallback content can be asserted on directly.
  it('shows a labelled, announced loading state while the Timeline fetch is pending', async () => {
    vi.mocked(api.getLineStatusHistory).mockReturnValue(new Promise(() => {}));
    await renderPage();

    const fallback = await screen.findByRole('status');
    expect(fallback).toHaveTextContent('Loading history');
    expect(fallback).toHaveAttribute('aria-busy', 'true');
  });

  // Style-guide review: the Trends tab's two chart fallbacks were still
  // bare `Skeleton`s. Both now carry a visible, announced label, with the
  // 320px skeleton kept (aria-hidden) to hold the chart's space.
  it('shows labelled, announced loading states while the Trends tab fetches are pending', async () => {
    vi.mocked(api.getLineDailyStats).mockReturnValue(new Promise(() => {}));
    vi.mocked(api.getLineDailyCoverageStats).mockReturnValue(new Promise(() => {}));
    await renderPage();
    fireEvent.click(screen.getByRole('tab', { name: 'Trends' }));

    const statuses = await screen.findAllByRole('status');
    const labels = statuses.map((s) => s.textContent);
    expect(labels).toContain('Loading trends');
    expect(labels).toContain('Loading trends for every train');
    for (const status of statuses) {
      expect(status).toHaveAttribute('aria-busy', 'true');
    }
  });

  it('switching to the Trends tab renders the daily-stats charts without crashing', async () => {
    vi.mocked(api.getLineDailyStats).mockResolvedValue([
      dailyStatsRow({ day: '2026-08-30' }),
      dailyStatsRow({ day: '2026-08-31' }),
    ]);
    await renderPage();

    fireEvent.click(screen.getByRole('tab', { name: 'Trends' }));

    expect(await screen.findAllByTestId('line-chart')).toHaveLength(2);
  });

  // A 7-day range is 7*48=336 half-hour buckets, over the MAX_CHART_POINTS=200 ceiling, so `halfHour` is
  // excluded for the default preset (see `lib/history.ts`). A narrow 12-hour custom range is used here so
  // that all four tiers are available.
  it('the Trends tab shows a granularity control offering all four tiers for a narrow range', async () => {
    vi.mocked(api.getLineDailyStats).mockResolvedValue([dailyStatsRow({ day: '2026-08-30' })]);
    await renderPage({ from: '2026-08-31T00:00:00Z', to: '2026-08-31T12:00:00Z' });
    fireEvent.click(screen.getByRole('tab', { name: 'Trends' }));
    for (const label of ['30 min', 'Hourly', '6-hourly', 'Daily']) {
      expect(await screen.findByText(label)).toBeInTheDocument();
    }
  });

  it('a very wide custom range hides the sub-daily tiers and still renders the daily chart', async () => {
    vi.mocked(api.getLineDailyStats).mockResolvedValue([dailyStatsRow({ day: '2026-01-01' })]);
    await renderPage({ from: '2025-01-01T00:00:00Z', to: '2026-08-21T00:00:00Z' });
    fireEvent.click(screen.getByRole('tab', { name: 'Trends' }));
    expect(await screen.findByText('Daily')).toBeInTheDocument();
    expect(screen.queryByText('30 min')).not.toBeInTheDocument();
    expect(screen.getByText(/not available for this range/)).toBeInTheDocument();
  });

  it('switching to the Trends tab with no daily stats yet shows the sane fallback, not a crash', async () => {
    await renderPage();

    fireEvent.click(screen.getByRole('tab', { name: 'Trends' }));

    expect(await screen.findByText('Not enough sampled data yet for this line.')).toBeInTheDocument();
  });

  it('renders a Timeline per-day header at h2, one level below this page\'s only h1 ("History: {name}")', async () => {
    // Awaits HistoryResults directly rather than rendering LineHistoryPage
    // and waiting on its Suspense boundary -- see HistoryResults' own doc
    // comment in page.tsx for why (this harness has no RSC runtime, so that
    // Suspense boundary never settles here). Reuses report()'s default computedAt ('2026-08-31T09:00:00Z').
    vi.mocked(api.getLineStatusHistory).mockResolvedValue([report('c2c', 'c2c (London, Tilbury & Southend line)')]);
    renderWithMantine(
      await HistoryResults({
        id: 'c2c',
        from: '2026-08-26T00:00:00Z',
        to: '2026-09-02T00:00:00Z',
        preset: '7d',
        basePath: '/lines/c2c/history',
      }),
    );

    expect(screen.getByRole('heading', { name: formatDate('2026-08-31T09:00:00Z'), level: 2 })).toBeInTheDocument();
  });

  // The timezone note appears once for the whole Timeline section, not once per row; entries span two
  // days (two day groups) so a per-row or per-day regression would be caught.
  it('states the UK-local-time note exactly once across multiple days of rows', async () => {
    vi.mocked(api.getLineStatusHistory).mockResolvedValue([
      report('c2c', 'c2c (London, Tilbury & Southend line)'),
      { ...report('c2c', 'c2c (London, Tilbury & Southend line)'), computedAt: '2026-08-30T09:00:00Z' },
    ]);
    renderWithMantine(
      await HistoryResults({
        id: 'c2c',
        from: '2026-08-26T00:00:00Z',
        to: '2026-09-02T00:00:00Z',
        preset: '7d',
        basePath: '/lines/c2c/history',
      }),
    );

    expect(screen.getAllByText('Times in UK local time')).toHaveLength(1);
  });

  // "recompute" is the aggregator's internal word, not a sentence a passenger would recognise.
  it('describes entries as status changes, not internal "recompute"s', async () => {
    vi.mocked(api.getLineStatusHistory).mockResolvedValue([
      report('c2c', 'c2c (London, Tilbury & Southend line)'),
      { ...report('c2c', 'c2c (London, Tilbury & Southend line)'), computedAt: '2026-08-30T09:00:00Z' },
    ]);
    renderWithMantine(
      await HistoryResults({
        id: 'c2c',
        from: '2026-08-26T00:00:00Z',
        to: '2026-09-02T00:00:00Z',
        preset: '7d',
        basePath: '/lines/c2c/history',
      }),
    );

    expect(screen.getByText(/2 status changes across/)).toBeInTheDocument();
    expect(screen.queryByText(/recompute/)).not.toBeInTheDocument();
  });

  // A status whose `reason` is just its severity label reads as redundant next to the row's StatusBadge
  // ("GOOD SERVICE Good Service 21:34").
  it('does not echo the severity label back as the reason text', async () => {
    vi.mocked(api.getLineStatusHistory).mockResolvedValue([
      {
        ...report('c2c', 'c2c (London, Tilbury & Southend line)'),
        lineStatuses: [
          {
            statusSeverity: 10,
            statusSeverityDescription: 'Good Service',
            reason: 'Good Service',
            dataQuality: 'knowledgebase',
            validityPeriods: [],
            sampleAvailability: { state: 'no-coverage' },
            fullCoverageAvailability: { state: 'not-enabled' },
          },
        ],
      },
    ]);
    renderWithMantine(
      await HistoryResults({
        id: 'c2c',
        from: '2026-08-26T00:00:00Z',
        to: '2026-09-02T00:00:00Z',
        preset: '7d',
        basePath: '/lines/c2c/history',
      }),
    );

    expect(screen.getByText('No incidents reported')).toBeInTheDocument();
    expect(screen.queryByText('Good Service', { selector: '.issueRow__reason' })).not.toBeInTheDocument();
  });

  // A genuinely empty reason is a different fact (none was supplied at
  // all) and must keep its own, distinct copy rather than collapsing into
  // the redundancy-only "No incidents reported" text above.
  it('still says "No reason given" for a genuinely empty reason', async () => {
    vi.mocked(api.getLineStatusHistory).mockResolvedValue([report('c2c', 'c2c (London, Tilbury & Southend line)')]);
    renderWithMantine(
      await HistoryResults({
        id: 'c2c',
        from: '2026-08-26T00:00:00Z',
        to: '2026-09-02T00:00:00Z',
        preset: '7d',
        basePath: '/lines/c2c/history',
      }),
    );

    expect(screen.getByText('No reason given')).toBeInTheDocument();
  });

  // This Suspense boundary catches suspension, not errors: an unguarded throw used to reach the route's
  // global error.tsx and blank the page title, "Back to line" link, Period control and both tabs. Any
  // fetch failure must now resolve to real markup.
  it('resolves to a Paper instead of throwing when the history fetch fails', async () => {
    vi.mocked(api.getLineStatusHistory).mockRejectedValue(new Error('connect ECONNREFUSED'));
    renderWithMantine(
      await HistoryResults({
        id: 'lner-ecml',
        from: '2026-08-26T00:00:00Z',
        to: '2026-09-02T00:00:00Z',
        preset: '7d',
        basePath: '/lines/lner-ecml/history',
      }),
    );

    const text = screen.getByText("Couldn't load this line's history right now.");
    expect(text).toBeInTheDocument();
    expect(text.closest('.mantine-Paper-root')).not.toBeNull();
  });

  // "No history entries in that range." used to be a dead end, with no link to the one control (the
  // Period picker) that would change the answer.
  it('offers a "Try 30 days" way out of an empty range, when not already viewing 30 days', async () => {
    vi.mocked(api.getLineStatusHistory).mockResolvedValue([]);
    renderWithMantine(
      await HistoryResults({
        id: 'cross-country',
        from: '2026-08-26T00:00:00Z',
        to: '2026-09-02T00:00:00Z',
        preset: '7d',
        basePath: '/lines/cross-country/history',
      }),
    );

    expect(screen.getByText('No history entries in that range.')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: '30 days' });
    expect(link).toHaveAttribute('href', '/lines/cross-country/history?range=30d');
  });

  it('withholds the "Try 30 days" suggestion once 30 days is already the active preset', async () => {
    vi.mocked(api.getLineStatusHistory).mockResolvedValue([]);
    renderWithMantine(
      await HistoryResults({
        id: 'cross-country',
        from: '2026-08-03T00:00:00Z',
        to: '2026-09-02T00:00:00Z',
        preset: '30d',
        basePath: '/lines/cross-country/history',
      }),
    );

    expect(screen.getByText('No history entries in that range.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '30 days' })).not.toBeInTheDocument();
  });
});

describe('generateMetadata', () => {
  it('is crawlable but never indexed: a date-range view', async () => {
    vi.mocked(api.getLineStatus).mockRejectedValue(new Error('down'));
    const metadata = await generateMetadata({ params: Promise.resolve({ id: 'wcml' }) });
    expect(metadata.robots).toEqual({ index: false, follow: true });
  });
});
