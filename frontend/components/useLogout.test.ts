import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { clearBrowserAccountData, forgetThisDevicePush } from '@/lib/browserAccountData';
import { useLogout } from './useLogout';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
vi.mock('@/lib/browserAccountData', () => ({
  clearBrowserAccountData: vi.fn(),
  forgetThisDevicePush: vi.fn(),
}));

describe('useLogout', () => {
  const calls: string[] = [];

  beforeEach(() => {
    calls.length = 0;
    refresh.mockClear();
    vi.mocked(forgetThisDevicePush).mockImplementation(async () => {
      calls.push('forget push');
    });
    vi.mocked(clearBrowserAccountData).mockImplementation(() => {
      calls.push('clear storage');
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        calls.push(`fetch ${url}`);
        return new Response(null, { status: 204 });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // The api's logout keeps push subscriptions: the device is forgotten
  // first, while the session can still authorise that.
  it('stops this device push before ending the session, then clears and refreshes', async () => {
    const { result } = renderHook(() => useLogout());
    await act(() => result.current.logout());
    expect(calls).toEqual(['forget push', 'fetch /api/auth/logout', 'clear storage']);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(result.current.loggingOut).toBe(false);
  });

  it('still clears and refreshes when the logout request fails', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'));
    const { result } = renderHook(() => useLogout());
    await act(() => result.current.logout());
    expect(clearBrowserAccountData).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
