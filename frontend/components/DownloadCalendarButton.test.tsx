import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithMantine } from '@/test/render';
import { DownloadCalendarButton, REVOKE_DELAY_MS } from './DownloadCalendarButton';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('DownloadCalendarButton', () => {
  it('saves the file and revokes its blob URL only after the click has run', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('BEGIN:VCALENDAR', { status: 200 }))),
    );
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:journey');
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    // Revokes counted once the task that clicked has finished.
    let revokedInClickTask = -1;
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {
      queueMicrotask(() => {
        revokedInClickTask = revoke.mock.calls.length;
      });
    });

    renderWithMantine(<DownloadCalendarButton journeyId={7} />);
    fireEvent.click(screen.getByRole('button', { name: /download/i }));

    await waitFor(() => expect(click).toHaveBeenCalled());
    expect(create).toHaveBeenCalled();
    await waitFor(() => expect(revokedInClickTask).toBe(0));
    await waitFor(() => expect(revoke).toHaveBeenCalledWith('blob:journey'), { timeout: REVOKE_DELAY_MS + 2000 });
  });

  it('saves nothing when the file cannot be read', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('no', { status: 404 }))),
    );
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    renderWithMantine(<DownloadCalendarButton journeyId={7} />);
    fireEvent.click(screen.getByRole('button', { name: /download/i }));
    expect(await screen.findByText(/Couldn't download the calendar file/)).toBeInTheDocument();
    expect(click).not.toHaveBeenCalled();
  });
});
