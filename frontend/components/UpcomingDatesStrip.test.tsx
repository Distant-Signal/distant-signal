import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithMantine } from '@/test/render';
import { UpcomingDatesStrip } from './UpcomingDatesStrip';
import type { UpcomingDate } from '@/lib/types';

const refreshMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: refreshMock }),
  usePathname: () => '/journeys/regular',
  useSearchParams: () => new URLSearchParams(''),
}));

const UPCOMING: UpcomingDate[] = [
  { date: '2026-11-09', skipReason: null },
  { date: '2026-11-10', skipReason: 'skipped' },
  { date: '2026-11-11', skipReason: 'bank_holiday' },
  // Time away: switched off in Preferences, not here.
  { date: '2026-11-12', skipReason: 'away' },
];

describe('UpcomingDatesStrip', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    refreshMock.mockClear();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('shows each date on or off, with why a date is skipped', () => {
    renderWithMantine(<UpcomingDatesStrip templateId={5} pairedTemplateId={null} upcoming={UPCOMING} />);
    expect(screen.getByRole('group', { name: 'Next dates' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Mon 9 Nov' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Tue 10 Nov' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Tue 10 Nov' })).toBeEnabled();
    // Decided elsewhere: can't be switched here.
    expect(screen.getByRole('checkbox', { name: 'Wed 11 Nov' })).toBeDisabled();
    expect(screen.getByText('Bank holiday')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Thu 12 Nov' })).toBeDisabled();
    expect(screen.getByText('Away')).toBeInTheDocument();
    expect(screen.getAllByText('Skipped')).toHaveLength(1);
  });

  it('skips a date for the pair, and puts a skipped one back on both', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));
    renderWithMantine(<UpcomingDatesStrip templateId={5} pairedTemplateId={6} upcoming={UPCOMING} />);

    fireEvent.click(screen.getByRole('checkbox', { name: 'Mon 9 Nov' }));
    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/JourneyTemplates/5/skip',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ serviceDates: ['2026-11-09'], pair: true }),
      }),
    );

    fireEvent.click(screen.getByRole('checkbox', { name: 'Tue 10 Nov' }));
    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(2));
    expect(fetchMock).toHaveBeenCalledWith('/api/JourneyTemplates/5/skip/2026-11-10', { method: 'DELETE' });
    expect(fetchMock).toHaveBeenCalledWith('/api/JourneyTemplates/6/skip/2026-11-10', { method: 'DELETE' });
  });

  it("says Couldn't skip this date when the api refuses", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('That journey has already started.', { status: 409 }));
    renderWithMantine(<UpcomingDatesStrip templateId={5} pairedTemplateId={null} upcoming={UPCOMING} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Mon 9 Nov' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('That journey has already started.');
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it('shows nothing without dates', () => {
    const { container } = renderWithMantine(
      <UpcomingDatesStrip templateId={5} pairedTemplateId={null} upcoming={[]} />,
    );
    expect(container.querySelector('[data-upcoming-date]')).toBeNull();
  });
});
