/** Where the visitor's own secrets live in the browser: the Anthropic key
 * (`lib/anthropicKey.ts`) and the chat's MCP OAuth client and tokens
 * (`lib/mcpOAuthProvider.ts`). `sessionStorage`, not `localStorage`: it is
 * gone when the tab closes, so nothing is left behind on a shared browser
 * after an expired session, and a script injected into a later visit cannot
 * read what an earlier tab held. It still survives a reload and the
 * same-tab redirect to the authorization server and back, which the chat's
 * connect flow needs.
 *
 * Neither secret is ever sent to a Distant Signal server. */

/** The Anthropic key's storage key. */
export const ANTHROPIC_API_KEY_STORAGE_KEY = 'ds-anthropic-api-key';

/** The prefix every MCP OAuth key starts with. */
export const MCP_OAUTH_STORAGE_PREFIX = 'ds-mcp-oauth:';

function isSecretKey(key: string): boolean {
  return key === ANTHROPIC_API_KEY_STORAGE_KEY || key.startsWith(MCP_OAUTH_STORAGE_PREFIX);
}

/** Keys currently in `storage` that are secrets, as a stable snapshot. */
function secretKeysIn(storage: Storage): string[] {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key !== null && isSecretKey(key)) keys.push(key);
  }
  return keys;
}

/** One-time migration: earlier versions kept these secrets in
 * `localStorage`. Moves any still there into `sessionStorage` (never over a
 * newer value already in the session) and removes the `localStorage` copy,
 * so an existing visitor keeps working in this tab and no secret stays at
 * rest. Never throws: storage may be blocked. */
export function migrateLegacySecrets(): void {
  try {
    for (const key of secretKeysIn(localStorage)) {
      const value = localStorage.getItem(key);
      if (value !== null && sessionStorage.getItem(key) === null) {
        sessionStorage.setItem(key, value);
      }
      localStorage.removeItem(key);
    }
  } catch {
    // Storage blocked: nothing stored.
  }
}

/** The three `Storage` methods the secrets' callers use. */
export type SecretStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

// Held only for this page load: what the store falls back to when
// `sessionStorage` is blocked or full (private mode, disabled site data), so
// the page still renders and the chat still works until the next navigation.
const memory = new Map<string, string>();

const secretStore: SecretStore = {
  getItem(key) {
    try {
      const value = sessionStorage.getItem(key);
      if (value !== null) return value;
    } catch {
      // Storage blocked: fall through to memory.
    }
    return memory.get(key) ?? null;
  },
  setItem(key, value) {
    try {
      sessionStorage.setItem(key, value);
      memory.delete(key);
    } catch {
      memory.set(key, value);
    }
  },
  removeItem(key) {
    memory.delete(key);
    try {
      sessionStorage.removeItem(key);
    } catch {
      // Storage blocked: nothing stored.
    }
  },
};

/** The store for secrets, after migrating anything left in `localStorage`.
 * Never throws: it keeps to memory if `sessionStorage` is unavailable. */
export function secretStorage(): SecretStore {
  migrateLegacySecrets();
  return secretStore;
}

/** Removes every secret from both stores and from memory. Never throws. */
export function clearSecretStorage(): void {
  memory.clear();
  for (const area of [() => sessionStorage, () => localStorage]) {
    try {
      const storage = area();
      for (const key of secretKeysIn(storage)) storage.removeItem(key);
    } catch {
      // Storage blocked: nothing stored.
    }
  }
}
