import { getCatalogueLineStations } from './api';
import { createLogger } from './logger';
import { SITEMAP_REVALIDATE_SECONDS } from './sitemap';
import type { LineSummary } from './types';

const log = createLogger('lib/sitemapCoverage');

/** Parallel requests when reading the lines' stations. */
const COVERAGE_CONCURRENCY = 8;

/** Every CRS code a catalogue line covers (each definition is cached for
 * `SITEMAP_REVALIDATE_SECONDS`), or `null` if any line's lookup fails:
 * a partial set would wrongly mark covered stations thin, so the sitemap
 * then lists every station. */
export async function coveredStations(lines: LineSummary[]): Promise<Set<string> | null> {
  const ids = lines.filter((line) => line.source === 'catalogue' && !line.id.startsWith('tfl-')).map((l) => l.id);
  const covered = new Set<string>();
  try {
    let next = 0;
    const worker = async (): Promise<void> => {
      for (let id = ids[next++]; id !== undefined; id = ids[next++]) {
        for (const crs of await getCatalogueLineStations(id, SITEMAP_REVALIDATE_SECONDS))
          covered.add(crs.toUpperCase());
      }
    };
    await Promise.all(Array.from({ length: Math.min(COVERAGE_CONCURRENCY, ids.length) }, worker));
  } catch (err) {
    log.warn('Line coverage failed; listing every station.', { error: err });
    return null;
  }
  return covered;
}
