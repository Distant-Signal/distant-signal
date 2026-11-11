import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithMantine } from '@/test/render';
import { DeleteJourneyButton } from './DeleteJourneyButton';
import { PendingDeleteToasts } from './PendingDeleteToasts';
import { DELETE_UNDO_WINDOW_MS, getPendingDeletes, resetPendingDeletes } from '@/lib/pendingDeletes';

const pushMock = vi.fn();
const refreshMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
  usePathname: () => '/journeys/167',
  useSearchParams: () => new URLSearchParams(''),
}));

describe('DeleteJourneyButton', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    pushMock.mockClear();
    refreshMock.mockClear();
  });

  afterEach(() => {
    resetPendingDeletes();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('does not call DELETE until the confirmation modal is confirmed', () => {
    const fetchMock = vi.mocked(fetch);
    renderWithMantine(<DeleteJourneyButton journeyId={167} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete journey' }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('warns that every leg is removed and that undo only lasts a few seconds', async () => {
    renderWithMantine(<DeleteJourneyButton journeyId={167} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete journey' }));
    await waitFor(() => expect(screen.getByText(/removes every leg on this journey/)).toBeInTheDocument());
    expect(screen.getByText(/undo for a few seconds, then it cannot be undone/)).toBeInTheDocument();
  });

  async function confirmWithFakeTimers() {
    renderWithMantine(
      <>
        <DeleteJourneyButton journeyId={167} />
        <PendingDeleteToasts />
      </>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Delete journey' }));
    await waitFor(() => screen.getByRole('button', { name: 'Confirm delete journey' }));
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete journey' }));
  }

  it('redirects to /journeys at once, shows an Undo toast and waits to DELETE', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await confirmWithFakeTimers();

    expect(pushMock).toHaveBeenCalledWith('/journeys');
    expect(screen.getByText('Journey deleted')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(DELETE_UNDO_WINDOW_MS);
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/Journeys/167', { method: 'DELETE', keepalive: false });
    expect(screen.queryByText('Journey deleted')).not.toBeInTheDocument();
    expect(refreshMock).toHaveBeenCalled();
  });

  it('Undo cancels the DELETE', async () => {
    const fetchMock = vi.mocked(fetch);
    await confirmWithFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: 'Undo: Journey deleted' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DELETE_UNDO_WINDOW_MS * 2);
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByText('Journey deleted')).not.toBeInTheDocument();
  });

  it('a failed delete shows a failure and puts the journey back', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(new Response('boom', { status: 500 }));
    await confirmWithFakeTimers();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DELETE_UNDO_WINDOW_MS);
    });
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't delete the journey. Try again.");
    expect(getPendingDeletes().hidden.has('journey:167')).toBe(false);
  });

  it('cancelling the modal does not call DELETE', async () => {
    const fetchMock = vi.mocked(fetch);
    renderWithMantine(<DeleteJourneyButton journeyId={167} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete journey' }));
    await waitFor(() => screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
