import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithMantine } from '@/test/render';
import { PauseRegularJourneyButton } from './PauseRegularJourneyButton';

const refreshMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: refreshMock }),
  usePathname: () => '/journeys/regular',
  useSearchParams: () => new URLSearchParams(''),
}));

describe('PauseRegularJourneyButton', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    refreshMock.mockClear();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('asks before pausing, says a pair pauses together, then PUTs active false', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ templateIds: [5, 6], deletedJourneyIds: [] }), { status: 200 }),
    );
    renderWithMantine(<PauseRegularJourneyButton templateId={5} active paired />);
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(await screen.findByText(/Pauses the return journey too\./)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm pause regular journey' }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/JourneyTemplates/5/active',
        expect.objectContaining({ method: 'PUT', body: JSON.stringify({ active: false }) }),
      ),
    );
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
  });

  it('resumes straight away', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ templateIds: [5], deletedJourneyIds: [] })));
    renderWithMantine(<PauseRegularJourneyButton templateId={5} active={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/JourneyTemplates/5/active',
        expect.objectContaining({ body: JSON.stringify({ active: true }) }),
      ),
    );
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
  });

  it("says Couldn't pause this regular journey on a failure", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('', { status: 500 }));
    renderWithMantine(<PauseRegularJourneyButton templateId={5} active />);
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm pause regular journey' }));
    expect(await screen.findByText("Couldn't pause this regular journey. Try again.")).toBeInTheDocument();
  });
});
