import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, screen } from '@testing-library/react';
import { renderWithMantine } from '@/test/render';
import { LEAVE_BY_TICK_MS, LeaveByCountdown } from './LeaveByCountdown';
import type { LeaveBy } from '@/lib/types';

const LEAVE_BY: LeaveBy = { at: '2026-11-09T08:20:00Z', departure: '2026-11-09T08:42:00Z', basis: 'booked' };

describe('LeaveByCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('counts down every 30 seconds, then says leave now and announces it once', () => {
    vi.setSystemTime(new Date('2026-11-09T08:19:00Z'));
    renderWithMantine(<LeaveByCountdown leaveBy={LEAVE_BY} initialNow="2026-11-09T08:19:00Z" />);
    expect(screen.getByText('Leave by 08:20')).toBeInTheDocument();
    expect(screen.getByText('in 1 min')).toBeInTheDocument();
    expect(screen.queryByText('Leave now')).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(LEAVE_BY_TICK_MS);
    });
    expect(screen.getByText('in 1 min')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(LEAVE_BY_TICK_MS);
    });
    // The visible text, and the one announcement.
    expect(screen.getAllByText('Leave now')).toHaveLength(2);
    expect(screen.queryByText(/^in /)).not.toBeInTheDocument();
  });

  it('does not announce a leave-by that was already due', () => {
    vi.setSystemTime(new Date('2026-11-09T08:25:00Z'));
    renderWithMantine(<LeaveByCountdown leaveBy={LEAVE_BY} />);
    expect(screen.getAllByText('Leave now')).toHaveLength(1);
  });

  it('names a late train and hides once the train has left', () => {
    vi.setSystemTime(new Date('2026-11-09T08:10:00Z'));
    renderWithMantine(<LeaveByCountdown leaveBy={LEAVE_BY} delayMinutes={6} />);
    expect(screen.getByText('Leave by 08:20 · train expected 6 min late')).toBeInTheDocument();
    act(() => {
      vi.setSystemTime(new Date('2026-11-09T08:42:00Z'));
      vi.advanceTimersByTime(LEAVE_BY_TICK_MS);
    });
    expect(screen.queryByText(/Leave by/)).not.toBeInTheDocument();
  });

  it('says which train a suggestion is for', () => {
    vi.setSystemTime(new Date('2026-11-09T08:10:00Z'));
    renderWithMantine(
      <LeaveByCountdown
        leaveBy={{ at: '2026-11-09T08:35:00Z', departure: '2026-11-09T08:57:00Z', basis: 'suggestion' }}
      />,
    );
    expect(screen.getByText('Leave by 08:35 for the 08:57')).toBeInTheDocument();
  });
});
