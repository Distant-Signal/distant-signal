import { ANTHROPIC_API_KEY_STORAGE_KEY } from './anthropicKey';
import { MCP_OAUTH_STORAGE_KEYS, MCP_OAUTH_STORAGE_PREFIX } from './mcpOAuthProvider';

/** Browser-only data this app keeps for a signed-in visitor: the chat's
 * MCP OAuth client and tokens (`lib/mcpOAuthProvider.ts`, keys prefixed
 * `ds-mcp-oauth:`) and the visitor's own Anthropic key
 * (`lib/anthropicKey.ts`). Neither is ever sent to Distant Signal, so the
 * backend cannot delete them.
 *
 * DQ5 (FE-3/LEG-11/LEG-26): cleared on logout, on "log out other
 * sessions", and on account deletion. The MCP grant is bound to the
 * identity that approved it, so leaving it behind on a shared browser let
 * the next person to log in chat as the previous user, on the previous
 * user's Anthropic key. */
export const BROWSER_ACCOUNT_KEYS: readonly string[] = [...MCP_OAUTH_STORAGE_KEYS, ANTHROPIC_API_KEY_STORAGE_KEY];

/** Removes every {@link BROWSER_ACCOUNT_KEYS} entry, plus any other
 * `ds-mcp-oauth:*` key a newer provider version may have written. Never
 * throws: storage may be blocked (private mode, disabled site data), in
 * which case nothing was stored. */
export function clearBrowserAccountData(): void {
  try {
    const keys = new Set(BROWSER_ACCOUNT_KEYS);
    if (typeof localStorage.length === 'number' && typeof localStorage.key === 'function') {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(MCP_OAUTH_STORAGE_PREFIX)) keys.add(key);
      }
    }
    for (const key of keys) {
      localStorage.removeItem(key);
    }
  } catch {
    // Storage blocked: nothing stored.
  }
}

/** How long logging out waits for the server to forget this device. */
const PUSH_FORGET_TIMEOUT_MS = 5_000;

/** Stops this browser's push notifications, for logging out: the api's
 * logout only ends the session and keeps the user's push subscriptions, so
 * on a shared device the previous user's train and line alerts kept
 * arriving. Asks the server to forget this device (`DELETE
 * /notifications/subscribe`, the same call "Turn off on this device" makes,
 * while the session still exists), then drops the browser's subscription
 * whatever the server said: a dropped subscription's endpoint stops
 * delivering, so the server's copy goes dead even if its delete failed.
 * Never throws and never waits on the server longer than
 * `PUSH_FORGET_TIMEOUT_MS`: logging out must not depend on it. */
export async function forgetThisDevicePush(): Promise<void> {
  try {
    if (typeof navigator === 'undefined') return;
    // Absent in a browser with no service worker support (and in jsdom).
    const serviceWorker = navigator.serviceWorker as Partial<ServiceWorkerContainer> | undefined;
    const registration = await serviceWorker?.getRegistration?.();
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return;
    try {
      await fetch('/api/notifications/subscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
        signal: AbortSignal.timeout(PUSH_FORGET_TIMEOUT_MS),
      });
    } catch {
      // The browser's unsubscribe below still stops delivery.
    }
    await subscription.unsubscribe();
  } catch {
    // No service worker, push blocked, or the unsubscribe failed: nothing
    // more this browser can do.
  }
}
