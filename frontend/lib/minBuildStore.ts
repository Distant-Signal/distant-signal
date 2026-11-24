import { useSyncExternalStore } from 'react';
import { parseBuildEpoch } from '@/lib/buildEpoch';

let observed: number | null = null;
const listeners = new Set<() => void>();

/** Records the floor an `/api/*` response carried (`X-DS-Min-Build`). Only a
 * valid, higher value changes anything: a floor never falls within a page's
 * life, so one stale response cannot hide the hint. */
export function noteMinBuild(raw: string | null | undefined): void {
  const value = parseBuildEpoch(raw);
  if (value === null || (observed !== null && value <= observed)) return;
  observed = value;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The highest floor seen on any `/api/*` response so far, or null. */
export function useObservedMinBuild(): number | null {
  return useSyncExternalStore(
    subscribe,
    () => observed,
    () => null,
  );
}

/** Test helper. */
export function resetMinBuildStore(): void {
  observed = null;
  for (const listener of listeners) listener();
}
