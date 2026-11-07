import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithMantine } from '@/test/render';
import { RepeatJourneyDialog } from './RepeatJourneyDialog';
import type { JourneyRepeat, RegularPlanOption } from '@/lib/types';

const pushMock = vi.fn();
const refreshMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
  usePathname: () => '/journeys/9',
  useSearchParams: () => new URLSearchParams(''),
}));

/** A bus to Woking 20 minutes before the train, then the train to London
 * Waterloo; UTC times (BST is +1). */
function option(uid: string, departs: string, arrives: string): RegularPlanOption {
  const at = (time: string, minutes = 0) =>
    new Date(Date.parse(`2099-08-05T${time}:00Z`) + minutes * 60_000).toISOString().replace('.000Z', 'Z');
  return {
    departure: at(departs, -20),
    arrival: at(arrives),
    changeCount: 0,
    legs: [
      {
        kind: 'untracked',
        transitMode: 'bus',
        originName: 'Home',
        destinationName: 'Woking',
        lineName: null,
        originStopId: null,
        destinationStopId: null,
        plannedDeparture: at(departs, -20),
        plannedArrival: at(departs, -5),
      },
      {
        kind: 'train',
        trainUid: uid,
        serviceDate: '2099-08-05',
        originCrs: 'WOK',
        originName: 'Woking',
        destinationCrs: 'WAT',
        destinationName: 'London Waterloo',
        departure: at(departs),
        arrival: at(arrives),
        operator: 'SW',
        operatorName: 'South Western Railway',
      },
    ],
  };
}

function repeat(overrides: Partial<JourneyRepeat> = {}): JourneyRepeat {
  return {
    status: 'planned',
    unsupported: null,
    date: '2099-08-05',
    time: '07:50',
    originalTime: '07:50',
    reason: 'usual',
    choice: option('W00001', '06:50', '07:20'),
    alternatives: [option('W00002', '07:20', '07:50')],
    via: [],
    ...overrides,
  };
}

function respond(status: number, body: unknown) {
  return Promise.resolve(
    new Response(typeof body === 'string' ? body : JSON.stringify(body), {
      status,
      headers: typeof body === 'string' ? {} : { 'Content-Type': 'application/json' },
    }),
  );
}

function open(
  mode: 'repeat' | 'move' = 'repeat',
  trackHref: string | null = '/track?mode=pick&origin=WOK',
  initialDate: string | null = null,
) {
  const onClose = vi.fn();
  renderWithMantine(
    <RepeatJourneyDialog
      journeyId={9}
      mode={mode}
      customName={mode === 'repeat' ? 'Commute' : null}
      trackHref={trackHref}
      initialDate={initialDate}
      opened
      onClose={onClose}
    />,
  );
  return onClose;
}

