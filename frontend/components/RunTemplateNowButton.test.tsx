import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { nowInLondon } from '@/lib/londonWallClock';
import { renderWithMantine } from '@/test/render';
import { RunTemplateNowButton } from './RunTemplateNowButton';

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: vi.fn() }),
  usePathname: () => '/journeys/regular/167',
  useSearchParams: () => new URLSearchParams(''),
}));

// Computed at test time, not hardcoded -- matches exactly what the
// component's own `nowInLondon().format('YYYY-MM-DD')` produces, regardless
// of what day this suite happens to run on.
const today = nowInLondon().format('YYYY-MM-DD');
// What the field shows for it: the site's "17 Sep 2026".
const todayShown = nowInLondon().format('D MMM YYYY');

describe('RunTemplateNowButton', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    pushMock.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('defaults the service date field to today on open', async () => {
    renderWithMantine(<RunTemplateNowButton templateId={167} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add a date' }));

    expect(await screen.findByLabelText('Date')).toHaveValue(todayShown);
  });

  it("defaults to London's today, not the host zone's (FE-4)", async () => {
    // FE-4: 23:30 UTC on 15 July is 00:30 on 16 July in London (BST).
    vi.useFakeTimers({ toFake: ['Date'], shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-07-15T23:30:00Z'));
    renderWithMantine(<RunTemplateNowButton templateId={167} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add a date' }));
    expect(await screen.findByLabelText('Date')).toHaveValue('16 Jul 2026');
  });

  it('submits {serviceDate} to the materialize endpoint', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ journeyId: 42, legIds: [1] }), { status: 200 }));

    renderWithMantine(<RunTemplateNowButton templateId={167} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add a date' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Add journey' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/JourneyTemplates/167/materialize',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ serviceDate: today }),
        }),
      );
    });
  });

  it('navigates to /journeys/{journeyId} using the response journeyId on success', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ journeyId: 42, legIds: [1, 2] }), { status: 200 }));

    renderWithMantine(<RunTemplateNowButton templateId={167} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add a date' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Add journey' }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/journeys/42'));
  });

  it('a 401 shows a login prompt instead of the raw backend error text', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(new Response('no session', { status: 401 }));

    renderWithMantine(<RunTemplateNowButton templateId={167} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add a date' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Add journey' }));

    const loginLink = await screen.findByRole('link', { name: 'Log in to add a date' });
    expect(loginLink).toBeInTheDocument();
    expect(screen.queryByText('no session')).not.toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('surfaces the server error text on a non-401 failure', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(new Response('template has no legs', { status: 400 }));

    renderWithMantine(<RunTemplateNowButton templateId={167} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add a date' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Add journey' }));

    expect(await screen.findByText('Template has no legs.')).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });

  // The Service date is a `DateInput` now, not free text: text that isn't
  // a date leaves the last good date in place (shown again on blur), so
  // nothing malformed can reach `POST /JourneyTemplates/{id}/materialize`.
  it('keeps the last good service date when the typed text is not a date', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ journeyId: 42, legIds: [1] }), { status: 200 }));
    renderWithMantine(<RunTemplateNowButton templateId={167} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add a date' }));

    const serviceDate = await screen.findByLabelText('Date');
    fireEvent.focus(serviceDate);
    fireEvent.change(serviceDate, { target: { value: 'next tuesday' } });
    fireEvent.blur(serviceDate);
    expect(serviceDate).toHaveValue(todayShown);

    fireEvent.click(screen.getByRole('button', { name: 'Add journey' }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/JourneyTemplates/167/materialize',
        expect.objectContaining({ body: JSON.stringify({ serviceDate: today }) }),
      ),
    );
  });

  it('keeps a date after tomorrow for the evening before, when it can', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    const later = nowInLondon().add(10, 'day');
    renderWithMantine(<RunTemplateNowButton templateId={167} keepLaterDates />);
    fireEvent.click(screen.getByRole('button', { name: 'Add a date' }));
    const serviceDate = await screen.findByLabelText('Date');
    fireEvent.focus(serviceDate);
    fireEvent.change(serviceDate, { target: { value: later.format('D MMM YYYY') } });
    fireEvent.blur(serviceDate);
    fireEvent.click(screen.getByRole('button', { name: 'Add journey' }));
    expect(
      await screen.findByText(`Added ${later.format('D MMM YYYY')}. The journey is added the evening before.`),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/JourneyTemplates/167/extra-dates',
      expect.objectContaining({ body: JSON.stringify({ serviceDate: later.format('YYYY-MM-DD') }) }),
    );
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('still adds tomorrow at once', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ journeyId: 42, legIds: [1] }), { status: 200 }));
    const tomorrow = nowInLondon().add(1, 'day');
    renderWithMantine(<RunTemplateNowButton templateId={167} keepLaterDates />);
    fireEvent.click(screen.getByRole('button', { name: 'Add a date' }));
    const serviceDate = await screen.findByLabelText('Date');
    fireEvent.focus(serviceDate);
    fireEvent.change(serviceDate, { target: { value: tomorrow.format('D MMM YYYY') } });
    fireEvent.blur(serviceDate);
    fireEvent.click(screen.getByRole('button', { name: 'Add journey' }));
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/journeys/42'));
    expect(String(fetchMock.mock.calls[0]![0])).toBe('/api/JourneyTemplates/167/materialize');
  });
});
