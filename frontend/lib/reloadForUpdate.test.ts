import { afterEach, describe, expect, it, vi } from 'vitest';
import { reloadForUpdate } from './reloadForUpdate';

const reload = vi.fn();

describe('reloadForUpdate', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    reload.mockClear();
  });

  function stubLocation() {
    vi.stubGlobal('location', { reload });
  }

  it('updates the service worker, then reloads', async () => {
    const update = vi.fn(() => Promise.resolve());
    vi.stubGlobal('navigator', { serviceWorker: { getRegistration: () => Promise.resolve({ update }) } });
    stubLocation();
    await reloadForUpdate();
    expect(update).toHaveBeenCalledTimes(1);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('reloads even when the update check fails or there is no registration', async () => {
    vi.stubGlobal('navigator', {
      serviceWorker: { getRegistration: () => Promise.resolve({ update: () => Promise.reject(new Error('offline')) }) },
    });
    stubLocation();
    await reloadForUpdate();
    expect(reload).toHaveBeenCalledTimes(1);
    vi.stubGlobal('navigator', { serviceWorker: { getRegistration: () => Promise.resolve(undefined) } });
    await reloadForUpdate();
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it('does not wait forever for a hung update', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('navigator', {
      serviceWorker: { getRegistration: () => Promise.resolve({ update: () => new Promise(() => undefined) }) },
    });
    stubLocation();
    const done = reloadForUpdate();
    await vi.advanceTimersByTimeAsync(3100);
    await done;
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('reloads when there is no service worker support', async () => {
    vi.stubGlobal('navigator', {});
    stubLocation();
    await reloadForUpdate();
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