describe('RepeatJourneyDialog', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    pushMock.mockClear();
    refreshMock.mockClear();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('shows the same trains with the default date and time, and the others under them', async () => {
    vi.mocked(fetch).mockReturnValueOnce(respond(200, repeat()));
    open();
    expect(screen.getByText('Finding trains')).toBeInTheDocument();
    expect(await screen.findByText('The same trains as before.')).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith('/api/Journeys/9/repeat');
    expect(screen.getByLabelText('Time')).toHaveValue('07:50');
    expect(screen.getByText('Your first train was at 07:50.')).toBeInTheDocument();
    expect(screen.getByText('07:30 Home to London Waterloo')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Track this journey, the 07:30 Home to London Waterloo' }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Track this journey, the / })).toHaveLength(2);
  });

  it('plans again for the date and time chosen', async () => {
    vi.mocked(fetch)
      .mockReturnValueOnce(respond(200, repeat()))
      .mockReturnValueOnce(respond(200, repeat({ time: '08:20', reason: 'same_operator' })));
    open();
    await screen.findByText('The same trains as before.');
    fireEvent.change(screen.getByLabelText('Time'), { target: { value: '08:20' } });
    fireEvent.click(screen.getByRole('button', { name: 'Find trains' }));
    expect(await screen.findByText('The same operator, close to your time.')).toBeInTheDocument();
    expect(fetch).toHaveBeenLastCalledWith('/api/Journeys/9/repeat?date=2099-08-05&time=08%3A20');
  });

  it('saves a new journey with the trains picked, its name kept, and opens it', async () => {
    vi.mocked(fetch)
      .mockReturnValueOnce(respond(200, repeat()))
      .mockReturnValueOnce(respond(201, { journeyId: 42 }));
    open();
    fireEvent.click(await screen.findByRole('button', { name: /^Track this journey, the 07:30/ }));
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/journeys/42'));
    const [url, init] = vi.mocked(fetch).mock.calls[1] as [string, RequestInit];
    expect(url).toBe('/api/Journeys/itinerary');
    expect(JSON.parse(init.body as string)).toEqual({
      customName: 'Commute',
      legs: [
        {
          kind: 'untracked',
          transitMode: 'bus',
          originName: 'Home',
          destinationName: 'Woking',
          plannedDeparture: '2099-08-05T06:30:00Z',
          plannedArrival: '2099-08-05T06:45:00Z',
        },
        { trainUid: 'W00001', serviceDate: '2099-08-05', originCrs: 'WOK', destinationCrs: 'WAT' },
      ],
    });
  });

  it('moves this journey, previewing the plan as it stands', async () => {
    vi.mocked(fetch)
      .mockReturnValueOnce(respond(200, repeat()))
      .mockReturnValueOnce(respond(200, { journeyId: 9, revisionNo: 1, newLegIds: [3, 4], undoRevisionNo: null }));
    const onClose = open('move', null, '2099-08-05');
    expect(await screen.findByRole('dialog', { name: 'Move this journey' })).toBeInTheDocument();
    // On the journey's own day.
    expect(fetch).toHaveBeenCalledWith('/api/Journeys/9/repeat?basis=current&date=2099-08-05');
    fireEvent.click(await screen.findByRole('button', { name: /^Move to these trains, the 07:30/ }));
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
    expect(vi.mocked(fetch).mock.calls[1]?.[0]).toBe('/api/Journeys/9/move');
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("says the api's reason when a move is refused", async () => {
    vi.mocked(fetch)
      .mockReturnValueOnce(respond(200, repeat()))
      .mockReturnValueOnce(respond(409, "This journey has started, so it can't be moved."));
    open('move');
    fireEvent.click(await screen.findByRole('button', { name: /^Move to these trains, the 07:30/ }));
    expect(await screen.findByText("This journey has started, so it can't be moved.")).toBeInTheDocument();
  });

  it('says when the timetable for the day is not out yet', async () => {
    vi.mocked(fetch).mockReturnValueOnce(respond(200, repeat({ status: 'pending', choice: null, alternatives: [] })));
    open();
    expect(
      await screen.findByText("The timetable for that day isn't out yet. Try an earlier date."),
    ).toBeInTheDocument();
  });

  it('says when there is no way there that day', async () => {
    vi.mocked(fetch).mockReturnValueOnce(
      respond(200, repeat({ status: 'no_service', reason: null, choice: null, alternatives: [] })),
    );
    open();
    expect(
      await screen.findByText("There's no way to make this journey that day. Try another date or time."),
    ).toBeInTheDocument();
  });

  it('offers Track a train for a journey it cannot plan again', async () => {
    vi.mocked(fetch).mockReturnValueOnce(
      respond(
        200,
        repeat({ status: 'unsupported', unsupported: 'waypoints', originalTime: null, choice: null, alternatives: [] }),
      ),
    );
    open();
    expect(await screen.findByText("We can't plan a journey with a stop on the way again yet.")).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Track a train instead' })).toHaveAttribute(
      'href',
      '/track?mode=pick&origin=WOK',
    );
    expect(screen.queryByLabelText('Time')).not.toBeInTheDocument();
  });

  it('says it could not plan, and asks a logged-out visitor to log in', async () => {
    vi.mocked(fetch).mockReturnValueOnce(respond(503, 'busy'));
    open();
    expect(await screen.findByText("Couldn't plan this journey again. Try again.")).toBeInTheDocument();
    // Find trains still works with no day known yet: the api's default.
    vi.mocked(fetch).mockReturnValueOnce(respond(401, ''));
    fireEvent.click(screen.getByRole('button', { name: 'Find trains' }));
    expect(await screen.findByRole('link', { name: 'Log in to track this journey again' })).toBeInTheDocument();
  });
});
