import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithMantine } from '@/test/render';
import { CalendarFeedSection, calendarFeedPath } from './CalendarFeedSection';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('CalendarFeedSection', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('builds the feed path from the token', () => {
    expect(calendarFeedPath('abc_-123')).toBe('/api/calendar/abc_-123.ics');
  });

  it('says what the feed shows and that anyone with the link can see it', () => {
    renderWithMantine(<CalendarFeedSection initialActive={false} />);
    expect(screen.getByText(/Anyone who has the link can see your journeys/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Turn on calendar feed' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Turn off calendar feed' })).toBeNull();
  });

  it('makes a link, shows it once and offers to replace or turn it off', async () => {
    vi.mocked(fetch).mockResolvedValue(json({ token: 'secret-token' }));
    renderWithMantine(<CalendarFeedSection initialActive={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'Turn on calendar feed' }));
    const field = await screen.findByRole('textbox', { name: 'Calendar feed link' });
    expect(field).toHaveValue(`${window.location.origin}/api/calendar/secret-token.ics`);
    expect(fetch).toHaveBeenCalledWith('/api/account/calendar-feed', { method: 'POST' });
    expect(screen.getByRole('button', { name: 'Make a new link' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Turn off calendar feed' })).toBeInTheDocument();
  });

  it('turns the feed off', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }));
    renderWithMantine(<CalendarFeedSection initialActive />);
    expect(screen.queryByRole('textbox', { name: 'Calendar feed link' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Turn off calendar feed' }));
    await waitFor(() => expect(screen.getByText('Turned off. The link no longer works.')).toBeInTheDocument());
    expect(fetch).toHaveBeenCalledWith('/api/account/calendar-feed', { method: 'DELETE' });
    expect(screen.getByRole('button', { name: 'Turn on calendar feed' })).toBeInTheDocument();
  });

  it("says when it couldn't make the link", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('network'));
    renderWithMantine(<CalendarFeedSection initialActive={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'Turn on calendar feed' }));
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't make your calendar link.");
  });
});
