import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithMantine } from '@/test/render';
import { LegReplanActions, type LegReplanContext } from './LegReplanActions';
import { MissedOfferProvider } from './MissedOfferContext';
import type { JourneyLegDetail } from '@/lib/types';
import { trainLeg } from '@/test/journeyFixtures';
import { testLegId } from '@/test/apiDefaults';
import { breakResponse, suggestionSet } from '@/test/replanFixtures';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/journeys/42',
  useSearchParams: () => new URLSearchParams(''),
}));

const context: LegReplanContext = {
  openBreakId: null,
  isBreakTrigger: false,
  suggestionsMuted: false,
};

function leg(state: Parameters<typeof trainLeg>[5] = {}) {
  return trainLeg(7, ['YRK', 'York'], ['EDB', 'Edinburgh'], '2026-09-17T08:52:00Z', '2026-09-17T11:19:00Z', {
    scheduleDestinationName: 'Edinburgh',
    ...state,
  });
}

function nextLeg(state: Parameters<typeof trainLeg>[5] = {}) {
  return trainLeg(8, ['EDB', 'Edinburgh'], ['GLQ', 'Glasgow'], '2026-09-17T12:30:00Z', '2026-09-17T13:30:00Z', state);
}

/** 08:30Z, before the 08:52Z departure: the train is still to come. */
const BEFORE = '2026-09-17T08:30:00Z';
/** After the 11:19Z arrival, within the window (it closes 03:00Z the next day). */
const AFTER_ARRIVAL = '2026-09-17T12:00:00Z';
const WINDOW_CLOSED = '2026-09-18T03:30:00Z';

/** The actions for `target`, on a page read at `now` whose legs are `legs`. */
function renderActions(
  target: JourneyLegDetail,
  now: string = BEFORE,
  ctx: LegReplanContext = context,
  legs: JourneyLegDetail[] = [target],
) {
  return renderWithMantine(
    <MissedOfferProvider legs={legs} initialNow={now}>
      <LegReplanActions journeyId="42" leg={target} context={ctx} />
    </MissedOfferProvider>,
  );
}

function stubFetch(body: unknown) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('LegReplanActions', () => {
  it('offers only "I missed this train" on an ordinary leg still to come', () => {
    renderActions(leg());
    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual(['I missed this train']);
  });

  it('offers "I missed this train" on the missable leg, and only looks for other trains', async () => {
    const fetchMock = stubFetch(suggestionSet());
    renderActions(leg());
    expect(screen.queryByRole('button', { name: 'Find another way' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'I missed this train' }));
    expect(await screen.findByText('10:04 York to Edinburgh, direct')).toBeInTheDocument();
    // Never the old `POST .../missed`, which opened a break just by looking.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(`/api/Journeys/42/legs/${testLegId(7)}/alternatives?cause=missed`, {
      method: 'GET',
    });
  });

  it('titles the sheet "Other ways to ..." while it loads, never "You missed the ..."', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>(() => {})),
    );
    renderActions(leg());
    fireEvent.click(screen.getByRole('button', { name: 'I missed this train' }));
    expect(screen.getByRole('heading', { name: 'Other ways to Edinburgh' })).toBeInTheDocument();
    expect(screen.queryByText(/You missed/)).not.toBeInTheDocument();
  });

  it('never offers "I missed this train" on a cancelled train', () => {
    renderActions(leg({ status: 'cancelled' }));
    expect(screen.queryByRole('button', { name: 'I missed this train' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Find another way' })).toBeInTheDocument();
  });

  it('finds other trains for a cancelled leg with no break open', async () => {
    const fetchMock = stubFetch(suggestionSet());
    renderActions(leg({ status: 'cancelled' }));
    fireEvent.click(screen.getByRole('button', { name: 'Find another way' }));
    expect(await screen.findByText('10:04 York to Edinburgh, direct')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(`/api/Journeys/42/legs/${testLegId(7)}/alternatives?cause=cancelled`, {
      method: 'GET',
    });
  });

  it("opens the open break's suggestions on its trigger leg", async () => {
    const fetchMock = stubFetch(breakResponse());
    renderActions(leg(), BEFORE, { ...context, openBreakId: 5, isBreakTrigger: true });
    fireEvent.click(screen.getByRole('button', { name: 'Find another way' }));
    expect(await screen.findByText('10:04 York to Edinburgh, direct')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/Journeys/42/breaks/current', { method: 'GET' });
  });

  it('offers a small "I missed this one" once the train has run on to its destination', async () => {
    const fetchMock = stubFetch(suggestionSet());
    renderActions(leg({ status: 'completed' }), AFTER_ARRIVAL);
    expect(screen.queryByRole('button', { name: 'I missed this train' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'I missed this one' }));
    expect(await screen.findByText('10:04 York to Edinburgh, direct')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(`/api/Journeys/42/legs/${testLegId(7)}/alternatives?cause=missed`, {
      method: 'GET',
    });
  });

  it('offers the small button on a leg whose train departed but has not arrived, while a later leg is the main one', () => {
    const first = leg({ status: 'en_route' });
    const second = nextLeg();
    const view = renderActions(first, '2026-09-17T09:30:00Z', context, [first, second]);
    // The first train not yet over gets the main button.
    expect(screen.getByRole('button', { name: 'I missed this train' })).toBeInTheDocument();
    view.unmount();
    renderActions(second, '2026-09-17T09:30:00Z', context, [first, second]);
    expect(screen.getByRole('button', { name: 'I missed this one' })).toBeInTheDocument();
  });

  it('puts the main button on the first unfinished leg and a small one on a finished leg', () => {
    const first = leg({ status: 'completed' });
    const second = nextLeg();
    const view = renderActions(first, AFTER_ARRIVAL, context, [first, second]);
    expect(screen.getByRole('button', { name: 'I missed this one' })).toBeInTheDocument();
    view.unmount();
    renderActions(second, AFTER_ARRIVAL, context, [first, second]);
    expect(screen.getByRole('button', { name: 'I missed this train' })).toBeInTheDocument();
  });

  it("offers nothing once the leg's window has closed (04:00 London the next morning)", () => {
    renderActions(leg({ status: 'completed' }), WINDOW_CLOSED);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('offers nothing on a leg with no train picked', () => {
    const open = { ...leg(), trackedTrainState: null };
    renderActions(open, BEFORE, context, [open]);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  describe('as the clock moves on a page left open', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('drops the button once the window closes, without the page being read again', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-09-18T02:59:00Z'));
      renderActions(leg({ status: 'completed' }), '2026-09-18T02:59:00Z');
      expect(screen.getByRole('button', { name: 'I missed this one' })).toBeInTheDocument();
      act(() => {
        vi.setSystemTime(new Date('2026-09-18T03:01:00Z'));
        vi.advanceTimersByTime(30_000);
      });
      expect(screen.queryByRole('button', { name: 'I missed this one' })).not.toBeInTheDocument();
    });

    it('re-reads the clock when the tab is shown again', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-09-18T02:59:00Z'));
      renderActions(leg({ status: 'completed' }), '2026-09-18T02:59:00Z');
      expect(screen.getByRole('button', { name: 'I missed this one' })).toBeInTheDocument();
      act(() => {
        vi.setSystemTime(new Date('2026-09-18T03:01:00Z'));
        document.dispatchEvent(new Event('visibilitychange'));
      });
      expect(screen.queryByRole('button', { name: 'I missed this one' })).not.toBeInTheDocument();
    });
  });
});
