import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const warn = vi.fn();
vi.mock('@/lib/logger', () => ({ createLogger: () => ({ warn }) }));
import { configuredMinBuild, resetMinBuildWarning } from './minBuild';

describe('configuredMinBuild', () => {
  beforeEach(() => {
    warn.mockClear();
    resetMinBuildWarning();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('is off when unset or empty, without a warning', () => {
    vi.stubEnv('FRONTEND_MIN_BUILD', '');
    expect(configuredMinBuild()).toBeNull();
    vi.stubEnv('FRONTEND_MIN_BUILD', '  ');
    expect(configuredMinBuild()).toBeNull();
    expect(warn).not.toHaveBeenCalled();
  });

  it('reads a whole number', () => {
    vi.stubEnv('FRONTEND_MIN_BUILD', '12');
    expect(configuredMinBuild()).toBe(12);
    expect(warn).not.toHaveBeenCalled();
  });

  it('ignores garbage and warns once per value', () => {
    vi.stubEnv('FRONTEND_MIN_BUILD', 'build.1-abc');
    expect(configuredMinBuild()).toBeNull();
    expect(configuredMinBuild()).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
