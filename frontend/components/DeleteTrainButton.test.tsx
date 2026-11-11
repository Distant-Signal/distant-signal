import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithMantine } from '@/test/render';
import { DeleteTrainButton } from './DeleteTrainButton';
import { PendingDeleteToasts } from './PendingDeleteToasts';
import { DELETE_UNDO_WINDOW_MS, getPendingDeletes, resetPendingDeletes } from '@/lib/pendingDeletes';

const pushMock = vi.fn();
const refreshMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
  usePathname: () => '/train/by-id/42',
  useSearchParams: () => new URLSearchParams(''),
}));

describe('DeleteTrainButton', () => {
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
    renderWithMantine(<DeleteTrainButton trackingId={42} sharedGroupCount={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Stop tracking' }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  async function confirmWithFakeTimers(props: Partial<React.ComponentProps<typeof DeleteTrainButton>> = {}) {
    renderWithMantine(
      <>
        <DeleteTrainButton trackingId={42} sharedGroupCount={0} {...props} />
        <PendingDeleteToasts />
      </>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Stop tracking' }));
    await waitFor(() => screen.getByRole('button', { name: 'Confirm stop tracking' }));
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm stop tracking' }));
  }

  async function expire() {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DELETE_UNDO_WINDOW_MS);
    });
  }

  // Default `afterDelete` ('redirect') -- the by-id page's own behaviour.
  it('redirects to /journeys at once and DELETEs the tracked train after the undo window', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await confirmWithFakeTimers();

    expect(pushMock).toHaveBeenCalledWith('/journeys');
    expect(screen.getByText('Stopped tracking this train')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    await expire();
    expect(fetchMock).toHaveBeenCalledWith('/api/Train/42', { method: 'DELETE', keepalive: false });
  });

  // `afterDelete="refresh"` -- stays put; the page refreshes once the
  // DELETE has been sent.
  it('stays put with afterDelete "refresh" and refreshes after the DELETE', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await confirmWithFakeTimers({ afterDelete: 'refresh' });

    expect(pushMock).not.toHaveBeenCalled();
    expect(refreshMock).not.toHaveBeenCalled();
    await expire();
    expect(fetchMock).toHaveBeenCalledWith('/api/Train/42', { method: 'DELETE', keepalive: false });
    expect(refreshMock).toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('Undo cancels the DELETE and restores the row', async () => {
    const fetchMock = vi.mocked(fetch);
    await confirmWithFakeTimers({ afterDelete: 'refresh' });
    expect(getPendingDeletes().hidden.has('train:42')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Undo: Stopped tracking this train' }));
    expect(getPendingDeletes().hidden.has('train:42')).toBe(false);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DELETE_UNDO_WINDOW_MS * 2);
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows a failure and restores the row when the DELETE fails', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(new Response('no session', { status: 401 }));
    await confirmWithFakeTimers({ afterDelete: 'refresh' });
    await expire();
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't stop tracking this train. Log in and try again.");
    expect(screen.queryByText('no session')).not.toBeInTheDocument();
    expect(getPendingDeletes().hidden.has('train:42')).toBe(false);
  });

  // sharedGroupCount === 0: today's exact modal copy, no extra warning line.
  it('shows no group-sharing warning when the train is not shared into any group', async () => {
    renderWithMantine(<DeleteTrainButton trackingId={42} sharedGroupCount={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Stop tracking' }));
    await waitFor(() => screen.getByRole('button', { name: 'Confirm stop tracking' }));
    expect(screen.getByText('You can undo for a few seconds, then it cannot be undone.')).toBeInTheDocument();
    expect(screen.queryByText(/shared in/)).not.toBeInTheDocument();
  });

  // sharedGroupCount === 1: singular wording.
  it('warns about a single shared group, singular', async () => {
    renderWithMantine(<DeleteTrainButton trackingId={42} sharedGroupCount={1} />);
    fireEvent.click(screen.getByRole('button', { name: 'Stop tracking' }));
    await waitFor(() => screen.getByRole('button', { name: 'Confirm stop tracking' }));
    expect(
      screen.getByText('This train is shared in 1 group. Deleting it will remove it from that group too.'),
    ).toBeInTheDocument();
  });

  // sharedGroupCount > 1: plural wording.
  it('warns about multiple shared groups, plural', async () => {
    renderWithMantine(<DeleteTrainButton trackingId={42} sharedGroupCount={3} />);
    fireEvent.click(screen.getByRole('button', { name: 'Stop tracking' }));
    await waitFor(() => screen.getByRole('button', { name: 'Confirm stop tracking' }));
    expect(
      screen.getByText('This train is shared in 3 groups. Deleting it will remove it from those groups too.'),
    ).toBeInTheDocument();
  });

  // DS-93: a train a journey leg uses stays tracked there.
  it('says a journey keeps the train instead of warning it cannot be undone', async () => {
    renderWithMantine(<DeleteTrainButton trackingId={42} sharedGroupCount={2} inJourney />);
    fireEvent.click(screen.getByRole('button', { name: 'Stop tracking' }));
    await waitFor(() => screen.getByRole('button', { name: 'Confirm stop tracking' }));
    expect(screen.getByText(/part of a journey, so it stays tracked there/)).toBeInTheDocument();
    expect(screen.queryByText(/cannot be undone/)).toBeNull();
    expect(screen.queryByText(/shared in 2 groups/)).toBeNull();
  });

  // DS-124: stopping tracking deletes the train's own one-leg journey.
  it("says the train's own journey goes too", async () => {
    renderWithMantine(<DeleteTrainButton trackingId={42} sharedGroupCount={1} deletesJourney />);
    fireEvent.click(screen.getByRole('button', { name: 'Stop tracking' }));
    await waitFor(() => screen.getByRole('button', { name: 'Confirm stop tracking' }));
    expect(screen.getByText('Its journey is deleted too.')).toBeInTheDocument();
    expect(screen.getByText('You can undo for a few seconds, then it cannot be undone.')).toBeInTheDocument();
    expect(screen.getByText(/shared in 1 group/)).toBeInTheDocument();
  });
});
