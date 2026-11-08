'use client';

import { createContext, useContext, type ReactNode } from 'react';

/** Each leg's usual train UID, by leg id, on a regular journey's journey
 * opened from the pick reminder (`?pick=usual`, regular journeys design
 * §4.4): `JourneyLegCandidates` lists that train first, as "Your usual
 * train". Empty everywhere else. */
const UsualTrainContext = createContext<Readonly<Record<number, string>>>({});

/** Whether this is a Remind-me regular journey's day (a manual
 * template's journey, DS-398): its legs' picks look from half an hour
 * before to an hour after the usual train (`remindPickSearch`). */
const RemindPickContext = createContext(false);

export function UsualTrainProvider({
  usual,
  remindPick = false,
  children,
}: {
  usual: Record<number, string>;
  remindPick?: boolean;
  children: ReactNode;
}) {
  return (
    <UsualTrainContext.Provider value={usual}>
      <RemindPickContext.Provider value={remindPick}>{children}</RemindPickContext.Provider>
    </UsualTrainContext.Provider>
  );
}

/** The usual train's UID for leg `legId`, or `null`. */
export function useUsualTrainFor(legId: number): string | null {
  return useContext(UsualTrainContext)[legId] ?? null;
}

/** Whether the legs' picks widen to the usual train's hour and a half. */
export function useRemindPick(): boolean {
  return useContext(RemindPickContext);
}
