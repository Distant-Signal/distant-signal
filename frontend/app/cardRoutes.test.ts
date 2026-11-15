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
import { LIVE_PREVIEW_CACHE_CONTROL, PREVIEW_ERROR_CACHE_CONTROL } from '@/lib/livePreview';

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
    ['a malformed share token', () => sharedJourneyCard(request, ctx({ token: '../x' })), api.getPreviewSharedJourney],
    ['a malformed invite token', () => groupInviteCard(request, ctx({ token: 'a b' })), api.getPreviewGroupJoin],
    ['a malformed operator code', () => operatorCard(request, ctx({ code: '../x' })), api.getPreviewOperator],
  ])('answers %s with a cached 404', async (_name, call, read) => {
    const response = await call();
    expect(response.status).toBe(404);
    expect(response.headers.get('cache-control')).toBe(LIVE_PREVIEW_CACHE_CONTROL);
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
    ['shared journey', () => sharedJourneyCard(request, ctx({ token: 'abc' })), api.getPreviewSharedJourney],
    ['group invite', () => groupInviteCard(request, ctx({ token: 'abc' })), api.getPreviewGroupJoin],
  ])('for the %s card', async (_name, call, read) => {
    vi.mocked(read as () => Promise<unknown>).mockRejectedValue(new Error('api down'));
    const response = await call();
    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe(PREVIEW_ERROR_CACHE_CONTROL);
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
