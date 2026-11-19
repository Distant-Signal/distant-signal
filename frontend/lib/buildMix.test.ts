import { beforeEach, describe, expect, it, vi } from 'vitest';

const info = vi.fn();
vi.mock('@/lib/logger', () => ({ createLogger: () => ({ info }) }));

import {
  BUILD_MIX_MAX_BUILDS,
  BUILD_MIX_WINDOW_MS,
  NO_BUILD,
  OTHER_BUILD,
  recordApiBuild,
  resetBuildMixForTests,
} from './buildMix';

const A = 'a'.repeat(24);
const B = 'b'.repeat(24);

describe('recordApiBuild', () => {
  beforeEach(() => {
    info.mockClear();
    resetBuildMixForTests();
  });

  it('logs nothing inside a window and one counts-only line after it', () => {
    recordApiBuild(A, 1000);
    recordApiBuild(A, 2000);
    recordApiBuild(B, 3000);
    recordApiBuild(null, 4000);
    expect(info).not.toHaveBeenCalled();
    recordApiBuild(A, 1000 + BUILD_MIX_WINDOW_MS);
    expect(info).toHaveBeenCalledTimes(1);
    expect(info).toHaveBeenCalledWith('api requests by frontend build', {
      window_seconds: 60,
      total: 4,
      builds: { [A]: 2, [B]: 1, [NO_BUILD]: 1 },
    });
    // The request that closed the window starts the next one.
    recordApiBuild(B, 1000 + 2 * BUILD_MIX_WINDOW_MS);
    expect(info).toHaveBeenLastCalledWith(
      'api requests by frontend build',
      expect.objectContaining({ total: 1, builds: { [A]: 1 } }),
    );
  });

  it('buckets anything that is not a build id as other', () => {
    recordApiBuild('<script>', 0);
    recordApiBuild('A'.repeat(24), 0);
    recordApiBuild('', 0);
    recordApiBuild(A, BUILD_MIX_WINDOW_MS);
    expect(info).toHaveBeenCalledWith(
      'api requests by frontend build',
      expect.objectContaining({ total: 3, builds: { [OTHER_BUILD]: 3 } }),
    );
  });

  it('keeps at most the cap of distinct builds apart, the rest as other', () => {
    for (let i = 0; i < BUILD_MIX_MAX_BUILDS + 5; i++) {
      recordApiBuild(i.toString(16).padStart(24, '0'), 0);
    }
    // An id already counted keeps counting under its own name.
    recordApiBuild('0'.repeat(24), 0);
    recordApiBuild(A, BUILD_MIX_WINDOW_MS);
    const fields = info.mock.calls[0]![1] as { builds: Record<string, number> };
    expect(Object.keys(fields.builds)).toHaveLength(BUILD_MIX_MAX_BUILDS + 1);
    expect(fields.builds[OTHER_BUILD]).toBe(5);
    expect(fields.builds['0'.repeat(24)]).toBe(2);
  });
});
