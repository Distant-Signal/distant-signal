import { beforeEach, describe, expect, it, vi } from 'vitest';

const info = vi.fn();
vi.mock('@/lib/logger', () => ({ createLogger: () => ({ info }) }));

import {
  BUILD_MIX_MAX_BUILDS,
  BUILD_MIX_WINDOW_MS,
  NONE_BROWSER,
  NONE_OTHER,
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
    recordApiBuild(A, null, 1000);
    recordApiBuild(A, null, 2000);
    recordApiBuild(B, null, 3000);
    recordApiBuild(null, 'same-origin', 4000);
    recordApiBuild(null, null, 5000);
    expect(info).not.toHaveBeenCalled();
    recordApiBuild(A, null, 1000 + BUILD_MIX_WINDOW_MS);
    expect(info).toHaveBeenCalledTimes(1);
    expect(info).toHaveBeenCalledWith('api requests by frontend build', {
      window_seconds: 60,
      total: 5,
      builds: { [A]: 2, [B]: 1, [NONE_BROWSER]: 1, [NONE_OTHER]: 1 },
    });
    // The request that closed the window starts the next one.
    recordApiBuild(B, null, 1000 + 2 * BUILD_MIX_WINDOW_MS);
    expect(info).toHaveBeenLastCalledWith(
      'api requests by frontend build',
      expect.objectContaining({ total: 1, builds: { [A]: 1 } }),
    );
  });

  it.each([
    ['missing header, same-origin', null, 'same-origin', NONE_BROWSER],
    ['missing header, cross-site', null, 'cross-site', NONE_OTHER],
    ['missing header, same-site', null, 'same-site', NONE_OTHER],
    ['missing header, none', null, 'none', NONE_OTHER],
    ['missing header, empty fetch site', null, '', NONE_OTHER],
    ['missing header, no fetch site', null, null, NONE_OTHER],
    ['missing header, odd casing', null, 'Same-Origin', NONE_OTHER],
    ['valid header, same-origin', A, 'same-origin', A],
    ['valid header, no fetch site', A, null, A],
    ['valid header, cross-site', A, 'cross-site', A],
    ['malformed header, same-origin', 'nope', 'same-origin', OTHER_BUILD],
    ['malformed header, no fetch site', 'nope', null, OTHER_BUILD],
    ['empty header, same-origin', '', 'same-origin', OTHER_BUILD],
  ])('classifies %s', (_name, header, fetchSite, bucket) => {
    recordApiBuild(header, fetchSite, 0);
    recordApiBuild(A, null, BUILD_MIX_WINDOW_MS);
    expect(info).toHaveBeenCalledWith(
      'api requests by frontend build',
      expect.objectContaining({ total: 1, builds: { [bucket]: 1 } }),
    );
  });

  it('never emits the legacy none key and does not log fetch metadata', () => {
    recordApiBuild(null, 'same-origin', 0);
    recordApiBuild(null, 'cross-site', 0);
    recordApiBuild(A, null, BUILD_MIX_WINDOW_MS);
    const logged = JSON.stringify(info.mock.calls);
    expect(logged).not.toContain('"none"');
    expect(logged).not.toContain('same-origin');
    expect(logged).not.toContain('cross-site');
  });

  it('buckets anything that is not a build id as other', () => {
    recordApiBuild('<script>', 'same-origin', 0);
    recordApiBuild('A'.repeat(24), null, 0);
    recordApiBuild('', 'same-origin', 0);
    recordApiBuild(A, null, BUILD_MIX_WINDOW_MS);
    expect(info).toHaveBeenCalledWith(
      'api requests by frontend build',
      expect.objectContaining({ total: 3, builds: { [OTHER_BUILD]: 3 } }),
    );
  });

  it('keeps at most the cap of distinct builds apart, the rest as other', () => {
    for (let i = 0; i < BUILD_MIX_MAX_BUILDS + 5; i++) {
      recordApiBuild(i.toString(16).padStart(24, '0'), null, 0);
    }
    // An id already counted keeps counting under its own name.
    recordApiBuild('0'.repeat(24), null, 0);
    recordApiBuild(A, null, BUILD_MIX_WINDOW_MS);
    const fields = info.mock.calls[0]![1] as { builds: Record<string, number> };
    expect(Object.keys(fields.builds)).toHaveLength(BUILD_MIX_MAX_BUILDS + 1);
    expect(fields.builds[OTHER_BUILD]).toBe(5);
    expect(fields.builds['0'.repeat(24)]).toBe(2);
  });

  it('keeps the no-header buckets from using up the build cap', () => {
    recordApiBuild(null, 'same-origin', 0);
    recordApiBuild(null, null, 0);
    for (let i = 0; i < BUILD_MIX_MAX_BUILDS; i++) {
      recordApiBuild(i.toString(16).padStart(24, '0'), null, 0);
    }
    recordApiBuild(A, null, BUILD_MIX_WINDOW_MS);
    const fields = info.mock.calls[0]![1] as { builds: Record<string, number> };
    expect(fields.builds[OTHER_BUILD]).toBeUndefined();
    expect(Object.keys(fields.builds)).toHaveLength(BUILD_MIX_MAX_BUILDS + 2);
  });
});
