import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithMantine } from '@/test/render';
import { RegularPlanCard } from './RegularPlanCard';
import type { RegularPlan, RegularPlanOption } from '@/lib/types';

const refreshMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: refreshMock }),
  usePathname: () => '/journeys/9',
  useSearchParams: () => new URLSearchParams(''),
}));

/** A direct train Woking to London Waterloo; times are UTC (BST is +1). */
function option(uid: string, departs: string, arrives: string): RegularPlanOption {
  const departure = `2026-11-10T${departs}:00Z`;
  const arrival = `2026-11-10T${arrives}:00Z`;
  return {
    departure,
    arrival,
    changeCount: 0,
    legs: [
      {
        kind: 'train',
        trainUid: uid,
        serviceDate: '2026-11-10',
        originCrs: 'WOK',
        originName: 'Woking',
        destinationCrs: 'WAT',
        destinationName: 'London Waterloo',
        departure,
        arrival,
        operator: 'SW',
        operatorName: 'South Western Railway',
      },
    ],
  };
}

const usual = option('W00002', '08:12', '08:45');

function plan(overrides: Partial<RegularPlan> = {}): RegularPlan & { choice: RegularPlanOption } {
  return {
    status: 'suggested',
    plannedAt: '2026-11-09T18:00:00Z',
    reason: 'usual',
    choice: usual,
    alternatives: [option('W00001', '07:50', '08:30'), { ...option('W00004', '08:40', '09:10'), changeCount: 1 }],
    acceptedIndex: null,
    ...overrides,
  } as RegularPlan & { choice: RegularPlanOption };
}

describe('RegularPlanCard', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    refreshMock.mockClear();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('offers the usual train first, then the others', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('{}', { status: 200 }));
    renderWithMantine(<RegularPlanCard journeyId={9} serviceDate="2026-11-10" plan={plan()} />);

    expect(
      screen.getByRole('heading', { level: 2, name: 'Your usual train: 08:12 Woking to London Waterloo' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Arrives 08:45')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Other trains' })).toBeInTheDocument();
    expect(screen.getByText('Arrives 09:10, 1 change')).toBeInTheDocument();
    expect(screen.queryByText(/doesn't run/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Track this train' }));
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
    expect(fetch).toHaveBeenCalledWith(
      '/api/Journeys/9/regular-plan/accept',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ index: 0, plannedAt: '2026-11-09T18:00:00Z' }),
      }),
    );
  });

  it('tracks another train by its place in the list', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('{}', { status: 200 }));
    renderWithMantine(<RegularPlanCard journeyId={9} serviceDate="2026-11-10" plan={plan()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Track this train, the 08:40 Woking to London Waterloo' }));
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
    expect(fetch).toHaveBeenCalledWith(
      '/api/Journeys/9/regular-plan/accept',
      expect.objectContaining({ body: JSON.stringify({ index: 2, plannedAt: '2026-11-09T18:00:00Z' }) }),
    );
  });

  it("says when the usual train doesn't run and offers the closest", () => {
    renderWithMantine(
      <RegularPlanCard
        journeyId={9}
        serviceDate="2026-11-10"
        plan={plan({ reason: 'best', choice: option('W00003', '08:10', '08:40'), alternatives: [] })}
      />,
    );
    expect(
      screen.getByRole('heading', { level: 2, name: 'Closest train: 08:10 Woking to London Waterloo' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Your usual train doesn't run on 10 Nov 2026\. This is the closest\./)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Other trains' })).not.toBeInTheDocument();
  });

  it("shows the api's refusal when the plan changed", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response("This journey's plan changed; reload the journey.", { status: 409 }),
    );
    renderWithMantine(<RegularPlanCard journeyId={9} serviceDate="2026-11-10" plan={plan()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Track this train' }));
    expect(await screen.findByText("This journey's plan changed; reload the journey.")).toBeInTheDocument();
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it('describes a network failure', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('offline'));
    renderWithMantine(<RegularPlanCard journeyId={9} serviceDate="2026-11-10" plan={plan()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Track this train' }));
    expect(await screen.findByText(/^Couldn't track this train\./)).toBeInTheDocument();
  });
});
