import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderWithMantine } from '@/test/render';
import { AlternativesSheet, type AlternativesMode } from './AlternativesSheet';
import { testLegId } from '@/test/apiDefaults';
import { breakResponse, replanSuggestion, suggestionSet, trainSuggestionLeg } from '@/test/replanFixtures';

const refreshMock = vi.fn();
const router = { push: vi.fn(), refresh: refreshMock };
vi.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => '/journeys/42',
  useSearchParams: () => new URLSearchParams(''),
}));

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

type Handler = (init: RequestInit | undefined) => Response | Promise<Response>;

/** A fetch mock answering by method and path. */
function mockFetch(routes: Record<string, Handler>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const key = `${init?.method ?? 'GET'} ${String(input)}`;
    const handler = routes[key];
    if (!handler) throw new Error(`unexpected fetch ${key}`);
    return handler(init);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function renderSheet(mode: AlternativesMode = { kind: 'break', breakId: 5 }, onClose = vi.fn()) {
  renderWithMantine(
    <AlternativesSheet
      journeyId="42"
      mode={mode}
      opened
      onClose={onClose}
      fallbackTitle="Connection at York missed"
      canMute
    />,
  );
  return onClose;
}

const BREAK_URL = 'GET /api/Journeys/42/breaks/current';
const ACCEPT_URL = 'POST /api/Journeys/42/replan/accept';

beforeEach(() => {
  refreshMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('AlternativesSheet', () => {
  it('says it is loading, then shows the cards and more options', async () => {
    let resolve: (response: Response) => void = () => {};
    mockFetch({ [BREAK_URL]: () => new Promise<Response>((r) => (resolve = r)) });
    renderSheet();
    expect(screen.getByText('Loading trains')).toBeInTheDocument();
    await act(async () => resolve(json(breakResponse())));

    expect(await screen.findByText('10:04 York to Edinburgh, direct')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Connection at York missed' })).toBeInTheDocument();
    expect(screen.getByText('3 other ways to Edinburgh. First arrives 12:10.')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Take this one/ })).toHaveLength(2);
    const first = screen.getByText('10:04 York to Edinburgh, direct').closest('[data-suggestion]');
    expect(first).not.toBeNull();
    const card = within(first as HTMLElement);
    expect(card.getByText('Recommended')).toBeInTheDocument();
    expect(card.getByText('Same operator')).toBeInTheDocument();
    expect(card.getByText('Usually covered by your ticket')).toBeInTheDocument();
    expect(card.getByText('+12 min')).toBeInTheDocument();
    expect(card.getByText('Arrives 12 min after your booked time')).toBeInTheDocument();
    expect(card.getByText('Departs 10:04, arrives 12:31')).toBeInTheDocument();

    // The rest are behind "More options".
    expect(screen.queryByText('10:20 York to Edinburgh, direct')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'More options (1)' }));
    expect(await screen.findByText('10:20 York to Edinburgh, direct')).toBeInTheDocument();

    expect(screen.getByText('Your booked plan stays saved for Delay Repay.')).toBeInTheDocument();
  });

  it('notes an option whose change relies on a late train, on that option only', async () => {
    const twoLegs = replanSuggestion({
      changeCount: 1,
      legs: [
        trainSuggestionLeg({
          destinationCrs: 'NCL',
          destinationName: 'Newcastle',
          arrival: '2026-09-17T09:58:00Z',
          scheduledArrival: '2026-09-17T09:58:00Z',
        }),
        trainSuggestionLeg({
          trainUid: 'L22222',
          originCrs: 'NCL',
          originName: 'Newcastle',
          departure: '2026-09-17T10:05:00Z',
          scheduledDeparture: '2026-09-17T09:50:00Z',
          reliesOnLateDeparture: {
            scheduledDeparture: '2026-09-17T09:50:00Z',
            expectedDeparture: '2026-09-17T10:05:00Z',
            delayMinutes: 15,
            slackIfOnTimeMinutes: -13,
          },
        }),
      ],
    });
    const set = suggestionSet();
    mockFetch({
      [BREAK_URL]: () =>
        json(breakResponse({ suggestions: { ...set, suggestions: [twoLegs, ...set.suggestions.slice(1)] } })),
    });
    renderSheet();
    const notes = await screen.findAllByText(
      "Relies on the train to Edinburgh running late. It's due to leave at 11:05, booked 10:50. It could leave earlier.",
    );
    expect(notes).toHaveLength(1);
    expect(notes[0]!.closest('[data-suggestion]')?.getAttribute('data-suggestion')).toBe('s1');
  });

  it('opens with the push source when the deep link opened it', async () => {
    const fetchMock = mockFetch({ [`${BREAK_URL}?src=push`]: () => json(breakResponse()) });
    renderSheet({ kind: 'break', breakId: 5, fromPush: true });
    await screen.findByText('10:04 York to Edinburgh, direct');
    expect(fetchMock).toHaveBeenCalledWith('/api/Journeys/42/breaks/current?src=push', { method: 'GET' });
  });

  it('shows stale suggestions dimmed while it updates, then swaps them in place', async () => {
    let resolvePreview: (response: Response) => void = () => {};
    const fetchMock = mockFetch({
      [BREAK_URL]: () => json(breakResponse({ stale: true })),
      'POST /api/Journeys/42/replan/preview': () => new Promise<Response>((r) => (resolvePreview = r)),
    });
    renderSheet();
    expect(await screen.findByText('10:04 York to Edinburgh, direct')).toBeInTheDocument();
    expect(screen.getByText('Updating')).toBeInTheDocument();
    const list = document.querySelector('[data-suggestions]');
    expect(list).toHaveAttribute('data-updating', 'true');
    expect(list).toHaveAttribute('aria-busy', 'true');
    expect(screen.getAllByRole('button', { name: /^Take this one/ })[0]).toBeDisabled();
    const previewCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/replan/preview'));
    expect(previewCall?.[1]?.body).toBe(JSON.stringify({ breakId: 5 }));

    const fresh = suggestionSet({
      fingerprint: 'fp-2',
      suggestions: [
        replanSuggestion({
          id: 's9',
          departure: '2026-09-17T09:30:00Z',
          arrival: '2026-09-17T12:00:00Z',
          legs: [trainSuggestionLeg({ departure: '2026-09-17T09:30:00Z' })],
        }),
      ],
    });
    await act(async () => resolvePreview(json(breakResponse({ suggestions: fresh }))));

    expect(await screen.findByText('10:30 York to Edinburgh, direct')).toBeInTheDocument();
    expect(screen.queryByText('10:04 York to Edinburgh, direct')).not.toBeInTheDocument();
    expect(screen.queryByText('Updating')).not.toBeInTheDocument();
    expect(document.querySelector('[data-suggestions]')).not.toHaveAttribute('data-updating');
  });

  it('plans fresh suggestions when none are stored', async () => {
    mockFetch({
      [BREAK_URL]: () => json(breakResponse({ suggestions: null })),
      'POST /api/Journeys/42/replan/preview': () => json(breakResponse()),
    });
    renderSheet();
    expect(await screen.findByText('10:04 York to Edinburgh, direct')).toBeInTheDocument();
  });

  it('takes a suggestion, offers Undo for 2 minutes, then refreshes', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const fetchMock = mockFetch({
      [BREAK_URL]: () => json(breakResponse()),
      [ACCEPT_URL]: () => json({ journeyId: 42, revisionNo: 4, newLegIds: [11], undoRevisionNo: 3 }),
    });
    renderSheet();
    fireEvent.click(await screen.findByRole('button', { name: 'Take this one: 10:04 York to Edinburgh, direct' }));

    expect(await screen.findByText('Journey updated. Booked plan saved.')).toBeInTheDocument();
    const call = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/replan/accept'));
    expect(call?.[1]?.body).toBe(JSON.stringify({ breakId: 5, suggestionId: 's1', fingerprint: 'fp-1' }));
    const headers = call?.[1]?.headers as Record<string, string>;
    expect(headers['Idempotency-Key']).toMatch(/^[0-9a-f-]{36}$/);
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();
    expect(screen.getByText('You can undo this for 2 minutes.')).toBeInTheDocument();
    expect(refreshMock).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(119_000);
    });
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument();
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it('undoes a change by reverting to the earlier plan', async () => {
    const onClose = vi.fn();
    const fetchMock = mockFetch({
      [BREAK_URL]: () => json(breakResponse()),
      [ACCEPT_URL]: () => json({ journeyId: 42, revisionNo: 4, newLegIds: [11], undoRevisionNo: 3 }),
      'POST /api/Journeys/42/revisions/3/revert': () =>
        json({ journeyId: 42, revisionNo: 5, newLegIds: [7], undoRevisionNo: null }),
    });
    renderSheet({ kind: 'break', breakId: 5 }, onClose);
    fireEvent.click(await screen.findByRole('button', { name: 'Take this one: 10:04 York to Edinburgh, direct' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Undo' }));

    expect(await screen.findByText('Your earlier plan is back.')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/Journeys/42/revisions/3/revert', { method: 'POST' });
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onClose).toHaveBeenCalled();
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it('swaps in the latest options when the chosen train no longer works', async () => {
    const latest = suggestionSet({
      fingerprint: 'fp-3',
      suggestions: [
        replanSuggestion({
          id: 's4',
          departure: '2026-09-17T09:40:00Z',
          legs: [trainSuggestionLeg({ departure: '2026-09-17T09:40:00Z' })],
        }),
      ],
    });
    mockFetch({
      [BREAK_URL]: () => json(breakResponse()),
      [ACCEPT_URL]: () =>
        json({ error: 'suggestion_stale', message: 'stale', break: breakResponse({ suggestions: latest }) }, 409),
    });
    renderSheet();
    fireEvent.click(await screen.findByRole('button', { name: 'Take this one: 10:04 York to Edinburgh, direct' }));

    expect(await screen.findByText('That train no longer works. Here are the latest options.')).toBeInTheDocument();
    expect(screen.getByText('10:40 York to Edinburgh, direct')).toBeInTheDocument();
    expect(screen.queryByText('10:04 York to Edinburgh, direct')).not.toBeInTheDocument();
  });

  it('says it could not load other trains', async () => {
    mockFetch({ [BREAK_URL]: () => new Response('busy', { status: 503 }) });
    renderSheet();
    expect(await screen.findByText("Couldn't load other trains. Try again.")).toBeInTheDocument();
  });

  it('says it could not update the journey', async () => {
    mockFetch({
      [BREAK_URL]: () => json(breakResponse()),
      [ACCEPT_URL]: () => new Response('oops', { status: 500 }),
    });
    renderSheet();
    fireEvent.click(await screen.findByRole('button', { name: 'Take this one: 10:04 York to Edinburgh, direct' }));
    expect(await screen.findByText("Couldn't update the journey. Try again.")).toBeInTheDocument();
  });

  it('only looks when "I missed this train" opens: nothing recorded, nothing to refresh on close', async () => {
    const onClose = vi.fn();
    const fetchMock = mockFetch({
      [`GET /api/Journeys/42/legs/${testLegId(7)}/alternatives?cause=missed`]: () => json(suggestionSet()),
    });
    renderSheet({ kind: 'missed', legId: testLegId(7) }, onClose);
    // Only looking: a neutral title, never "You missed the ...".
    expect(await screen.findByRole('heading', { name: 'Other ways to Edinburgh' })).toBeInTheDocument();
    expect(screen.queryByText(/You missed/)).not.toBeInTheDocument();
    // A first leg has no change onto it: a miss would be the traveller's.
    expect(
      screen.queryByText('Your earlier train was late, so this counts as a missed connection.'),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
    // Closing without taking a train leaves the journey as it was: no
    // break was opened, so there is no "You missed" banner to show.
    expect(refreshMock).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls.map(([, init]) => init?.method ?? 'GET')).toEqual(['GET']);
  });

  it('records the miss only when another train is taken', async () => {
    const fetchMock = mockFetch({
      [`GET /api/Journeys/42/legs/${testLegId(7)}/alternatives?cause=missed`]: () => json(suggestionSet()),
      [`POST /api/Journeys/42/legs/${testLegId(7)}/replace`]: () =>
        json({ journeyId: 42, revisionNo: 2, newLegIds: [12], undoRevisionNo: 1 }),
    });
    renderSheet({ kind: 'missed', legId: testLegId(7) });
    fireEvent.click(await screen.findByRole('button', { name: 'Take this one: 10:04 York to Edinburgh, direct' }));
    expect(await screen.findByText('Journey updated. Booked plan saved.')).toBeInTheDocument();
    const call = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/replace'));
    expect(JSON.parse(String(call?.[1]?.body))).toMatchObject({ cause: 'missed', throughLegId: testLegId(7) });
  });

  it('falls back to the numeric leg ids where a set stored before the opaque ids has none', async () => {
    const stored = suggestionSet({
      fromLegPublicId: '',
      suggestions: [replanSuggestion({ throughLegPublicId: '' })],
    });
    const fetchMock = mockFetch({
      [`GET /api/Journeys/42/legs/${testLegId(7)}/alternatives?cause=missed`]: () => json(stored),
      'POST /api/Journeys/42/legs/7/replace': () =>
        json({ journeyId: 42, revisionNo: 2, newLegIds: [12], undoRevisionNo: 1 }),
    });
    renderSheet({ kind: 'missed', legId: testLegId(7) });
    fireEvent.click(await screen.findByRole('button', { name: 'Take this one: 10:04 York to Edinburgh, direct' }));
    expect(await screen.findByText('Journey updated. Booked plan saved.')).toBeInTheDocument();
    const call = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/replace'));
    expect(JSON.parse(String(call?.[1]?.body))).toMatchObject({ throughLegId: '7' });
  });

  it("says a miss after a late inbound train is the railway's", async () => {
    mockFetch({
      [`GET /api/Journeys/42/legs/${testLegId(7)}/alternatives?cause=missed`]: () => json(suggestionSet()),
    });
    renderSheet({ kind: 'missed', legId: testLegId(7), inboundLate: true });
    expect(
      await screen.findByText('Your earlier train was late, so this counts as a missed connection.'),
    ).toBeInTheDocument();
  });

  it("shows a break's own fault note", async () => {
    mockFetch({
      [BREAK_URL]: () =>
        json(breakResponse({ cause: 'user_missed', fault: 'operator', faultNote: 'You missed it by 2 min.' })),
    });
    renderSheet();
    expect(await screen.findByRole('heading', { name: 'You missed the 09:52 to Edinburgh' })).toBeInTheDocument();
    expect(screen.getByText('You missed it by 2 min.')).toBeInTheDocument();
  });

  /* The api's ticket advice (§17.5), one per variant: the sheet shows it
   * as given, once, after the fault note and before the Delay Repay note,
   * and adds no ticket line of its own. */
  describe.each([
    {
      variant: 'railway-caused',
      mode: { kind: 'break', breakId: 5 } as AlternativesMode,
      route: BREAK_URL,
      body: (hint: string) =>
        breakResponse({
          cause: 'user_missed',
          fault: 'operator',
          faultNote: 'Your earlier train was late, so this counts as a missed connection.',
          suggestions: suggestionSet({ hint }),
        }),
      hint: 'Ask station staff. Your ticket should be accepted on the next suitable train because your journey was disrupted. Check before you board.',
      faultNote: 'Your earlier train was late, so this counts as a missed connection.',
      plan: 'Your booked plan stays saved for Delay Repay.',
    },
    {
      variant: 'user-caused',
      mode: { kind: 'missed', legId: testLegId(7) } as AlternativesMode,
      route: `GET /api/Journeys/42/legs/${testLegId(7)}/alternatives?cause=missed`,
      body: (hint: string) => suggestionSet({ hint }),
      hint: "Ask station staff if there are any. Your Advance ticket is only valid on the train you missed, so you'll likely need a new one.",
      faultNote: null,
      plan: 'Your booked plan stays saved under Earlier plans. Because you missed this train, Delay Repay now compares your delay with the new plan, not the one you booked.',
    },
    {
      variant: 'unknown ticket',
      mode: { kind: 'missed', legId: testLegId(7) } as AlternativesMode,
      route: `GET /api/Journeys/42/legs/${testLegId(7)}/alternatives?cause=missed`,
      body: (hint: string) => suggestionSet({ hint }),
      hint: "Ask station staff if there are any. If you have an Advance ticket, you'll likely need a new one. Check before you board.",
      faultNote: null,
      plan: 'Your booked plan stays saved under Earlier plans. Because you missed this train, Delay Repay now compares your delay with the new plan, not the one you booked.',
    },
    {
      variant: 'flexible ticket',
      mode: { kind: 'alternatives', legId: testLegId(7), cause: 'cancelled' } as AlternativesMode,
      route: `GET /api/Journeys/42/legs/${testLegId(7)}/alternatives?cause=cancelled`,
      body: (hint: string) => suggestionSet({ hint }),
      hint: 'Your ticket is usually valid on other trains on the same route.',
      faultNote: null,
      plan: 'Your booked plan stays saved for Delay Repay.',
    },
  ])('ticket advice, $variant', ({ mode, route, body, hint, faultNote, plan }) => {
    it('shows the advice once, in order, and keeps the Delay Repay note', async () => {
      mockFetch({ [route]: () => json(body(hint)) });
      renderSheet(mode);
      const advice = await screen.findByText(hint);
      const booked = screen.getByText(plan);
      expect(advice.compareDocumentPosition(booked) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      if (faultNote !== null) {
        const note = screen.getByText(faultNote);
        expect(note.compareDocumentPosition(advice) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      }
      // Only the advice speaks about the ticket: no second line of its own.
      expect(screen.getAllByText(/ticket/i).filter((el) => el.closest('[data-suggestion]') === null)).toEqual([advice]);
      expect(screen.queryByText(/you'll likely need a new one/)).toBe(
        hint.includes("you'll likely need a new one") ? advice : null,
      );
    });
  });

  it('replaces the leg when taking a free choice', async () => {
    const fetchMock = mockFetch({
      [`GET /api/Journeys/42/legs/${testLegId(7)}/alternatives?cause=choice`]: () =>
        json(suggestionSet({ hint: 'Add your ticket.' })),
      [`POST /api/Journeys/42/legs/${testLegId(7)}/replace`]: () =>
        json({ journeyId: 42, revisionNo: 2, newLegIds: [12], undoRevisionNo: 1 }),
    });
    renderSheet({ kind: 'alternatives', legId: testLegId(7), cause: 'choice' });
    expect(await screen.findByRole('heading', { name: 'Other ways to Edinburgh' })).toBeInTheDocument();
    expect(screen.getByText('Add your ticket.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Take this one: 10:04 York to Edinburgh, direct' }));
    expect(await screen.findByText('Journey updated. Booked plan saved.')).toBeInTheDocument();
    const call = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/replace'));
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({
      cause: 'choice',
      legs: [{ trainUid: 'L12345', serviceDate: '2026-09-17', originCrs: 'YRK', destinationCrs: 'EDB' }],
      throughLegId: testLegId(7),
    });
  });

  describe('"I missed this train" after the train has gone', () => {
    const MISSED_URL = `GET /api/Journeys/42/legs/${testLegId(7)}/alternatives?cause=missed`;
    const REPLACE_URL = `POST /api/Journeys/42/legs/${testLegId(7)}/replace`;
    const MISSED: AlternativesMode = { kind: 'missed', legId: testLegId(7) };
    const arrivedSet = suggestionSet({ leg: { departed: true, arrived: true } });
    const accepted = { journeyId: 42, revisionNo: 2, newLegIds: [12], undoRevisionNo: 1 };

    it('asks once, softly, when the api says the train reached its destination, and cancels cleanly', async () => {
      const fetchMock = mockFetch({ [MISSED_URL]: () => json(arrivedSet) });
      const onClose = renderSheet(MISSED);
      expect(await screen.findByText('This train has already reached Edinburgh.')).toBeInTheDocument();
      expect(screen.getByText("Only use this if you didn't get on it.")).toBeInTheDocument();
      // Nothing to take until the traveller says so.
      expect(screen.queryByRole('button', { name: /^Take this one/ })).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(onClose).toHaveBeenCalled();
      // Looking wrote nothing.
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(refreshMock).not.toHaveBeenCalled();
    });

    it('shows the other trains once the traveller says they did not get on it', async () => {
      mockFetch({ [MISSED_URL]: () => json(arrivedSet) });
      renderSheet(MISSED);
      fireEvent.click(await screen.findByRole('button', { name: "I didn't get on it" }));
      expect(await screen.findByText('10:04 York to Edinburgh, direct')).toBeInTheDocument();
      expect(screen.queryByText('This train has already reached Edinburgh.')).not.toBeInTheDocument();
    });

    it.each([
      ['a train that departed but has not arrived', { departed: true, arrived: false }],
      ['a train still to leave', { departed: false, arrived: false }],
      ["a set with no facts (a break's stored one)", null],
    ])('does not ask for %s', async (_name, leg) => {
      mockFetch({ [MISSED_URL]: () => json(suggestionSet({ leg })) });
      renderSheet(MISSED);
      expect(await screen.findByText('10:04 York to Edinburgh, direct')).toBeInTheDocument();
      expect(screen.queryByText(/has already reached/)).not.toBeInTheDocument();
    });

    it('does not ask for a free choice or a cancelled train', async () => {
      mockFetch({
        [`GET /api/Journeys/42/legs/${testLegId(7)}/alternatives?cause=cancelled`]: () => json(arrivedSet),
      });
      renderSheet({ kind: 'alternatives', legId: testLegId(7), cause: 'cancelled' });
      expect(await screen.findByText('10:04 York to Edinburgh, direct')).toBeInTheDocument();
    });

    it("says where it is searching from, and starts at the leg's boarding station", async () => {
      mockFetch({ [MISSED_URL]: () => json(suggestionSet()) });
      renderSheet(MISSED);
      expect(await screen.findByText('Searching from York')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: "I'm somewhere else" })).toBeInTheDocument();
    });

    it('searches from another station when the traveller picks one, sending only its code', async () => {
      const elsewhere = suggestionSet({ originCrs: 'WOK', originName: 'Woking' });
      const fetchMock = mockFetch({
        [MISSED_URL]: () => json(suggestionSet()),
        [`${MISSED_URL}&from=WOK`]: () => json(elsewhere),
        'GET /api/stations?q=WOK': () => json([]),
      });
      renderSheet(MISSED);
      fireEvent.click(await screen.findByRole('button', { name: "I'm somewhere else" }));
      const field = screen.getByRole('combobox', { name: "Station you're at" });
      expect(screen.getByRole('button', { name: 'Search from here' })).toBeDisabled();
      fireEvent.change(field, { target: { value: 'wok' } });
      fireEvent.blur(field);
      fireEvent.click(await screen.findByRole('button', { name: 'Search from here' }));
      expect(await screen.findByText('Searching from Woking')).toBeInTheDocument();
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/Journeys/42/legs/${testLegId(7)}/alternatives?cause=missed&from=WOK`,
        {
          method: 'GET',
        },
      );
      // Taking one still replaces the leg that was missed.
      expect(screen.getByRole('button', { name: 'Search from the station you were due at' })).toBeInTheDocument();
    });

    it('goes back to the boarding station', async () => {
      const fetchMock = mockFetch({
        [MISSED_URL]: () => json(suggestionSet()),
        [`${MISSED_URL}&from=WOK`]: () => json(suggestionSet({ originCrs: 'WOK', originName: 'Woking' })),
        'GET /api/stations?q=WOK': () => json([]),
      });
      renderSheet(MISSED);
      fireEvent.click(await screen.findByRole('button', { name: "I'm somewhere else" }));
      const field = screen.getByRole('combobox', { name: "Station you're at" });
      fireEvent.change(field, { target: { value: 'WOK' } });
      fireEvent.blur(field);
      fireEvent.click(await screen.findByRole('button', { name: 'Search from here' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Search from the station you were due at' }));
      expect(await screen.findByText('Searching from York')).toBeInTheDocument();
      expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('alternatives'))).toHaveLength(3);
    });

    it('says an unknown station beside the field and keeps the list, as a refusal and not a failure', async () => {
      mockFetch({
        [MISSED_URL]: () => json(suggestionSet()),
        [`${MISSED_URL}&from=ZZZ`]: () =>
          json({ error: 'invalid_station', message: "We don't recognise that station." }, 400),
        'GET /api/stations?q=ZZZ': () => json([]),
      });
      renderSheet(MISSED);
      fireEvent.click(await screen.findByRole('button', { name: "I'm somewhere else" }));
      const field = screen.getByRole('combobox', { name: "Station you're at" });
      fireEvent.change(field, { target: { value: 'ZZZ' } });
      fireEvent.blur(field);
      fireEvent.click(await screen.findByRole('button', { name: 'Search from here' }));
      expect(await screen.findByText("We don't recognise that station.")).toBeInTheDocument();
      expect(screen.getByText('10:04 York to Edinburgh, direct')).toBeInTheDocument();
      expect(screen.queryByText("Couldn't load other trains")).not.toBeInTheDocument();
    });

    it('offers no search origin for a break', async () => {
      mockFetch({ [BREAK_URL]: () => json(breakResponse()) });
      renderSheet();
      expect(await screen.findByText('10:04 York to Edinburgh, direct')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: "I'm somewhere else" })).not.toBeInTheDocument();
    });

    it('answers a closed window with what happened and what to do next, not "Couldn\'t load"', async () => {
      mockFetch({
        [MISSED_URL]: () =>
          json({ error: 'miss_window_closed', message: "It's too late to change this journey." }, 409),
      });
      renderSheet(MISSED);
      expect(await screen.findByText("It's too late to change this journey.")).toBeInTheDocument();
      expect(screen.getByText(/To get there from here, plan a new journey/)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Plan a journey' })).toHaveAttribute('href', '/plan');
      expect(screen.queryByText(/Couldn't load/)).not.toBeInTheDocument();
    });

    it('recognises the closed window by its message alone, as the browser proxy shows it', async () => {
      mockFetch({ [MISSED_URL]: () => new Response("It's too late to change this journey.", { status: 409 }) });
      renderSheet(MISSED);
      expect(await screen.findByRole('link', { name: 'Plan a journey' })).toBeInTheDocument();
      expect(screen.queryByText(/Couldn't load/)).not.toBeInTheDocument();
    });

    it('says a choice on an arrived train is not possible, and points at "I missed this one"', async () => {
      mockFetch({
        [`GET /api/Journeys/42/legs/${testLegId(7)}/alternatives?cause=choice`]: () =>
          json({ error: 'leg_travelled', message: 'This leg is already travelled.' }, 409),
      });
      renderSheet({ kind: 'alternatives', legId: testLegId(7), cause: 'choice' });
      expect(await screen.findByText('This train has already arrived')).toBeInTheDocument();
      expect(screen.getByText(/use "I missed this one" instead/)).toBeInTheDocument();
      expect(screen.queryByText(/Couldn't load/)).not.toBeInTheDocument();
    });

    it('keeps "Couldn\'t load other trains" for a real failure', async () => {
      mockFetch({ [MISSED_URL]: () => new Response('boom', { status: 500 }) });
      renderSheet(MISSED);
      expect(await screen.findByText("Couldn't load other trains")).toBeInTheDocument();
      expect(screen.getByText(/Try again/)).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Plan a journey' })).not.toBeInTheDocument();
    });

    it('says so, with a next step, when taking a train meets a closed window', async () => {
      mockFetch({
        [MISSED_URL]: () => json(suggestionSet()),
        [REPLACE_URL]: () =>
          json({ error: 'miss_window_closed', message: "It's too late to change this journey." }, 409),
      });
      renderSheet(MISSED);
      fireEvent.click(await screen.findByRole('button', { name: 'Take this one: 10:04 York to Edinburgh, direct' }));
      expect(await screen.findByText("It's too late to change this journey.")).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Plan a journey' })).toBeInTheDocument();
      expect(screen.queryByText(/Couldn't update/)).not.toBeInTheDocument();
    });

    it("rewords the Delay Repay note for a miss that is the traveller's own", async () => {
      mockFetch({ [MISSED_URL]: () => json(suggestionSet()) });
      renderSheet(MISSED);
      expect(await screen.findByText(/Because you missed this train, Delay Repay now compares/)).toBeInTheDocument();
      expect(screen.queryByText('Your booked plan stays saved for Delay Repay.')).not.toBeInTheDocument();
    });

    it("keeps the old note for the railway's miss", async () => {
      mockFetch({ [MISSED_URL]: () => json(suggestionSet()) });
      renderSheet({ ...MISSED, inboundLate: true });
      expect(await screen.findByText('Your booked plan stays saved for Delay Repay.')).toBeInTheDocument();
    });

    it('keeps Undo until the new train leaves after a miss (at most an hour), and says so', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      vi.setSystemTime(new Date('2026-09-17T08:55:00Z'));
      mockFetch({ [MISSED_URL]: () => json(suggestionSet()), [REPLACE_URL]: () => json(accepted) });
      renderSheet(MISSED);
      // The first suggestion leaves at 09:04Z, nine minutes on.
      fireEvent.click(await screen.findByRole('button', { name: 'Take this one: 10:04 York to Edinburgh, direct' }));
      expect(await screen.findByText('You can undo this until your new train leaves.')).toBeInTheDocument();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(8 * 60_000);
      });
      expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();
      expect(refreshMock).not.toHaveBeenCalled();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_000);
      });
      expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument();
      expect(refreshMock).toHaveBeenCalledTimes(1);
    });

    it('caps Undo at an hour when the new train is further off', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      vi.setSystemTime(new Date('2026-09-17T05:00:00Z'));
      mockFetch({ [MISSED_URL]: () => json(suggestionSet()), [REPLACE_URL]: () => json(accepted) });
      renderSheet(MISSED);
      fireEvent.click(await screen.findByRole('button', { name: 'Take this one: 10:04 York to Edinburgh, direct' }));
      await screen.findByText('You can undo this until your new train leaves.');
      await act(async () => {
        await vi.advanceTimersByTimeAsync(59 * 60_000);
      });
      expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_000);
      });
      expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument();
    });

    it('never offers less than the usual 2 minutes, even for a train about to leave', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      vi.setSystemTime(new Date('2026-09-17T09:03:30Z'));
      mockFetch({ [MISSED_URL]: () => json(suggestionSet()), [REPLACE_URL]: () => json(accepted) });
      renderSheet(MISSED);
      fireEvent.click(await screen.findByRole('button', { name: 'Take this one: 10:04 York to Edinburgh, direct' }));
      await screen.findByText('You can undo this until your new train leaves.');
      await act(async () => {
        await vi.advanceTimersByTimeAsync(119_000);
      });
      expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();
    });

    it('says the journey is back under Upcoming when it had gone to Past', async () => {
      mockFetch({ [MISSED_URL]: () => json(suggestionSet()), [REPLACE_URL]: () => json(accepted) });
      renderWithMantine(
        <AlternativesSheet
          journeyId="42"
          mode={MISSED}
          opened
          onClose={vi.fn()}
          fallbackTitle="Other ways to Edinburgh"
          journeyPast
        />,
      );
      fireEvent.click(await screen.findByRole('button', { name: 'Take this one: 10:04 York to Edinburgh, direct' }));
      expect(await screen.findByText('Your journey is back under Upcoming.')).toBeInTheDocument();
    });

    it('does not say so for a journey still upcoming, and refreshes the page when it closes', async () => {
      mockFetch({ [MISSED_URL]: () => json(suggestionSet()), [REPLACE_URL]: () => json(accepted) });
      const onClose = renderSheet(MISSED);
      fireEvent.click(await screen.findByRole('button', { name: 'Take this one: 10:04 York to Edinburgh, direct' }));
      await screen.findByText('Journey updated. Booked plan saved.');
      expect(screen.queryByText('Your journey is back under Upcoming.')).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Done' }));
      expect(onClose).toHaveBeenCalled();
      expect(refreshMock).toHaveBeenCalledTimes(1);
    });
  });

  it('mutes suggestions for the journey', async () => {
    const fetchMock = mockFetch({
      [BREAK_URL]: () => json(breakResponse()),
      'PUT /api/Journeys/42/suggestions-muted': () => new Response(null, { status: 204 }),
    });
    renderSheet();
    fireEvent.click(await screen.findByRole('button', { name: 'Stop suggestions for this journey' }));
    expect(await screen.findByText('Suggestions muted for this journey.')).toBeInTheDocument();
    const call = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/suggestions-muted'));
    expect(call?.[1]?.body).toBe(JSON.stringify({ muted: true }));
  });

  it('explains a ticket fit on tap', async () => {
    mockFetch({ [BREAK_URL]: () => json(breakResponse()) });
    renderSheet();
    fireEvent.click(await screen.findByRole('button', { name: 'May need a new ticket: why' }));
    await waitFor(() => expect(screen.getByText('Your Advance ticket is only valid on LNER.')).toBeInTheDocument());
  });
});
