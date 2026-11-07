import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithMantine } from '@/test/render';
import { addCalendarDays, londonToday } from '@/lib/londonWallClock';
import { formatDate } from '@/lib/dateFormat';
import { PauseUntilButton } from './PauseUntilButton';

const refreshMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: refreshMock }),
  usePathname: () => '/journeys/regular',
  useSearchParams: () => new URLSearchParams(''),
}));

const later = addCalendarDays(londonToday(), 12);
const shown = formatDate(`${later}T12:00:00Z`);

describe('PauseUntilButton', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    refreshMock.mockClear();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('asks for the day it starts again on, then pauses the pair until it', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ templateIds: [5, 6], deletedJourneyIds: [7] }), { status: 200 }),
    );
    renderWithMantine(<PauseUntilButton templateId={5} pausedUntil={null} paired />);
    fireEvent.click(screen.getByRole('button', { name: 'Pause until' }));
    expect(await screen.findByRole('dialog', { name: 'Pause until a date?' })).toBeInTheDocument();
    expect(screen.getByText(/Pauses the return journey too\./)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pause' })).toBeDisabled();
    const input = screen.getByLabelText('Starts again on');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: shown } });
    fireEvent.blur(input);
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/JourneyTemplates/5/paused-until',
      expect.objectContaining({ method: 'PUT', body: JSON.stringify({ pausedUntil: later }) }),
    );
  });

  it('says until when, and starts again now', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ templateIds: [5], deletedJourneyIds: [] }), { status: 200 }),
    );
    renderWithMantine(<PauseUntilButton templateId={5} pausedUntil={later} />);
    expect(screen.getByText(`Paused until ${shown}.`)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Start again now' }));
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/JourneyTemplates/5/paused-until',
      expect.objectContaining({ body: JSON.stringify({ pausedUntil: null }) }),
    );
  });

  it('offers a pause again once the date has passed', () => {
    renderWithMantine(<PauseUntilButton templateId={5} pausedUntil={londonToday()} />);
    expect(screen.getByRole('button', { name: 'Pause until' })).toBeInTheDocument();
  });

  it("says Couldn't start this regular journey again when that fails", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('', { status: 500 }));
    renderWithMantine(<PauseUntilButton templateId={5} pausedUntil={later} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start again now' }));
    expect(await screen.findByText("Couldn't start this regular journey again. Try again.")).toBeInTheDocument();
  });
});
