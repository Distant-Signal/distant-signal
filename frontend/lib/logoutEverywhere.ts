import { clearBrowserAccountData, forgetThisDevicePush } from './browserAccountData';

/** "Log out everywhere": the request and what follows a 2xx.
 *
 * `POST /api/auth/logout-everywhere` ends every Distant Signal session the
 * account holds, this browser's included, clears the session cookie and
 * answers `{ endSessionUrl }`: the identity provider's end-session URL. The
 * site then sends the whole browser there (a top-level navigation, so the
 * provider's own cookies come with it), which ends this browser's provider
 * session and has the provider tell every connected app.
 *
 * The api only offers it when it is switched on (`SessionInfo.
 * logoutEverywhereEnabled`); nothing here fakes that. */

/** The url the api sent, when it is safe to navigate to: an absolute
 * `https` URL, no user info. Anything else (a missing or non-string value,
 * a relative or `http`, `javascript:` or `data:` URL) is `null`: the site
 * never follows a value it cannot vouch for. */
export function safeEndSessionUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.hostname === '' || url.username !== '' || url.password !== '') return null;
  return url.href;
}

/** Sends the request. First stops this device's push notifications, as
 * logging out does, while the session still exists to authorise it. */
export async function requestLogoutEverywhere(): Promise<Response> {
  await forgetThisDevicePush();
  return fetch('/api/auth/logout-everywhere', { method: 'POST' });
}

/** After a 2xx: clears the browser-held chat credentials, then navigates to
 * the end-session URL. If the body has no usable URL the account is still
 * logged out of Distant Signal everywhere (the api already ended every
 * session), so the page is refreshed into the logged-out state instead of
 * navigating. */
export async function finishLogoutEverywhere(refresh: () => void, response: Response): Promise<void> {
  let endSessionUrl: string | null = null;
  try {
    const body: unknown = await response.json();
    endSessionUrl = safeEndSessionUrl((body as { endSessionUrl?: unknown } | null)?.endSessionUrl);
  } catch {
    endSessionUrl = null;
  }
  clearBrowserAccountData();
  if (endSessionUrl === null) {
    refresh();
    return;
  }
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- an external https page that `safeEndSessionUrl` vouched for, not an internal Next.js one
  window.location.assign(endSessionUrl);
}
