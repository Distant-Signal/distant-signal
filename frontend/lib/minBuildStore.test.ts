import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { noteMinBuild, resetMinBuildStore, useObservedMinBuild } from './minBuildStore';

describe('min build store', () => {
  beforeEach(() => {
    resetMinBuildStore();
  });

  it('starts empty and takes a valid floor', () => {
    const { result } = renderHook(() => useObservedMinBuild());
    expect(result.current).toBeNull();
    act(() => noteMinBuild('4'));
    expect(result.current).toBe(4);
  });

  it('ignores garbage and missing values, and never lowers the floor', () => {
    const { result } = renderHook(() => useObservedMinBuild());
    act(() => noteMinBuild('4'));
    act(() => noteMinBuild(null));
    act(() => noteMinBuild('nope'));
    act(() => noteMinBuild('3'));
    expect(result.current).toBe(4);
    act(() => noteMinBuild('9'));
    expect(result.current).toBe(9);
  });
});
