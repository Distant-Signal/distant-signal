// The seed's `fixture-miss` user and what it owns (e2e/fixtures/seed.sql,
// "The missed-train flow and the group dialogs"): journey 900401 whose one
// leg left 20 minutes before the seeding and arrived 5 minutes before it
// (inside its miss window), journey 900402 whose window has closed, and two
// groups, one with the owner alone and one with a second member.
import type { BrowserContext, Page } from '@playwright/test';

export const MISS_SESSION_COOKIE = 'fixture-miss-session-token-0123456789abcdef';
export const FRIEND_SESSION_COOKIE = 'fixture-friend-session-token-0123456789abcdef';

/** The seed gives each journey the public id 'j_' and its id as 32 hex
 * digits (test/apiDefaults.ts's testPublicId). */
export const MISSED_JOURNEY = `j_${(900401).toString(16).padStart(32, '0')}`;
export const CLOSED_JOURNEY = `j_${(900402).toString(16).padStart(32, '0')}`;
export const SOLO_GROUP = 'fixture-solo-group';
export const PAIR_GROUP = 'fixture-pair-group';

export function baseUrl(): URL {
  return new URL(process.env.E2E_BASE_URL ?? 'http://localhost:3000');
}

/** Headers for a request made straight to the proxy as `token`'s user: the
 * session cookie and the Origin a cookie mutation needs. */
export function asUser(token: string): Record<string, string> {
  return { cookie: `distant_signal_session=${token}`, origin: baseUrl().origin, 'content-type': 'application/json' };
}

export async function logInAs(context: BrowserContext, token: string): Promise<void> {
  const base = baseUrl();
  await context.addCookies([
    {
      name: 'distant_signal_session',
      value: token,
      domain: base.hostname,
      path: '/',
      expires: -1,
      httpOnly: true,
      secure: base.protocol === 'https:',
      sameSite: 'Lax',
    },
  ]);
}

/** The first leg's public id of a journey, read through the proxy. */
export async function firstLegId(
  request: Page['request'],
  journeyId: string,
  token: string = MISS_SESSION_COOKIE,
): Promise<string> {
  const response = await request.get(`/api/Journeys/${journeyId}`, { headers: asUser(token) });
  if (!response.ok()) throw new Error(`GET journey ${journeyId}: ${response.status()}`);
  const body = (await response.json()) as { legs: { publicId: string }[] };
  const leg = body.legs[0];
  if (!leg) throw new Error(`journey ${journeyId} has no legs`);
  return leg.publicId;
}
