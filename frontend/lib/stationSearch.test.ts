import { afterEach, describe, expect, it, vi } from 'vitest';
import { __resetIrelandStationsForTests, rankStationResults, searchKey, searchStationsAndStops } from './stationSearch';
import type { Suggestion } from './types';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe('searchKey', () => {
  it('drops punctuation, folds case and spells & as and', () => {
    expect(searchKey("  King's Cross St. Pancras ")).toBe('kings cross st pancras');
    expect(searchKey('Elephant & Castle')).toBe('elephant and castle');
  });
});

describe('rankStationResults', () => {
  const rail = (code: string, name: string): Suggestion => ({ code, name });
  const tube = (id: string, name: string): Suggestion => ({
    code: `tfl:${id}`,
    name,
    place: { kind: 'tfl', stop: { id, name, modes: ['tube'], lines: [] } },
  });

  it('puts an exact Tube stop name ahead of station substring matches', () => {
    const ranked = rankStationResults('bank', [
      rail('BNK', 'Bankfoot'),
      rail('XYZ', 'Ashbank'),
      tube('940GZZLUBNK', 'Bank'),
    ]);
    expect(ranked.map((s) => s.name)).toEqual(['Bank', 'Bankfoot', 'Ashbank']);
  });

  it('keeps National Rail first within a tier, and a code match exact', () => {
    const ranked = rankStationResults('eus', [tube('940GZZLUEUS', 'Euston Square'), rail('EUS', 'London Euston')]);
    expect(ranked.map((s) => s.code)).toEqual(['EUS', 'tfl:940GZZLUEUS']);
    const same = rankStationResults('euston', [rail('EUS', 'Euston'), tube('940GZZLUEUS', 'Euston')]);
    expect(same.map((s) => s.code)).toEqual(['EUS', 'tfl:940GZZLUEUS']);
  });
});

describe('searchStationsAndStops', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    __resetIrelandStationsForTests();
  });

  it('adds Irish stations, named by network and leading to their pages, fetched once', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.startsWith('/api/stations')) return json([{ code: 'BNG', name: 'Bangor (Gwynedd)' }]);
      if (url === '/api/island-of-ireland/stations')
        return json([
          { id: 'nir-bangor', name: 'Bangor', network: 'northern-ireland', latitude: null, longitude: null },
          { id: 'nir-bangor-west', name: 'Bangor West', network: 'northern-ireland', latitude: null, longitude: null },
          {
            id: '8220IR0007',
            name: 'Dublin Connolly',
            network: 'republic-of-ireland',
            latitude: null,
            longitude: null,
          },
          { id: 'x', name: 'Bangor Mars', network: 'mars' },
        ]);
      return json({ networks: [] });
    });
    vi.stubGlobal('fetch', fetchMock);

    const results = await searchStationsAndStops('bangor');
    expect(results.map((s) => [s.code, s.name, s.detail])).toEqual([
      ['ireland:nir-bangor', 'Bangor', 'NI Railways station'],
      ['BNG', 'Bangor (Gwynedd)', undefined],
      ['ireland:nir-bangor-west', 'Bangor West', 'NI Railways station'],
    ]);
    expect(results[0]?.place).toEqual({ kind: 'ireland', href: '/island-of-ireland/ni-railways/stations/nir-bangor' });

    await searchStationsAndStops('connolly');
    expect(fetchMock.mock.calls.filter(([url]) => url === '/api/island-of-ireland/stations')).toHaveLength(1);
  });

  it('returns nothing for a blank query without fetching', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await searchStationsAndStops('  ')).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('merges stations, TfL stops and transit stops, each labelled by mode', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.startsWith('/api/stations')) return json([{ code: 'UXX', name: 'Uxbridge Road' }]);
        if (url.startsWith('/api/tfl/stops'))
          return json([
            { id: '940GZZLUUXB', name: 'Uxbridge', modes: ['tube'], lines: [{ id: 'piccadilly', name: 'Piccadilly' }] },
          ]);
        if (url === '/api/transit/networks')
          return json({ networks: [{ id: 'metrolink', name: 'Metrolink', mode: 'tram' }] });
        if (url === '/api/transit/metrolink/stops')
          return json({
            stops: [
              { id: '9400ZZMAUXB', name: 'Uxbridge Lane', lines: [], railLinks: [] },
              { id: '9400ZZMAALT', name: 'Altrincham', lines: [], railLinks: [] },
            ],
          });
        return json({}, 404);
      }),
    );

    const results = await searchStationsAndStops('uxbridge');

    expect(results.map((s) => [s.code, s.name, s.detail])).toEqual([
      ['tfl:940GZZLUUXB', 'Uxbridge', 'Tube: Piccadilly'],
      ['UXX', 'Uxbridge Road', undefined],
      ['transit:metrolink:9400ZZMAUXB', 'Uxbridge Lane', 'Metrolink tram stop'],
    ]);
    expect(results[2]?.place).toEqual({ kind: 'transit', network: 'metrolink', stopId: '9400ZZMAUXB' });
  });

  it('still returns stations when the TfL and transit lookups fail', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.startsWith('/api/stations')) return json([{ code: 'WOK', name: 'Woking' }]);
        if (url.startsWith('/api/tfl/stops')) throw new TypeError('network down');
        return json({}, 500);
      }),
    );

    expect(await searchStationsAndStops('woking')).toEqual([{ code: 'WOK', name: 'Woking' }]);
  });

  it('lets an abort through, so a stale search is dropped', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.startsWith('/api/tfl/stops')) throw new DOMException('aborted', 'AbortError');
        if (url.startsWith('/api/stations')) return json([]);
        return json({ networks: [] });
      }),
    );

    await expect(searchStationsAndStops('bank')).rejects.toThrow('aborted');
  });
});
