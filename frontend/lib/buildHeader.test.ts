import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installBuildHeader } from './buildHeader';
import { noteMinBuild } from './minBuildStore';

vi.mock('./minBuildStore', () => ({ noteMinBuild: vi.fn() }));

const ID = 'c'.repeat(24);

describe('installBuildHeader', () => {
  let undo: () => void = () => undefined;
  let original: ReturnType<typeof vi.fn>;
  let realFetch: typeof fetch;

  beforeEach(() => {
    realFetch = window.fetch;
    original = vi.fn(() => Promise.resolve(new Response('{}')));
    window.fetch = original as unknown as typeof fetch;
  });

  afterEach(() => {
    undo();
    undo = () => undefined;
    window.fetch = realFetch;
    vi.unstubAllEnvs();
  });

  function headersOfCall(): Headers {
    return new Headers((original.mock.calls[0]![1] as RequestInit).headers);
  }

  it('adds the build id to a same-origin api call and keeps the call own headers', async () => {
    vi.stubEnv('NEXT_PUBLIC_BUILD_ID', ID);
    undo = installBuildHeader();
    await window.fetch('/api/preferences', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
    expect(headersOfCall().get('X-DS-Build')).toBe(ID);
    expect(headersOfCall().get('Content-Type')).toBe('application/json');
    expect((original.mock.calls[0]![1] as RequestInit).method).toBe('POST');
  });

  it('stamps a call with no init', async () => {
    vi.stubEnv('NEXT_PUBLIC_BUILD_ID', ID);
    undo = installBuildHeader();
    await window.fetch(new URL('/api/lines', window.location.origin));
    expect(headersOfCall().get('X-DS-Build')).toBe(ID);
  });

  it('leaves other origins and other paths alone', async () => {
    vi.stubEnv('NEXT_PUBLIC_BUILD_ID', ID);
    undo = installBuildHeader();
    await window.fetch('https://example.com/api/x');
    await window.fetch('/other');
    expect(original.mock.calls[0]).toEqual(['https://example.com/api/x', undefined]);
    expect(original.mock.calls[1]).toEqual(['/other', undefined]);
  });

  it('does nothing without a build id, and undo puts the original back', () => {
    vi.stubEnv('NEXT_PUBLIC_BUILD_ID', '');
    undo = installBuildHeader();
    expect(window.fetch).toBe(original);
    vi.stubEnv('NEXT_PUBLIC_BUILD_ID', ID);
    const undoReal = installBuildHeader();
    expect(window.fetch).not.toBe(original);
    undoReal();
    expect(window.fetch).toBe(original);
  });

  it('passes the floor an api response carries to the store, and none when absent', async () => {
    vi.stubEnv('NEXT_PUBLIC_BUILD_ID', ID);
    original.mockResolvedValueOnce(new Response('{}', { headers: { 'X-DS-Min-Build': '6' } }));
    undo = installBuildHeader();
    await window.fetch('/api/lines');
    expect(noteMinBuild).toHaveBeenLastCalledWith('6');
    await window.fetch('/api/lines');
    expect(noteMinBuild).toHaveBeenLastCalledWith(null);
  });
});
