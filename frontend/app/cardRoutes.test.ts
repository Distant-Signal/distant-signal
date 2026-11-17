// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '@/lib/api';
import { ApiNotFoundError } from '@/lib/api';
import { GET as incidentCard } from './incidents/[id]/card.png/route';
import { GET as trainCard } from './train/[uid]/[date]/card.png/route';
import { GET as transitIncidentCard } from './transit/[network]/incidents/[id]/card.png/route';
import { GET as stationCard } from './stations/[crs]/card.png/route';
import { GET as sharedJourneyCard } from './journeys/shared/[token]/card.png/route';
import { GET as groupInviteCard } from './groups/join/[token]/card.png/route';
import { GET as operatorCard } from './operators/[code]/history/card.png/route';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  LIVE_PREVIEW_CACHE_CONTROL,
  PREVIEW_ERROR_CACHE_CONTROL,
  TOKEN_PREVIEW_CACHE_CONTROL,
} from '@/lib/livePreview';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    getPreviewIncident: vi.fn(),
    getPreviewTrain: vi.fn(),
    getPreviewTransitSituation: vi.fn(),
    getPreviewTransitNetwork: vi.fn(),
    getPreviewStationName: vi.fn(),
    getPreviewStopPointDisruption: vi.fn(),
    getPreviewSharedJourney: vi.fn(),
    getPreviewGroupJoin: vi.fn(),
    getPreviewOperator: vi.fn(),
  };
});

const request = new Request('https://ds.example/card.png');
const ctx = <T extends Record<string, string>>(params: T) => ({ params: Promise.resolve(params) });

beforeEach(() => {
  vi.resetAllMocks();
});

describe('card routes: shapes are checked before any request is built', () => {
  it.each([
    ['an incident id that is not an id', () => incidentCard(request, ctx({ id: '../x' })), api.getPreviewIncident],
    ['an overlong incident id', () => incidentCard(request, ctx({ id: 'a'.repeat(129) })), api.getPreviewIncident],
    [
      'an impossible train date',
      () => trainCard(request, ctx({ uid: 'W12345', date: '2026-02-30' })),
      api.getPreviewTrain,
    ],
    [
      'an overlong transit incident id',
      () => transitIncidentCard(request, ctx({ network: 'metrolink', id: 'a'.repeat(129) })),
      api.getPreviewTransitSituation,
    ],
    ['a malformed operator code', () => operatorCard(request, ctx({ code: '../x' })), api.getPreviewOperator],
  ])('answers %s with a cached 404', async (_name, call, read) => {
    const response = await call();
    expect(response.status).toBe(404);
    expect(response.headers.get('cache-control')).toBe(LIVE_PREVIEW_CACHE_CONTROL);
    expect(read).not.toHaveBeenCalled();
  });

  it.each([
    ['a malformed share token', () => sharedJourneyCard(request, ctx({ token: '../x' })), api.getPreviewSharedJourney],
    ['a malformed invite token', () => groupInviteCard(request, ctx({ token: 'a b' })), api.getPreviewGroupJoin],
  ])('answers %s with a 404 stored nowhere', async (_name, call, read) => {
    const response = await call();
    expect(response.status).toBe(404);
    expect(response.headers.get('cache-control')).toBe(TOKEN_PREVIEW_CACHE_CONTROL);
    expect(read).not.toHaveBeenCalled();
  });

  it('keeps the capability routes noindexed even on a 404', async () => {
    expect((await sharedJourneyCard(request, ctx({ token: '../x' }))).headers.get('x-robots-tag')).toBe('noindex');
    expect((await groupInviteCard(request, ctx({ token: 'a b' }))).headers.get('x-robots-tag')).toBe('noindex');
  });
});

