import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DELETE_UNDO_WINDOW_MS,
  flushPendingDeletes,
  getPendingDeletes,
  pauseDeletes,
  resetPendingDeletes,
  resumeDeletes,
  scheduleDelete,
  undoDelete,
  type ScheduleDeleteInput,
} from './pendingDeletes';

const fetchMock = vi.fn();

function journey(id: number, extra: Partial<ScheduleDeleteInput> = {}): ScheduleDeleteInput {
  return {
    kind: 'journey',
    id,
    message: 'Journey deleted',
    url: `/api/Journeys/${String(id)}`,
    failure: ['delete', 'the journey'],
    ...extra,
  };
}

describe('pendingDeletes', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    resetPendingDeletes();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('hides the row at once and sends nothing before the window ends', async () => {
    scheduleDelete(journey(1));
    expect(getPendingDeletes().hidden.has('journey:1')).toBe(true);
    await vi.advanceTimersByTimeAsync(DELETE_UNDO_WINDOW_MS - 1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('undo within the window cancels the DELETE and restores the row', async () => {
    const onRestored = vi.fn();
    scheduleDelete(journey(1, { onRestored }));
    await vi.advanceTimersByTimeAsync(5_000);
    undoDelete('journey:1');
    await vi.advanceTimersByTimeAsync(DELETE_UNDO_WINDOW_MS);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(getPendingDeletes().hidden.has('journey:1')).toBe(false);
    expect(onRestored).toHaveBeenCalledOnce();
  });

  it('expiry sends the DELETE once and keeps the row hidden', async () => {
    const onDeleted = vi.fn();
    scheduleDelete(journey(1, { onDeleted }));
    await vi.advanceTimersByTimeAsync(DELETE_UNDO_WINDOW_MS);
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith('/api/Journeys/1', { method: 'DELETE', keepalive: false });
    expect(onDeleted).toHaveBeenCalledOnce();
    expect(getPendingDeletes().pending).toEqual([]);
    expect(getPendingDeletes().hidden.has('journey:1')).toBe(true);
  });

  it('flush (pagehide) sends every pending DELETE now with keepalive, once', async () => {
    scheduleDelete(journey(1));
    scheduleDelete(journey(2));
    flushPendingDeletes();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledWith('/api/Journeys/1', { method: 'DELETE', keepalive: true });
    expect(fetchMock).toHaveBeenCalledWith('/api/Journeys/2', { method: 'DELETE', keepalive: true });
    await vi.advanceTimersByTimeAsync(DELETE_UNDO_WINDOW_MS);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('a failed DELETE restores the row and reports the failure', async () => {
    fetchMock.mockResolvedValue(new Response('x', { status: 500 }));
    const onRestored = vi.fn();
    scheduleDelete(journey(1, { onRestored }));
    await vi.advanceTimersByTimeAsync(DELETE_UNDO_WINDOW_MS);
    expect(getPendingDeletes().hidden.has('journey:1')).toBe(false);
    expect(getPendingDeletes().failures).toEqual([
      { key: 'journey:1', message: "Couldn't delete the journey. Try again." },
    ]);
    expect(onRestored).toHaveBeenCalledOnce();
  });

  it('a network failure restores the row too', async () => {
    fetchMock.mockRejectedValue(new TypeError('offline'));
    scheduleDelete(journey(1));
    await vi.advanceTimersByTimeAsync(DELETE_UNDO_WINDOW_MS);
    expect(getPendingDeletes().hidden.has('journey:1')).toBe(false);
    expect(getPendingDeletes().failures[0]?.message).toBe("Couldn't delete the journey. Try again.");
  });

  it('treats a 404 as already deleted', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 404 }));
    scheduleDelete(journey(1));
    await vi.advanceTimersByTimeAsync(DELETE_UNDO_WINDOW_MS);
    expect(getPendingDeletes().failures).toEqual([]);
    expect(getPendingDeletes().hidden.has('journey:1')).toBe(true);
  });

  it('keeps an independent timer per pending delete', async () => {
    scheduleDelete(journey(1));
    await vi.advanceTimersByTimeAsync(4_000);
    scheduleDelete(journey(2));
    scheduleDelete({ ...journey(7), kind: 'train', url: '/api/Train/7' });
    expect(getPendingDeletes().pending.map((p) => p.key)).toEqual(['journey:1', 'journey:2', 'train:7']);
    undoDelete('journey:2');
    await vi.advanceTimersByTimeAsync(6_000);
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith('/api/Journeys/1', { method: 'DELETE', keepalive: false });
    await vi.advanceTimersByTimeAsync(4_000);
    expect(fetchMock).toHaveBeenCalledWith('/api/Train/7', { method: 'DELETE', keepalive: false });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('ignores a second delete of the same thing', async () => {
    scheduleDelete(journey(1));
    scheduleDelete(journey(1));
    await vi.advanceTimersByTimeAsync(DELETE_UNDO_WINDOW_MS);
    scheduleDelete(journey(1));
    await vi.advanceTimersByTimeAsync(DELETE_UNDO_WINDOW_MS);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('holds the timers while paused and resumes with the time left', async () => {
    scheduleDelete(journey(1));
    await vi.advanceTimersByTimeAsync(6_000);
    pauseDeletes();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchMock).not.toHaveBeenCalled();
    resumeDeletes();
    await vi.advanceTimersByTimeAsync(3_999);
    expect(fetchMock).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
