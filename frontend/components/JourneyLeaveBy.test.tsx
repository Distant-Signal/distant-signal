import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithMantine } from '@/test/render';
import { JourneyLeaveBy } from './JourneyLeaveBy';
import type { LeaveBy } from '@/lib/types';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }));

const LEAVE_BY: LeaveBy = { at: '2099-11-09T08:20:00Z', departure: '2099-11-09T08:42:00Z', basis: 'booked' };

function render(canChange: boolean) {
  renderWithMantine(
    <JourneyLeaveBy
      journeyId={7}
      leaveBy={LEAVE_BY}
      stationBufferMinutes={22}
      delayMinutes={null}
      canChange={canChange}
      initialNow="2099-11-09T08:00:00Z"
    />,
  );
}

describe('JourneyLeaveBy', () => {
  beforeEach(() => {
    refresh.mockClear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('changes the minutes to get to the station for this journey', async () => {
    const fetchMock = vi.fn(async () => Response.json({ stationBufferMinutes: 30, leaveBy: LEAVE_BY }));
    vi.stubGlobal('fetch', fetchMock);
    render(true);
    expect(screen.getByText('Leave by 08:20')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Change' }));
    const field = await screen.findByLabelText(/^Minutes to get to the station/);
    expect(field).toHaveValue('22');
    fireEvent.change(field, { target: { value: '30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith('/api/Journeys/7/station-buffer', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ minutes: 30 }),
    });
  });

  it('says so when the change fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 500 })),
    );
    render(true);
    fireEvent.click(screen.getByRole('button', { name: 'Change' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Save' }));
    expect(await screen.findByText("Couldn't save the time to get to the station. Try again.")).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('offers no change on another day', () => {
    render(false);
    expect(screen.getByText('Leave by 08:20')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Change' })).not.toBeInTheDocument();
  });
});
