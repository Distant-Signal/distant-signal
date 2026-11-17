'use client';

import { useEffect } from 'react';
import { clearBrowserAccountData } from '@/lib/browserAccountData';
import { migrateLegacySecrets } from '@/lib/secretStorage';

/** Keeps the visitor's browser-held secrets (their Anthropic key and the
 * chat's MCP OAuth grant, `lib/secretStorage.ts`) from outliving their
 * session. Mounted once, beside the nav, with the session the nav was
 * rendered with. Renders nothing.
 *
 * - Logged in: moves any secrets an earlier version left in `localStorage`
 *   into this tab's `sessionStorage`, so none stay at rest.
 * - Not logged in (the session expired, or the visitor logged out
 *   elsewhere): clears them. The grant is bound to the identity that
 *   approved it, so it must not carry over to the next person on a shared
 *   browser. A failed session check also reads as not logged in; the cost
 *   is entering the key again. */
export function BrowserSecretsGuard({ signedIn }: { signedIn: boolean }) {
  useEffect(() => {
    if (signedIn) migrateLegacySecrets();
    else clearBrowserAccountData();
  }, [signedIn]);
  return null;
}
