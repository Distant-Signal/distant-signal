import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { renderWithMantine } from '@/test/render';
import { JourneyDetailView } from './JourneyDetailView';
import { journeyDetail, trainLeg, untrackedLeg } from '@/test/journeyFixtures';
import { testLegId } from '@/test/apiDefaults';
import { openBreakSummary } from '@/test/replanFixtures';
import type { JourneyDetail, JourneyLegDetail } from '@/lib/types';

/* DS-590: a walk or transfer with nothing to act on folds into one row,
 * closed until the traveller opens it. */

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/journeys/42',
  useSearchParams: () => new URLSearchParams(''),
}));

const KGX: [string, string] = ['KGX', 'London Kings Cross'];
const EUS: [string, string] = ['EUS', 'London Euston'];
const YRK: [string, string] = ['YRK', 'York'];
const NCL: [string, string] = ['NCL', 'Newcastle'];

const first = () => trainLeg(1, EUS, KGX, '2026-09-17T07:00:00Z', '2026-09-17T07:30:00Z');
const second = () => trainLeg(3, KGX, YRK, '2026-09-17T07:50:00Z', '2026-09-17T09:00:00Z');
const walk = (id: number, overrides: Partial<JourneyLegDetail> = {}) =>
  untrackedLeg(id, 'Euston', 'Kings Cross', '2026-09-17T07:32:00Z', '2026-09-17T07:38:00Z', {
    transitMode: 'walk',
    lineName: null,
    ...overrides,
  });

function renderView(legs: JourneyLegDetail[], overrides: Partial<JourneyDetail> = {}) {
  return renderWithMantine(
    <JourneyDetailView
      journey={{ ...journeyDetail(42, legs), ...overrides }}
      fetchedAt="2026-09-17T06:00:00Z"
      origin="https://example.test"
    />,
  );
}

describe('JourneyDetailView walking legs', () => {
  it('folds a walk between two trains into one closed row that says where and how long', () => {
    renderView([first(), walk(2), second()]);
    const toggle = screen.getByRole('button', { name: 'Walk to Kings Cross, 6 min' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    // The walk's own card stays out of sight until it is opened.
    const leg = document.getElementById(`leg-${testLegId(2)}`) as HTMLElement;
    expect(within(leg).getByText('Walk')).not.toBeVisible();
    // The change over the whole connection, train to train.
    expect(screen.getByText('20 min to change.')).toBeVisible();
    // Only the trains are numbered.
    expect(screen.getByText('Leg 1 of 2')).toBeInTheDocument();
    expect(screen.getByText('Leg 2 of 2')).toBeInTheDocument();
    expect(screen.queryByText(/Leg 3/)).not.toBeInTheDocument();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(within(leg).getByText('Walk')).toBeVisible();
  });

  it('folds a walk at the start and one at the end', () => {
    renderView([
      walk(1, { plannedDeparture: '2026-09-17T06:50:00Z', plannedArrival: '2026-09-17T06:58:00Z' }),
      second(),
      walk(4),
    ]);
    expect(screen.getAllByRole('button', { name: /^Walk to Kings Cross/ })).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Walk to Kings Cross, 8 min' })).toBeInTheDocument();
  });

  it('adds a run of walks up into one row', () => {
    renderView([
      first(),
      walk(2, { destinationName: 'Euston Square', plannedArrival: '2026-09-17T07:36:00Z' }),
      walk(5, {
        transitMode: 'transfer',
        originName: 'Euston Square',
        plannedDeparture: '2026-09-17T07:36:00Z',
        plannedArrival: '2026-09-17T07:42:00Z',
      }),
      second(),
    ]);
    expect(screen.getByRole('button', { name: 'Walk and transfer to Kings Cross, 10 min' })).toBeInTheDocument();
  });

  it('shows a journey of nothing but walks as it is', () => {
    renderView([walk(1), walk(2)]);
    expect(screen.queryByRole('button', { name: /^Walk to/ })).not.toBeInTheDocument();
    expect(screen.getAllByText('Walk')[0]).toBeVisible();
  });

  it('keeps a Tube ride, a walk underway and a walk with a ticket in view', () => {
    renderView([
      first(),
      walk(2, { transitMode: 'tube', lineName: 'Victoria line' }),
      walk(5, { untrackedStatus: 'inProgress' }),
      walk(6, { ticket: {} as JourneyLegDetail['ticket'] }),
      second(),
    ]);
    expect(screen.queryByRole('button', { name: /^Walk to/ })).not.toBeInTheDocument();
    expect(screen.getByText('Tube: Victoria line')).toBeVisible();
  });

  it("keeps the open break's trigger leg in view", () => {
    renderView([first(), walk(2), second(), trainLeg(4, YRK, NCL, '2026-09-17T09:30:00Z', '2026-09-17T10:30:00Z')], {
      openBreak: openBreakSummary({ triggerLegId: 2, triggerLegPublicId: testLegId(2) }),
    });
    expect(screen.queryByRole('button', { name: /^Walk to/ })).not.toBeInTheDocument();
  });

  it('keeps the connector between two trains with nothing between them', () => {
    renderView([first(), second()]);
    expect(screen.getByText(/Change at London Kings Cross/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Walk/ })).not.toBeInTheDocument();
  });
});
