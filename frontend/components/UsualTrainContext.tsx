'use client';

import { createContext, useContext, type ReactNode } from 'react';

/** Each leg's usual train UID, by leg id, on a regular journey's journey
 * opened from the pick reminder (`?pick=usual`, regular journeys design
 * §4.4): `JourneyLegCandidates` lists that train first, as "Your usual
 * train". Empty everywhere else. */
const UsualTrainContext = createContext<Readonly<Record<number, string>>>({});

export function UsualTrainProvider({ usual, children }: { usual: Record<number, string>; children: ReactNode }) {
  return <UsualTrainContext.Provider value={usual}>{children}</UsualTrainContext.Provider>;
}

/** The usual train's UID for leg `legId`, or `null`. */
export function useUsualTrainFor(legId: number): string | null {
  return useContext(UsualTrainContext)[legId] ?? null;
}
