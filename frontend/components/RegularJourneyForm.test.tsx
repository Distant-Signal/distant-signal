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

/** Picks the last train option shown: every radio but the form's own
 * ("Leave after" / "Arrive by" and "Each day"). */
const FORM_RADIOS = ['depart_after', 'arrive_by', 'manual', 'auto'];
function pickOnlyTrain() {
  const options = screen
    .getAllByRole('radio')
    .filter((radio) => !FORM_RADIOS.includes((radio as HTMLInputElement).value));
  fireEvent.click(options[options.length - 1]!);
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
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(json(plan('W12345', 'WOK', 'WAT', '07:48')))
      .mockResolvedValueOnce(json(plan('W54321', 'WAT', 'WOK', '17:35')))
      .mockResolvedValueOnce(json({ templateId: 5, returnTemplateId: 6 }));
    renderWithMantine(<RegularJourneyForm />);
    fillOutbound();
    fireEvent.click(screen.getByRole('button', { name: 'Find trains' }));
    await screen.findByText(/Pick the one you usually take\./);
    expect(String(fetchMock.mock.calls[0]![0])).toMatch(
      /^\/api\/Trips\/plan\?origin=WOK&destination=WAT&date=\d{4}-\d{2}-\d{2}&results=options/,
    );
    expect(String(fetchMock.mock.calls[0]![0])).toContain('departAfter=07%3A45%3A00');
    pickOnlyTrain();
    expect(await screen.findByText('Your usual train: 07:48 Woking to London Waterloo')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save regular journey' })).toBeEnabled();

    fireEvent.click(screen.getByRole('switch', { name: 'Add the return journey' }));
    expect(screen.getByRole('button', { name: 'Save regular journey' })).toBeDisabled();
    fireEvent.change(screen.getAllByLabelText('Time')[1]!, { target: { value: '17:30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Find trains' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(String(fetchMock.mock.calls[1]![0])).toContain('origin=WAT&destination=WOK');
    await screen.findByText(/17:35/);
    pickOnlyTrain();
    await screen.findByText('Your usual train back: 17:35 London Waterloo to Woking');

    fireEvent.click(screen.getByRole('radio', { name: 'Pick my usual train for me' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save regular journey' }));
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/journeys/regular'));
    const [url, init] = fetchMock.mock.calls[2]!;
    expect(url).toBe('/api/JourneyTemplates');
    const body = JSON.parse(String((init as RequestInit).body)) as Record<string, unknown>;
    expect(body).toMatchObject({
      mode: 'plan',
      originCrs: 'WOK',
      destinationCrs: 'WAT',
      target: { kind: 'depart_after', time: '07:45', dayOffset: 0 },
      daysOfWeek: 31,
      defaultMatchMode: 'auto',
      usualItinerary: { legs: [expect.objectContaining({ trainUid: 'W12345', departs: '07:48', atocCode: 'SW' })] },
      return: {
        target: { kind: 'depart_after', time: '17:30', dayOffset: 0 },
        usualItinerary: { legs: [expect.objectContaining({ trainUid: 'W54321' })] },
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
    vi.mocked(fetch).mockResolvedValue(json({ templateId: 5, returnTemplateId: null }));
    renderWithMantine(<RegularJourneyForm />);
    expect(await screen.findByText('Your usual train: 07:48 Woking to London Waterloo')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Arrive by' })).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Save regular journey' }));
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/journeys/regular'));
    const body = JSON.parse(String((vi.mocked(fetch).mock.calls[0]![1] as RequestInit).body)) as Record<
      string,
      unknown
    >;
    expect(body).toMatchObject({ planOptions: { maxChanges: 1 }, target: { kind: 'arrive_by', time: '08:30' } });
    expect(window.sessionStorage.getItem('ds:regular-journey-draft')).toBeNull();
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
    vi.mocked(fetch).mockResolvedValue(new Response('', { status: 500 }));
    renderWithMantine(<RegularJourneyForm />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save regular journey' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Save regular journey' }));
    expect(await screen.findByText("Couldn't save this regular journey. Try again.")).toBeInTheDocument();
  });
});
