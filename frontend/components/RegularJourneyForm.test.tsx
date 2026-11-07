import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithMantine } from '@/test/render';
import { RegularJourneyForm } from './RegularJourneyForm';
import type { TripPlanResponse } from '@/lib/types';
import { ITINERARY_DEFAULTS, SEGMENT_DEFAULTS, TRIP_PLAN_DEFAULTS, plannedTrainLeg } from '@/test/apiDefaults';

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: vi.fn() }),
  usePathname: () => '/journeys/regular/new',
  useSearchParams: () => new URLSearchParams(''),
}));

// The station fields' suggestions would take `fetch` calls of their own.
vi.mock('@/lib/suggestions', () => ({
  searchStations: async () => [],
  searchPlannerLocations: async () => [],
  getStationNames: async () =>
    new Map([
      ['WOK', 'Woking'],
      ['WAT', 'London Waterloo'],
    ]),
}));

function plan(uid: string, from: string, to: string, departs: string): TripPlanResponse {
  return {
    ...TRIP_PLAN_DEFAULTS,
    results: 'options',
    segments: [
      {
        ...SEGMENT_DEFAULTS,
        originCrs: from,
        destinationCrs: to,
        itineraries: [
          {
            ...ITINERARY_DEFAULTS,
            changeCount: 0,
            totalDurationMinutes: 32,
            legs: [
              plannedTrainLeg({
                trainUid: uid,
                serviceDate: '2099-01-05',
                originCrs: from,
                destinationCrs: to,
                scheduledDeparture: `${departs}:00`,
                scheduledArrival: '08:20:00',
                operator: 'SW',
              }),
            ],
          },
        ],
      },
    ],
  };
}

function json(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200 });
}

/** The api's preview of Monday to Friday from Monday 5 Jan 2099, with a
 * bank holiday on the Tuesday. */
const PREVIEW = {
  nextDate: '2099-01-05',
  upcomingDates: [
    { date: '2099-01-05', skipReason: null },
    { date: '2099-01-06', skipReason: 'bank_holiday' },
    { date: '2099-01-07', skipReason: null },
    { date: '2099-01-08', skipReason: null },
  ],
};

/** Picks the last train option shown: every radio but the form's own
 * ("Leave after" / "Arrive by" and "Each day"). */
const FORM_RADIOS = ['depart_after', 'arrive_by', 'manual', 'auto'];
function pickOnlyTrain() {
  const options = screen
    .getAllByRole('radio')
    .filter((radio) => !FORM_RADIOS.includes((radio as HTMLInputElement).value));
  fireEvent.click(options[options.length - 1]!);
}

/** A fetch answering by URL: the station-buffer pre-fill from `buffers`
 * (by station code), the preferences with `division` as the bank holiday
 * division, the dates preview with `preview`, each trip plan from `plans`
 * (by origin), and the create with `created`. Returns the calls other than
 * the three reads. */
function routeFetch(
  buffers: Record<string, number | null>,
  plans: Record<string, Response>,
  created: () => Response,
  division: string | null = 'england-and-wales',
  preview: () => Response = () => json(PREVIEW),
): () => [string, RequestInit | undefined][] {
  const fetchMock = vi.mocked(fetch);
  fetchMock.mockImplementation(async (input) => {
    const url = String(input);
    const prefill = /station-buffer\?crs=([A-Z]{3})/.exec(url);
    if (prefill) return json({ minutes: buffers[prefill[1]!] ?? null });
    if (url === '/api/preferences') return json({ bankHolidayDivision: division });
    if (url === '/api/preferences/bank-holiday-division') return new Response(null, { status: 204 });
    if (url.endsWith('/preview-dates')) return preview();
    const origin = /Trips\/plan\?origin=([A-Z]{3})/.exec(url);
    if (origin) return plans[origin[1]!]!.clone();
    return created();
  });
  return () =>
    fetchMock.mock.calls
      .map(([input, init]) => [String(input), init] as [string, RequestInit | undefined])
      .filter(
        ([url]) => !url.includes('station-buffer') && url !== '/api/preferences' && !url.endsWith('/preview-dates'),
      );
}

