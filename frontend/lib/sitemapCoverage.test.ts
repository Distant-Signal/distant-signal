import { beforeEach, describe, expect, it, vi } from 'vitest';

const getCatalogueLineStations = vi.fn();
vi.mock('./api', () => ({ getCatalogueLineStations: (...args: unknown[]) => getCatalogueLineStations(...args) }));

import { coveredStations } from './sitemapCoverage';
import type { LineSummary } from './types';

const line = (id: string, source: LineSummary['source']): LineSummary => ({
  id,
  name: id,
  category: 'x',
  operators: [],
  source,
});

describe('coveredStations', () => {
  beforeEach(() => getCatalogueLineStations.mockReset());

  it('unions the stations of every catalogue line, upper-cased, skipping TfL and custom lines', async () => {
    getCatalogueLineStations.mockImplementation(async (id: string) => (id === 'a' ? ['eus', 'KGX'] : ['KGX', 'RDG']));
    const set = await coveredStations([
      line('a', 'catalogue'),
      line('b', 'catalogue'),
      line('tfl-x', 'tfl'),
      line('c', 'custom'),
    ]);
    expect(set).toEqual(new Set(['EUS', 'KGX', 'RDG']));
    expect(getCatalogueLineStations).toHaveBeenCalledTimes(2);
  });

  it('is null when any line fails, so no station is wrongly thin', async () => {
    getCatalogueLineStations.mockImplementation(async (id: string) => {
      if (id === 'b') throw new Error('down');
      return ['EUS'];
    });
    expect(await coveredStations([line('a', 'catalogue'), line('b', 'catalogue')])).toBeNull();
  });
});
