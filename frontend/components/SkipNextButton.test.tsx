import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithMantine } from '@/test/render';
import { SkipNextButton } from './SkipNextButton';

const pushMock = vi.fn();
const refreshMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
  usePathname: () => '/journeys/regular',
  useSearchParams: () => new URLSearchParams(''),
}));

function skipped(templateIds: number[]) {
  return new Response(JSON.stringify({ serviceDate: '2026-11-10', templateIds, deletedJourneyIds: [] }), {
    status: 200,
  });
}

describe('SkipNextButton', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    pushMock.mockClear();
    refreshMock.mockClear();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('asks first, skips the return too by default, then offers Undo', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(skipped([5, 6]));
    renderWithMantine(<SkipNextButton templateId={5} date="2026-11-10" paired />);

    fireEvent.click(screen.getByRole('button', { name: 'Skip next' }));
    expect(await screen.findByRole('dialog', { name: 'Skip 10 Nov 2026?' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Skip the return journey too' })).toBeChecked();
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Skip 10 Nov 2026' }));

    expect(await screen.findByText('Skipped 10 Nov 2026.')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/JourneyTemplates/5/skip',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ serviceDate: '2026-11-10', pair: true }) }),
    );
    expect(refreshMock).toHaveBeenCalled();

    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Skip next' })).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith('/api/JourneyTemplates/5/skip/2026-11-10', { method: 'DELETE' });
    expect(fetchMock).toHaveBeenCalledWith('/api/JourneyTemplates/6/skip/2026-11-10', { method: 'DELETE' });
  });

  it('can leave the return journey alone, and offers no choice without one', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(skipped([5]));
    const { unmount } = renderWithMantine(<SkipNextButton templateId={5} date="2026-11-10" paired />);
    fireEvent.click(screen.getByRole('button', { name: 'Skip next' }));
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Skip the return journey too' }));
    fireEvent.click(screen.getByRole('button', { name: 'Skip 10 Nov 2026' }));
    await screen.findByText('Skipped 10 Nov 2026.');
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/JourneyTemplates/5/skip',
      expect.objectContaining({ body: JSON.stringify({ serviceDate: '2026-11-10', pair: false }) }),
    );
    unmount();

    renderWithMantine(<SkipNextButton templateId={7} date="2026-11-10" />);
    fireEvent.click(screen.getByRole('button', { name: 'Skip next' }));
    await screen.findByRole('dialog', { name: 'Skip 10 Nov 2026?' });
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it("shows the api's refusal and stays open when the journey has started", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('That journey has already started.', { status: 409 }));
    renderWithMantine(<SkipNextButton templateId={5} date="2026-11-10" label="Skip" afterSkipHref="/journeys" />);
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Skip 10 Nov 2026' }));
    expect(await screen.findByText('That journey has already started.')).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('goes to afterSkipHref once skipped', async () => {
    vi.mocked(fetch).mockResolvedValue(skipped([5]));
    renderWithMantine(<SkipNextButton templateId={5} date="2026-11-10" label="Skip" afterSkipHref="/journeys" />);
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Skip 10 Nov 2026' }));
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/journeys'));
  });

  it("says Couldn't skip this journey on a network failure", async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('offline'));
    renderWithMantine(<SkipNextButton templateId={5} date="2026-11-10" />);
    fireEvent.click(screen.getByRole('button', { name: 'Skip next' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Skip 10 Nov 2026' }));
    expect(await screen.findByText("Couldn't skip this journey. Try again.")).toBeInTheDocument();
  });
});