function fillOutbound() {
  fireEvent.change(screen.getByRole('combobox', { name: 'From' }), { target: { value: 'WOK' } });
  fireEvent.change(screen.getByRole('combobox', { name: 'To' }), { target: { value: 'WAT' } });
  fireEvent.change(screen.getAllByLabelText('Time')[0]!, { target: { value: '07:45' } });
}

describe('RegularJourneyForm', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    pushMock.mockClear();
    window.sessionStorage.clear();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('starts on Monday to Friday, "Remind me", and nothing to save', () => {
    renderWithMantine(<RegularJourneyForm />);
    for (const day of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']) {
      expect(screen.getByRole('checkbox', { name: day })).toBeChecked();
    }
    expect(screen.getByRole('checkbox', { name: 'Sat' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'Remind me to pick my train' })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Find trains' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save regular journey' })).toBeDisabled();
    expect(screen.getByText('24-hour clock, e.g. 19:00.')).toBeInTheDocument();
  });

  it('finds trains, takes the picked one as the usual train, and saves a pair', async () => {
    const calls = routeFetch(
      { WOK: 12, WAT: 8 },
      { WOK: json(plan('W12345', 'WOK', 'WAT', '07:48')), WAT: json(plan('W54321', 'WAT', 'WOK', '17:35')) },
      () => json({ templateId: 5, returnTemplateId: 6 }),
    );
    renderWithMantine(<RegularJourneyForm />);
    fillOutbound();
    // Pre-filled from the last time used from Woking.
    await waitFor(() => expect(screen.getAllByLabelText(/^Minutes to get to the station/)[0]).toHaveValue('12'));
    // The api's next date, once it has answered.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Find trains' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Find trains' }));
    await screen.findByText(/Pick the one you usually take\./);
    expect(calls()[0]![0]).toMatch(/^\/api\/Trips\/plan\?origin=WOK&destination=WAT&date=2099-01-05&results=options/);
    expect(calls()[0]![0]).toContain('departAfter=07%3A45%3A00');
    pickOnlyTrain();
    expect(await screen.findByText('Your usual train: 07:48 Woking to London Waterloo')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save regular journey' })).toBeEnabled();

    fireEvent.click(screen.getByRole('switch', { name: 'Add the return journey' }));
    expect(screen.getByRole('button', { name: 'Save regular journey' })).toBeDisabled();
    // The return's own, from London Waterloo; the traveller changes it.
    await waitFor(() => expect(screen.getAllByLabelText(/^Minutes to get to the station/)[1]).toHaveValue('8'));
    fireEvent.change(screen.getAllByLabelText(/^Minutes to get to the station/)[1]!, { target: { value: '10' } });
    fireEvent.change(screen.getAllByLabelText('Time')[1]!, { target: { value: '17:30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Find trains' }));
    await waitFor(() => expect(calls()).toHaveLength(2));
    expect(calls()[1]![0]).toContain('origin=WAT&destination=WOK');
    await screen.findByText(/17:35/);
    pickOnlyTrain();
    await screen.findByText('Your usual train back: 17:35 London Waterloo to Woking');

    fireEvent.click(screen.getByRole('radio', { name: 'Pick my usual train for me' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save regular journey' }));
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/journeys/regular'));
    const [url, init] = calls()[2]!;
    expect(url).toBe('/api/JourneyTemplates');
    const body = JSON.parse(String((init as RequestInit).body)) as Record<string, unknown>;
    expect(body).toMatchObject({
      mode: 'plan',
      originCrs: 'WOK',
      destinationCrs: 'WAT',
      target: { kind: 'depart_after', time: '07:45', dayOffset: 0 },
      daysOfWeek: 31,
      defaultMatchMode: 'auto',
      stationBufferMinutes: 12,
      usualItinerary: { legs: [expect.objectContaining({ trainUid: 'W12345', departs: '07:48', atocCode: 'SW' })] },
      return: {
        target: { kind: 'depart_after', time: '17:30', dayOffset: 0 },
        usualItinerary: { legs: [expect.objectContaining({ trainUid: 'W54321' })] },
        stationBufferMinutes: 10,
      },
    });
  });

  it('starts from a plan handed over by Plan a journey', async () => {
    window.sessionStorage.setItem(
      'ds:regular-journey-draft',
      JSON.stringify({
        originCrs: 'WOK',
        destinationCrs: 'WAT',
        target: { kind: 'arrive_by', time: '08:30', dayOffset: 0 },
        planOptions: { maxChanges: 1 },
        usualItinerary: { legs: [{ kind: 'train', trainUid: 'W12345', departs: '07:48' }] },
        usualSummary: '07:48 Woking to London Waterloo',
      }),
    );
    const calls = routeFetch({}, {}, () => json({ templateId: 5, returnTemplateId: null }));
    renderWithMantine(<RegularJourneyForm />);
    expect(await screen.findByText('Your usual train: 07:48 Woking to London Waterloo')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Arrive by' })).toBeChecked();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save regular journey' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Save regular journey' }));
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/journeys/regular'));
    const body = JSON.parse(String(calls()[0]![1]!.body)) as Record<string, unknown>;
    expect(body).toMatchObject({
      planOptions: { maxChanges: 1 },
      target: { kind: 'arrive_by', time: '08:30' },
      // Nothing used from Woking before: no leave-by.
      stationBufferMinutes: null,
      skipBankHolidays: true,
    });
    expect(window.sessionStorage.getItem('ds:regular-journey-draft')).toBeNull();
  });

  const DRAFT = JSON.stringify({
    originCrs: 'WOK',
    destinationCrs: 'WAT',
    target: { kind: 'depart_after', time: '07:45', dayOffset: 0 },
    planOptions: null,
    usualItinerary: { legs: [{ kind: 'train', trainUid: 'W12345', departs: '07:48' }] },
    usualSummary: '07:48 Woking to London Waterloo',
  });

  it('skips bank holidays by default, naming whose, with a link to change it', async () => {
    window.sessionStorage.setItem('ds:regular-journey-draft', DRAFT);
    routeFetch({}, {}, () => json({ templateId: 5, returnTemplateId: null }), 'scotland');
    renderWithMantine(<RegularJourneyForm />);
    expect(screen.getByRole('switch', { name: 'Skip bank holidays' })).toBeChecked();
    expect(await screen.findByText(/^Scotland bank holidays\./)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Change' })).toHaveAttribute(
      'href',
      '/account/preferences#bank-holidays-heading',
    );
    expect(screen.queryByRole('combobox', { name: /Whose bank holidays/ })).toBeNull();
  });

  it('asks whose bank holidays once, inline, and saves the answer first', async () => {
    window.sessionStorage.setItem('ds:regular-journey-draft', DRAFT);
    const calls = routeFetch({}, {}, () => json({ templateId: 5, returnTemplateId: null }), null);
    renderWithMantine(<RegularJourneyForm />);
    const select = await screen.findByRole('combobox', { name: /Whose bank holidays/ });
    expect(select).toHaveValue('England and Wales');
    fireEvent.click(select);
    fireEvent.click(await screen.findByRole('option', { name: 'Northern Ireland' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save regular journey' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Save regular journey' }));
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/journeys/regular'));
    expect(calls().map(([url]) => url)).toEqual(['/api/preferences/bank-holiday-division', '/api/JourneyTemplates']);
    expect(JSON.parse(String(calls()[0]![1]!.body))).toEqual({ division: 'northern-ireland' });
    expect(JSON.parse(String(calls()[1]![1]!.body))).toMatchObject({ skipBankHolidays: true });
  });

  it('with the switch off, asks nothing and saves the journey without skipping', async () => {
    window.sessionStorage.setItem('ds:regular-journey-draft', DRAFT);
    const calls = routeFetch({}, {}, () => json({ templateId: 5, returnTemplateId: null }), null);
    renderWithMantine(<RegularJourneyForm />);
    // The inline question, until the switch goes off.
    await screen.findByRole('combobox', { name: /Whose bank holidays/ });
    fireEvent.click(screen.getByRole('switch', { name: 'Skip bank holidays' }));
    expect(screen.queryByRole('combobox', { name: /Whose bank holidays/ })).toBeNull();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save regular journey' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Save regular journey' }));
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/journeys/regular'));
    expect(calls().map(([url]) => url)).toEqual(['/api/JourneyTemplates']);
    expect(JSON.parse(String(calls()[0]![1]!.body))).toMatchObject({ skipBankHolidays: false });
  });

  it('saves a route with no days as a saved route', async () => {
    window.sessionStorage.setItem('ds:regular-journey-draft', DRAFT);
    const calls = routeFetch({}, {}, () => json({ templateId: 5, returnTemplateId: null }), 'scotland');
    renderWithMantine(<RegularJourneyForm />);
    await screen.findByText('Your usual train: 07:48 Woking to London Waterloo');
    for (const day of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']) {
      fireEvent.click(screen.getByRole('checkbox', { name: day }));
    }
    expect(
      screen.getByText('No days: a saved route. Start a journey from it whenever you travel.'),
    ).toBeInTheDocument();
    // Its trains come from the next day of any day of the week, with no
    // dates to preview.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save regular journey' })).toBeEnabled());
    expect(screen.queryByText(/^Next dates: /)).toBeNull();
    const previews = vi
      .mocked(fetch)
      .mock.calls.filter(([input]) => String(input).endsWith('/preview-dates'))
      .map(([, init]) => JSON.parse(String(init?.body)) as Record<string, unknown>);
    expect(previews.at(-1)).toMatchObject({ daysOfWeek: 127, skipBankHolidays: false });
    fireEvent.click(screen.getByRole('button', { name: 'Save regular journey' }));
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/journeys/regular'));
    const saved = calls().find(([url]) => url === '/api/JourneyTemplates');
    expect(JSON.parse(String(saved![1]!.body))).toMatchObject({ mode: 'plan', daysOfWeek: null });
  });

  it("shows the api's refusal when saving fails", async () => {
    window.sessionStorage.setItem(
      'ds:regular-journey-draft',
      JSON.stringify({
        originCrs: 'WOK',
        destinationCrs: 'WAT',
        target: { kind: 'depart_after', time: '07:45', dayOffset: 0 },
        planOptions: null,
        usualItinerary: { legs: [{ kind: 'train', trainUid: 'W12345', departs: '07:48' }] },
        usualSummary: null,
      }),
    );
    routeFetch({}, {}, () => new Response('', { status: 500 }));
    renderWithMantine(<RegularJourneyForm />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save regular journey' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Save regular journey' }));
    expect(await screen.findByText("Couldn't save this regular journey. Try again.")).toBeInTheDocument();
  });

  it('previews the next dates from the api, and asks again when the days or the switch change', async () => {
    routeFetch({}, {}, () => json({}));
    renderWithMantine(<RegularJourneyForm />);
    expect(
      await screen.findByText('Next dates: Mon 5 Jan, Tue 6 Jan (bank holiday), Wed 7 Jan and Thu 8 Jan.'),
    ).toBeInTheDocument();
    const previews = () =>
      vi
        .mocked(fetch)
        .mock.calls.filter(([input]) => String(input).endsWith('/preview-dates'))
        .map(([, init]) => JSON.parse(String(init?.body)) as Record<string, unknown>);
    expect(previews()).toEqual([{ daysOfWeek: 31, startsOn: null, endsOn: null, skipBankHolidays: true, count: 4 }]);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Sat' }));
    await waitFor(() => expect(previews()).toHaveLength(2));
    expect(previews()[1]).toMatchObject({ daysOfWeek: 63 });
    fireEvent.click(screen.getByRole('switch', { name: 'Skip bank holidays' }));
    await waitFor(() => expect(previews()).toHaveLength(3));
    expect(previews()[2]).toMatchObject({ daysOfWeek: 63, skipBankHolidays: false });
  });

  it('asks to log in for the dates, and says why trains cannot be found yet', async () => {
    routeFetch(
      {},
      {},
      () => json({}),
      'england-and-wales',
      () => new Response('', { status: 401 }),
    );
    renderWithMantine(<RegularJourneyForm />);
    fillOutbound();
    expect(await screen.findByText('Log in to see the dates this runs on.')).toBeInTheDocument();
    expect(screen.getByText('Log in to find trains for your days.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Find trains' })).toBeDisabled();
  });

  it('says when no chosen day comes before the end date', async () => {
    routeFetch(
      {},
      {},
      () => json({}),
      'england-and-wales',
      () => json({ nextDate: null, upcomingDates: [] }),
    );
    renderWithMantine(<RegularJourneyForm />);
    fillOutbound();
    expect(await screen.findAllByText('None of the chosen days is before the end date.')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Find trains' })).toBeDisabled();
  });
});
