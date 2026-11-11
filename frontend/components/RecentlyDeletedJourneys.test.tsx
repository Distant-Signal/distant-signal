import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { renderWithMantine } from '@/test/render';
import { RecentlyDeletedJourneys } from './RecentlyDeletedJourneys';
import type { RecentlyDeletedData } from '@/lib/types';

const refreshMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: refreshMock }),
  usePathname: () => '/journeys/recently-deleted',
  useSearchParams: () => new URLSearchParams(''),
}));

const NOW = '2026-11-11T10:00:00Z';

const data: RecentlyDeletedData = {
  retentionDays: 7,
  connectedAppRetentionDays: 30,
  items: [
    {
      id: 7,
      journeyId: 42,
      client: 'web',
      deletedAt: '2026-11-09T09:00:00Z',
      expiresAt: '2026-11-16T09:00:00Z',
      summary: {
        customName: 'Weekend away',
        legs: [
          { kind: 'train', serviceDate: '2026-11-20', originCrs: 'EUS', destinationCrs: 'MKC', trainUid: 'C11052' },
        ],
      },
    },
    {
      id: 8,
      journeyId: 43,
      client: 'ds-mcp',
      deletedAt: '2026-11-01T09:00:00Z',
      expiresAt: '2026-12-01T09:00:00Z',
      summary: {
        customName: null,
        legs: [
          { kind: 'train', serviceDate: '2026-11-21', originCrs: 'KGX', destinationCrs: 'YRK', trainUid: 'L12345' },
        ],
      },
    },
  ],
};

function card(name: string | RegExp): HTMLElement {
  return screen.getByRole('article', { name });
}

describe('RecentlyDeletedJourneys', () => {
  beforeEach(() => {
    refreshMock.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lists each deleted journey with its route, when it was deleted and how long it is kept', () => {
    renderWithMantine(<RecentlyDeletedJourneys data={data} now={NOW} />);
    expect(screen.getByText(/you deleted in the last 7 days/)).toBeInTheDocument();
    expect(screen.getByText(/journeys a connected app deleted after 30 days/)).toBeInTheDocument();
    const own = card('Weekend away');
    expect(within(own).getByText('EUS to MKC, on 20 Nov 2026, train C11052')).toBeInTheDocument();
    expect(within(own).getByText('Deleted 2 days ago. Kept until 16 Nov 2026.')).toBeInTheDocument();
    expect(within(own).getByRole('button', { name: 'Save again' })).toBeInTheDocument();
    expect(within(own).getByRole('button', { name: 'Delete permanently' })).toBeInTheDocument();
    const app = card(/KGX to YRK/);
    expect(within(app).getByText(/Deleted by a connected app 10 days ago\./)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Empty now' })).toBeInTheDocument();
  });

  it('shows an empty state with a way back', () => {
    renderWithMantine(<RecentlyDeletedJourneys data={{ ...data, items: [] }} now={NOW} />);
    expect(screen.getByText(/Nothing deleted in the last 7 days\./)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to journeys' })).toHaveAttribute('href', '/journeys');
    expect(screen.queryByRole('button', { name: 'Empty now' })).toBeNull();
  });

  it('saves a journey again and says which legs need a train', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          journeyId: 99,
          legs: [{ leg: 1, outcome: 'without_train', reason: 'train_gone' }],
        }),
        { status: 201 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    renderWithMantine(<RecentlyDeletedJourneys data={data} now={NOW} />);
    fireEvent.click(within(card('Weekend away')).getByRole('button', { name: 'Save again' }));
    const status = await screen.findByRole('status');
    expect(fetchMock).toHaveBeenCalledWith('/api/Journeys/recently-deleted/7/restore', { method: 'POST' });
    expect(within(status).getByText('Saved Weekend away again.')).toBeInTheDocument();
    expect(
      within(status).getByText("Leg 1's train is no longer available, so pick a train for it."),
    ).toBeInTheDocument();
    expect(within(status).getByRole('link', { name: 'Open the journey' })).toHaveAttribute('href', '/journeys/99');
    expect(refreshMock).toHaveBeenCalled();
  });

  it('says why a save again failed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 500 })));
    renderWithMantine(<RecentlyDeletedJourneys data={data} now={NOW} />);
    fireEvent.click(within(card('Weekend away')).getByRole('button', { name: 'Save again' }));
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't save this journey again. Try again.");
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("shows the api's own sentence for a refusal", async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response("None of this journey's legs can be saved again.", { status: 422 })),
    );
    renderWithMantine(<RecentlyDeletedJourneys data={data} now={NOW} />);
    fireEvent.click(within(card('Weekend away')).getByRole('button', { name: 'Save again' }));
    expect(await screen.findByRole('alert')).toHaveTextContent("None of this journey's legs can be saved again.");
  });

  it('deletes one for good after a confirmation', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    renderWithMantine(<RecentlyDeletedJourneys data={data} now={NOW} />);
    fireEvent.click(within(card('Weekend away')).getByRole('button', { name: 'Delete permanently' }));
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm delete permanently Weekend away' }));
    await vi.waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/api/Journeys/recently-deleted/7', { method: 'DELETE' }),
    );
    await vi.waitFor(() => expect(refreshMock).toHaveBeenCalled());
  });

  it('empties the list after a confirmation', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    renderWithMantine(<RecentlyDeletedJourneys data={data} now={NOW} />);
    fireEvent.click(screen.getByRole('button', { name: 'Empty now' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm empty now' }));
    await vi.waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/api/Journeys/recently-deleted', { method: 'DELETE' }),
    );
    await vi.waitFor(() => expect(refreshMock).toHaveBeenCalled());
  });
});
