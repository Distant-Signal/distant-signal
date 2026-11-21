import { expect, type APIRequestContext, type BrowserContext } from '@playwright/test';

// Shared by the screen-reader specs (screen-reader-tree.spec.ts,
// screen-reader-dynamic.spec.ts, keyboard-journey.spec.ts): the seeded
// owner's session and throwaway journeys made through the api on the seed's
// fixture trains (seed.sql: E2EMJ1 to E2EMJ3, ZMA to ZMB, tomorrow).

export const SESSION_COOKIE = process.env.E2E_SESSION_COOKIE;

const base = () => new URL(process.env.E2E_BASE_URL ?? 'http://localhost:3000');

/** Logs the context in as the seed's owner. */
export async function logIn(context: BrowserContext): Promise<void> {
  const url = base();
  await context.addCookies([
    {
      name: 'distant_signal_session',
      value: SESSION_COOKIE ?? '',
      domain: url.hostname,
      path: '/',
      expires: -1,
      httpOnly: true,
      secure: url.protocol === 'https:',
      sameSite: 'Lax',
    },
  ]);
}

/** Headers for a cookie-authenticated api call that changes something (the
 * api checks the Origin of a cookie mutation). */
export function ownerHeaders(): Record<string, string> {
  return { cookie: `distant_signal_session=${SESSION_COOKIE}`, origin: base().origin };
}

/** Tomorrow's date in London, the day the fixture trains run. */
export function londonTomorrow(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(
    new Date(Date.now() + 24 * 3600 * 1000),
  );
}

/** A journey of two fixture trains (E2EMJ1 09:00 and E2EMJ3 10:00, ZMA to
 * ZMB each), a walk between them (folded into a row on the page) and an
 * open leg, a time window with no train picked yet. Returns its public id. */
export async function createMultiLegJourney(request: APIRequestContext, name: string): Promise<string> {
  const tomorrow = londonTomorrow();
  const created = await request.post('/api/Journeys/itinerary', {
    headers: { ...ownerHeaders(), 'content-type': 'application/json' },
    data: {
      customName: name,
      legs: [
        { trainUid: 'E2EMJ1', serviceDate: tomorrow, originCrs: 'ZMA', destinationCrs: 'ZMB' },
        {
          kind: 'untracked',
          transitMode: 'walk',
          originName: 'Fixture Parkway',
          destinationName: 'Fixture Parkway Tram',
          plannedDeparture: `${tomorrow}T09:45:00Z`,
          plannedArrival: `${tomorrow}T09:50:00Z`,
        },
        { trainUid: 'E2EMJ3', serviceDate: tomorrow, originCrs: 'ZMA', destinationCrs: 'ZMB' },
      ],
    },
  });
  expect(created.ok(), await created.text()).toBe(true);
  const { journeyPublicId } = (await created.json()) as { journeyPublicId: string };
  const added = await request.post(`/api/Journeys/${journeyPublicId}/legs`, {
    headers: { ...ownerHeaders(), 'content-type': 'application/json' },
    data: {
      mode: 'window',
      originCrs: 'ZMB',
      destinationCrs: 'ZMA',
      serviceDate: tomorrow,
      departWindow: { after: '11:00', before: null },
    },
  });
  expect(added.ok(), await added.text()).toBe(true);
  return journeyPublicId;
}

/** Deletes a journey made by a spec. */
export async function deleteJourney(request: APIRequestContext, journeyPublicId: string): Promise<void> {
  await request.delete(`/api/Journeys/${journeyPublicId}`, { headers: ownerHeaders() });
}
