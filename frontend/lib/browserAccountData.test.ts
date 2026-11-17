import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BROWSER_ACCOUNT_KEYS, clearBrowserAccountData, forgetThisDevicePush } from './browserAccountData';

// DQ5 (FE-3/LEG-11/LEG-26).
describe('clearBrowserAccountData', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('covers every MCP OAuth key and the Anthropic key', () => {
    expect([...BROWSER_ACCOUNT_KEYS].sort()).toEqual(
      [
        'ds-anthropic-api-key',
        'ds-mcp-oauth:client-information',
        'ds-mcp-oauth:client-saved-at',
        'ds-mcp-oauth:code-verifier',
        'ds-mcp-oauth:oauth-state',
        'ds-mcp-oauth:tokens',
      ].sort(),
    );
  });

  it('removes those keys and leaves unrelated ones', () => {
    for (const key of BROWSER_ACCOUNT_KEYS) sessionStorage.setItem(key, 'x');
    localStorage.setItem('ds-pride', 'on');
    clearBrowserAccountData();
    for (const key of BROWSER_ACCOUNT_KEYS) expect(sessionStorage.getItem(key)).toBeNull();
    expect(localStorage.getItem('ds-pride')).toBe('on');
  });

  it('also removes secrets an earlier version left in localStorage', () => {
    for (const key of BROWSER_ACCOUNT_KEYS) localStorage.setItem(key, 'x');
    clearBrowserAccountData();
    for (const key of BROWSER_ACCOUNT_KEYS) expect(localStorage.getItem(key)).toBeNull();
  });

  it('also sweeps any other ds-mcp-oauth:* key when storage can enumerate keys', () => {
    const store = new Map<string, string>([
      ['ds-mcp-oauth:future-key', 'x'],
      ['ds-mcp-oauth:tokens', 'x'],
      ['keep-me', 'y'],
    ]);
    const storage = {
      get length() {
        return store.size;
      },
      key: (i: number) => [...store.keys()][i] ?? null,
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
    };
    vi.stubGlobal('sessionStorage', storage);
    try {
      clearBrowserAccountData();
      expect([...store.keys()]).toEqual(['keep-me']);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('never throws when storage is blocked', () => {
    vi.stubGlobal('sessionStorage', {
      get length(): number {
        throw new Error('SecurityError');
      },
      removeItem() {
        throw new Error('SecurityError');
      },
    });
    try {
      expect(() => clearBrowserAccountData()).not.toThrow();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

// The api's logout keeps push subscriptions, so a shared device kept getting
// the previous user's alerts.
describe('forgetThisDevicePush', () => {
  function stubPush(subscription: { endpoint: string; unsubscribe: () => Promise<boolean> } | null) {
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { getRegistration: async () => ({ pushManager: { getSubscription: async () => subscription } }) },
    });
  }

  afterEach(() => {
    // @ts-expect-error -- undo the test-only stub (jsdom has no serviceWorker).
    delete navigator.serviceWorker;
    vi.unstubAllGlobals();
  });

  it('asks the server to forget this device, then drops the browser subscription', async () => {
    const calls: string[] = [];
    const fetchMock = vi.fn(async () => {
      calls.push('delete');
      return new Response(null, { status: 204 });
    });
    vi.stubGlobal('fetch', fetchMock);
    stubPush({
      endpoint: 'https://push.example/abc',
      unsubscribe: async () => {
        calls.push('unsubscribe');
        return true;
      },
    });

    await forgetThisDevicePush();

    expect(calls).toEqual(['delete', 'unsubscribe']);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/notifications/subscribe',
      expect.objectContaining({ method: 'DELETE', body: JSON.stringify({ endpoint: 'https://push.example/abc' }) }),
    );
  });

  it('still drops the browser subscription when the server call fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );
    const unsubscribe = vi.fn(async () => true);
    stubPush({ endpoint: 'https://push.example/abc', unsubscribe });

    await expect(forgetThisDevicePush()).resolves.toBeUndefined();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('does nothing without a subscription or a service worker, and never throws', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(forgetThisDevicePush()).resolves.toBeUndefined();
    stubPush(null);
    await expect(forgetThisDevicePush()).resolves.toBeUndefined();
    stubPush({
      endpoint: 'https://push.example/abc',
      unsubscribe: async () => {
        throw new Error('InvalidStateError');
      },
    });
    fetchMock.mockResolvedValue(new Response(null, { status: 500 }));
    await expect(forgetThisDevicePush()).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
