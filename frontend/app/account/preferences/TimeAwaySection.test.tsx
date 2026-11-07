import { describe, it, expect, vi, afterEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithMantine } from '@/test/render';
import { addCalendarDays, londonToday } from '@/lib/londonWallClock';
import { formatDate } from '@/lib/dateFormat';
import { TimeAwaySection } from './TimeAwaySection';

const first = addCalendarDays(londonToday(), 10);
const last = addCalendarDays(londonToday(), 14);
const shown = (date: string) => formatDate(`${date}T12:00:00Z`);

function typeDate(label: string, date: string) {
  const input = screen.getByLabelText(label);
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: shown(date) } });
  fireEvent.blur(input);
}

describe('TimeAwaySection', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('lists the time away, and says when there is none', () => {
    const { unmount } = renderWithMantine(<TimeAwaySection initial={[]} />);
    expect(screen.getByRole('region', { name: 'Time away' })).toBeInTheDocument();
    expect(screen.getByText('No time away.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add time away' })).toBeDisabled();
    unmount();
    renderWithMantine(
      <TimeAwaySection initial={[{ id: 3, startsOn: '2026-12-21', endsOn: '2026-12-24', label: 'Christmas' }]} />,
    );
    expect(screen.getByText('Christmas: 21 Dec 2026 to 24 Dec 2026')).toBeInTheDocument();
  });

  it('adds time away and says how many journeys went', async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(
          JSON.stringify({
            period: { id: 9, startsOn: first, endsOn: last, label: 'Holiday' },
            deletedJourneyIds: [4, 5],
          }),
          { status: 200 },
        ),
    );
    vi.stubGlobal('fetch', fetchMock);
    renderWithMantine(<TimeAwaySection initial={[]} />);
    typeDate('First day away', first);
    typeDate('Last day away', last);
    fireEvent.change(screen.getByLabelText('Name (optional)'), { target: { value: ' Holiday ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add time away' }));

    expect(await screen.findByText('Added. Removed 2 journeys already added for those dates.')).toBeInTheDocument();
    expect(screen.getByText(`Holiday: ${shown(first)} to ${shown(last)}`)).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe('/api/preferences/time-away');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({ startsOn: first, endsOn: last, label: 'Holiday' });
  });

  it("deletes one, and says Couldn't add your time away when the api refuses", async () => {
    const fetchMock = vi
      .fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response('', { status: 500 }));
    vi.stubGlobal('fetch', fetchMock);
    renderWithMantine(
      <TimeAwaySection initial={[{ id: 3, startsOn: '2026-12-21', endsOn: '2026-12-21', label: null }]} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Delete time away, 21 Dec 2026' }));
    expect(await screen.findByText('No time away.')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/preferences/time-away/3', { method: 'DELETE' });

    typeDate('First day away', first);
    typeDate('Last day away', first);
    fireEvent.click(screen.getByRole('button', { name: 'Add time away' }));
    expect(await screen.findByText("Couldn't add your time away. Try again.")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('No time away.')).toBeInTheDocument());
  });
});
