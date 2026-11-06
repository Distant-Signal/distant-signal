'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Group, Text, VisuallyHidden } from '@mantine/core';
import { leaveByLabel, leaveByPhase, minutesUntilLabel } from '@/lib/leaveBy';
import type { LeaveBy } from '@/lib/types';

/** How often the countdown moves on. */
export const LEAVE_BY_TICK_MS = 30_000;

/** A regular journey's leave-by (regular journeys design §5.4), a small
 * client island on the server-rendered home cards and on the journey
 * page: "Leave by 08:20" with "in 12 min", then "Leave now", and nothing
 * once the train has left. It ticks every 30 s and is not a live region:
 * only the change to "Leave now" is announced.
 *
 * `initialNow` is the time the server rendered with, so the first client
 * render matches it; the clock takes over once mounted. `action` sits
 * beside it (the journey page's "Change"). */
export function LeaveByCountdown({
  leaveBy,
  delayMinutes = null,
  initialNow,
  action,
}: {
  leaveBy: LeaveBy;
  /** The first train's expected lateness, if it is late. */
  delayMinutes?: number | null;
  /** ISO time the page was rendered at. */
  initialNow?: string | undefined;
  action?: ReactNode;
}) {
  const [now, setNow] = useState(() => (initialNow ? new Date(initialNow) : new Date()));
  const [announce, setAnnounce] = useState(false);
  const wasDue = useRef<boolean | null>(null);

  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const timer = setInterval(tick, LEAVE_BY_TICK_MS);
    return () => clearInterval(timer);
  }, []);

  const phase = leaveByPhase(leaveBy, now);
  const due = phase.kind === 'now';
  useEffect(() => {
    // Announce only a change to "Leave now" seen on this page, not a page
    // opened when it is already time.
    if (wasDue.current === false && due) {
      setAnnounce(true);
    }
    wasDue.current = due;
  }, [due]);

  if (phase.kind === 'gone') return null;
  return (
    <Group gap="xs" wrap="wrap">
      <Text size="sm" fw={600}>
        {leaveByLabel(leaveBy, delayMinutes)}
      </Text>
      {phase.kind === 'before' ? (
        <Text size="sm" c="dimmed">
          {minutesUntilLabel(phase.minutes)}
        </Text>
      ) : (
        <Text size="sm" fw={700}>
          Leave now
        </Text>
      )}
      {action}
      <VisuallyHidden aria-live="polite">{announce && due ? 'Leave now' : ''}</VisuallyHidden>
    </Group>
  );
}
