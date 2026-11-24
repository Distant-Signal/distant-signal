import { afterEach, describe, expect, it, vi } from 'vitest';
import { clientBuildEpoch, isBuildStale, parseBuildEpoch } from './buildEpoch';

describe('parseBuildEpoch', () => {
  it.each([
    ['1', 1],
    ['42', 42],
    [' 7 ', 7],
    ['123456789012345', 123456789012345],
  ])('reads %j as %d', (text, expected) => {
    expect(parseBuildEpoch(text)).toBe(expected);
  });

  it.each([
    undefined,
    null,
    '',
    ' ',
    '0',
    '007',
    '-3',
    '1.5',
    '1e3',
    'abc',
    'build.12-abc',
    'c'.repeat(24),
    '1234567890123456',
  ])('gives null for %j', (text) => {
    expect(parseBuildEpoch(text)).toBeNull();
  });
});

describe('isBuildStale', () => {
  it('is stale only when own is below the floor', () => {
    expect(isBuildStale(1, 2)).toBe(true);
    expect(isBuildStale(2, 2)).toBe(false);
    expect(isBuildStale(3, 2)).toBe(false);
  });

  it('is never stale when either side is unknown', () => {
    expect(isBuildStale(null, 2)).toBe(false);
    expect(isBuildStale(1, null)).toBe(false);
    expect(isBuildStale(null, null)).toBe(false);
  });
});

describe('clientBuildEpoch', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('reads the inlined epoch', () => {
    vi.stubEnv('NEXT_PUBLIC_BUILD_EPOCH', '5');
    expect(clientBuildEpoch()).toBe(5);
  });

  it('is null when missing or garbage', () => {
    vi.stubEnv('NEXT_PUBLIC_BUILD_EPOCH', '');
    expect(clientBuildEpoch()).toBeNull();
    vi.stubEnv('NEXT_PUBLIC_BUILD_EPOCH', 'dev');
    expect(clientBuildEpoch()).toBeNull();
  });
});