describe('card routes: an api outage is a short-lived 503, never an uncached 500', () => {
  it.each([
    ['incident', () => incidentCard(request, ctx({ id: '12345' })), api.getPreviewIncident],
    ['train', () => trainCard(request, ctx({ uid: 'W12345', date: '2026-10-30' })), api.getPreviewTrain],
  ])('for the %s card', async (_name, call, read) => {
    vi.mocked(read as () => Promise<unknown>).mockRejectedValue(new Error('api down'));
    const response = await call();
    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe(PREVIEW_ERROR_CACHE_CONTROL);
    expect(response.headers.get('x-robots-tag')).toBe('noindex');
  });

  it.each([
    ['shared journey', () => sharedJourneyCard(request, ctx({ token: 'abc' })), api.getPreviewSharedJourney],
    ['group invite', () => groupInviteCard(request, ctx({ token: 'abc' })), api.getPreviewGroupJoin],
  ])('for the %s card, stored nowhere', async (_name, call, read) => {
    vi.mocked(read as () => Promise<unknown>).mockRejectedValue(new Error('api down'));
    const response = await call();
    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe(TOKEN_PREVIEW_CACHE_CONTROL);
    expect(response.headers.get('x-robots-tag')).toBe('noindex');
  });

  it('for the station card when its disruptions cannot be read', async () => {
    vi.mocked(api.getPreviewStationName).mockResolvedValue('Woking');
    vi.mocked(api.getPreviewStopPointDisruption).mockRejectedValue(new Error('api down'));
    const response = await stationCard(request, ctx({ crs: 'WOK' }));
    expect(response.status).toBe(503);
  });

  it('but an unknown resource is still a plain cached 404', async () => {
    vi.mocked(api.getPreviewIncident).mockRejectedValue(new ApiNotFoundError('no'));
    const response = await incidentCard(request, ctx({ id: '12345' }));
    expect(response.status).toBe(404);
    expect(response.headers.get('cache-control')).toBe(LIVE_PREVIEW_CACHE_CONTROL);
  });
});

describe('capability-token cards: nothing outlives a revoked link', () => {
  it('sends the card itself with no-store, noindexed', async () => {
    vi.mocked(api.getPreviewGroupJoin).mockResolvedValue({ groupName: 'Commuters', memberCount: 3 } as never);
    const response = await groupInviteCard(request, ctx({ token: 'abc' }));
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/png');
    expect(response.headers.get('cache-control')).toBe(TOKEN_PREVIEW_CACHE_CONTROL);
    expect(response.headers.get('cache-control')).not.toMatch(/public|max-age|stale-while-revalidate/);
    expect(response.headers.get('x-robots-tag')).toBe('noindex');
  }, 30_000);

  it('answers the first fetch after a revoke with a 404, never the old card', async () => {
    vi.mocked(api.getPreviewGroupJoin).mockResolvedValueOnce({ groupName: 'Commuters', memberCount: 3 } as never);
    expect((await groupInviteCard(request, ctx({ token: 'abc' }))).status).toBe(200);
    vi.mocked(api.getPreviewGroupJoin).mockRejectedValueOnce(new ApiNotFoundError('revoked'));
    const after = await groupInviteCard(request, ctx({ token: 'abc' }));
    expect(after.status).toBe(404);
    expect(after.headers.get('cache-control')).toBe(TOKEN_PREVIEW_CACHE_CONTROL);
    vi.mocked(api.getPreviewSharedJourney).mockRejectedValueOnce(new ApiNotFoundError('revoked'));
    expect((await sharedJourneyCard(request, ctx({ token: 'abc' }))).status).toBe(404);
  }, 30_000);
});

/** Every `card.png/route.tsx` under `app/`. */
function cardRoutes(dir = 'app'): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (!statSync(path).isDirectory()) return [];
    return name === 'card.png' ? [join(path, 'route.tsx')] : cardRoutes(path);
  });
}

describe('card routes: rendered per request, never ISR', () => {
  // ISR would keep a card for a year and serve a stale one once while it
  // regenerates (a revoked share link's card), store a failed read's 503 in
  // place of a good card, and write a file for every id tried
  // (`lib/livePreview.ts`, "Caching").
  const routes = cardRoutes();

  it('finds every card route', () => {
    expect(routes.length).toBeGreaterThanOrEqual(14);
  });

  it.each(routes)('%s is force-dynamic and guarded', (route) => {
    const source = readFileSync(route, 'utf8').replace(/\/\/.*$/gm, '');
    expect(source).toMatch(/^export const dynamic = 'force-dynamic';$/m);
    expect(source).not.toMatch(/export const revalidate|generateStaticParams|export const dynamicParams/);
    expect(source).toMatch(/^export const GET = guardPreview\(handle(, \{ token: true \})?\);$/m);
    const token = route.includes('[token]');
    expect(source.includes('{ token: true }')).toBe(token);
    expect(source.includes('TOKEN_PREVIEW_CACHE_CONTROL')).toBe(token);
    expect(source.includes('LIVE_PREVIEW_CACHE_CONTROL')).toBe(!token);
  });
});
