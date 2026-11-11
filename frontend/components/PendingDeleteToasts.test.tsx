import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen } from '@testing-library/react';
import { renderWithMantine } from '@/test/render';
import { PendingDeleteToasts } from './PendingDeleteToasts';
import { DELETE_UNDO_WINDOW_MS, resetPendingDeletes, scheduleDelete } from '@/lib/pendingDeletes';

const refreshMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refreshMock, push: vi.fn() }),
}));

const fetchMock = vi.fn();

function schedule(id: number) {
  act(() => {
    scheduleDelete({
      kind: 'journey',
      id,
      message: 'Journey deleted',
      url: `/api/Journeys/${String(id)}`,
      failure: ['delete', 'the journey'],
    });
  });
}

describe('PendingDeleteToasts', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    refreshMock.mockClear();
  });
  afterEach(() => {
    resetPendingDeletes();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('is a polite live region that is in the page before any toast', () => {
    renderWithMantine(<PendingDeleteToasts />);
    const region = screen.getByRole('status', { name: 'Notifications' });
    expect(region).toHaveAttribute('aria-live', 'polite');
    schedule(1);
    expect(region).toHaveTextContent('Journey deleted');
  });

  it('gives each pending delete its own labelled Undo button', () => {
    renderWithMantine(<PendingDeleteToasts />);
    schedule(1);
    schedule(2);
    expect(screen.getAllByRole('button', { name: 'Undo: Journey deleted' })).toHaveLength(2);
  });

  it('sends pending deletes with keepalive on pagehide', async () => {
    renderWithMantine(<PendingDeleteToasts />);
    schedule(1);
    schedule(2);
    await act(async () => {
      window.dispatchEvent(new Event('pagehide'));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/Journeys/1', { method: 'DELETE', keepalive: true });
    expect(fetchMock).toHaveBeenCalledWith('/api/Journeys/2', { method: 'DELETE', keepalive: true });
  });

  it('sends pending deletes when the page becomes hidden, not when it becomes visible', async () => {
    renderWithMantine(<PendingDeleteToasts />);
    schedule(1);
    const state = vi.spyOn(document, 'visibilityState', 'get');
    state.mockReturnValue('visible');
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(fetchMock).not.toHaveBeenCalled();
    state.mockReturnValue('hidden');
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/Journeys/1', { method: 'DELETE', keepalive: true });
    state.mockRestore();
  });

  it('sends pending deletes when the host unmounts', async () => {
    const { unmount } = renderWithMantine(<PendingDeleteToasts />);
    schedule(1);
    unmount();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledWith('/api/Journeys/1', { method: 'DELETE', keepalive: true });
  });

  it('holds the timer while the toast has focus or the pointer, and resumes after', async () => {
    renderWithMantine(<PendingDeleteToasts />);
    schedule(1);
    const undo = screen.getByRole('button', { name: 'Undo: Journey deleted' });
    fireEvent.focus(undo);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DELETE_UNDO_WINDOW_MS * 3);
    });
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.blur(undo);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DELETE_UNDO_WINDOW_MS);
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('Undo removes the toast and refreshes the page', async () => {
    renderWithMantine(<PendingDeleteToasts />);
    schedule(1);
    fireEvent.click(screen.getByRole('button', { name: 'Undo: Journey deleted' }));
    expect(screen.queryByText('Journey deleted')).not.toBeInTheDocument();
    expect(refreshMock).toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DELETE_UNDO_WINDOW_MS);
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows a failure as an alert that can be dismissed', async () => {
    fetchMock.mockResolvedValue(new Response('x', { status: 500 }));
    renderWithMantine(<PendingDeleteToasts />);
    schedule(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DELETE_UNDO_WINDOW_MS);
    });
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't delete the journey. Try again.");
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
