'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { legsPhase } from '@/lib/homeJourneys';
import { missedOffer, type MissedOffer } from '@/lib/journeyBreak';
import { REFRESH_INTERVAL_MS } from '@/lib/refresh';
import type { JourneyLegDetail } from '@/lib/types';

interface MissedOfferValue {
  legs: readonly JourneyLegDetail[];
  now: Date;
}

const MissedOfferContext = createContext<MissedOfferValue | null>(null);

/** Keeps "I missed this train" honest on a page left open: which leg
 * offers it (the first train not yet over, or any train whose miss window
 * is open) depends on the clock, and the page's own `fetchedAt` is only as
 * fresh as its last render. The clock here moves on a timer and when the
 * tab is shown or focused again, so a button does not stay on a leg whose
 * window has closed, or wait on one that is over. */
export function MissedOfferProvider({
  legs,
  initialNow,
  children,
}: {
  legs: readonly JourneyLegDetail[];
  /** The instant the page's data was read: the clock until the first tick. */
  initialNow: string;
  children: ReactNode;
}) {
  const [now, setNow] = useState(() => new Date(initialNow));
  const tick = useCallback(() => setNow(new Date()), []);

  useEffect(() => {
    const timer = setInterval(tick, REFRESH_INTERVAL_MS);
    const onShown = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onShown);
    window.addEventListener('focus', onShown);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onShown);
      window.removeEventListener('focus', onShown);
    };
  }, [tick]);

  const value = useMemo(() => ({ legs, now }), [legs, now]);
  return <MissedOfferContext.Provider value={value}>{children}</MissedOfferContext.Provider>;
}

/** How `leg` offers "I missed this train" right now (`lib/journeyBreak`'s
 * `missedOffer`); `null` outside a provider. */
export function useMissedOffer(leg: JourneyLegDetail): MissedOffer {
  const value = useContext(MissedOfferContext);
  return value === null ? null : missedOffer(value.legs, leg, value.now);
}

/** Whether the journey is Past as of now: an accepted replacement then
 * moves it back to Upcoming, which the sheet says. */
export function useJourneyPast(): boolean {
  const value = useContext(MissedOfferContext);
  return value !== null && legsPhase(value.legs, value.now) === 'past';
}
