import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithMantine } from '@/test/render';
import { SaveAsTemplateButton } from './SaveAsTemplateButton';

const pushMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => '/journeys/42',
  useSearchParams: () => new URLSearchParams(''),
}));

describe('SaveAsTemplateButton', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    pushMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('opens the modal on click and closes it', async () => {
    renderWithMantine(<SaveAsTemplateButton journeyId={7} />);

    fireEvent.click(screen.getByRole('button', { name: 'Make this a regular journey' }));
    expect(await screen.findByRole('dialog', { name: 'Make this a regular journey' })).toBeInTheDocument();

    // Mantine's Modal renders a close button labelled "Close".
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Make this a regular journey' })).not.toBeInTheDocument();
    });
  });

  it('submits {mode: fromJourney, journeyId} with no customName when left blank', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ templateId: 99 }), { status: 200 }));

    renderWithMantine(<SaveAsTemplateButton journeyId={7} />);
    fireEvent.click(screen.getByRole('button', { name: 'Make this a regular journey' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Save regular journey' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/JourneyTemplates',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ mode: 'fromJourney', journeyId: 7 }),
        }),
      );
    });
  });

  it('includes a trimmed customName when one is provided', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ templateId: 99 }), { status: 200 }));

    renderWithMantine(<SaveAsTemplateButton journeyId={7} />);
    fireEvent.click(screen.getByRole('button', { name: 'Make this a regular journey' }));
    fireEvent.change(await screen.findByLabelText('Name (optional)'), {
      target: { value: '  Weekday commute  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save regular journey' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/JourneyTemplates',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ mode: 'fromJourney', journeyId: 7, customName: 'Weekday commute' }),
        }),
      );
    });
  });

  it('shows a login prompt on a 401 rather than the raw rejection text', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(new Response('unauthorized', { status: 401 }));

    renderWithMantine(<SaveAsTemplateButton journeyId={7} />);
    fireEvent.click(screen.getByRole('button', { name: 'Make this a regular journey' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Save regular journey' }));

    expect(await screen.findByText('Log in to save a regular journey')).toBeInTheDocument();
    expect(screen.queryByText('unauthorized')).not.toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("shows the server's own error message text on a non-401 failure", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(new Response('Something went wrong', { status: 500 }));

    renderWithMantine(<SaveAsTemplateButton journeyId={7} />);
    fireEvent.click(screen.getByRole('button', { name: 'Make this a regular journey' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Save regular journey' }));

    expect(await screen.findByText("Couldn't save this regular journey. Try again.")).toBeInTheDocument();
    expect(screen.queryByText('Log in to save a regular journey')).not.toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('navigates to the new template detail page on success, using the id from the response', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ templateId: 123 }), { status: 200 }));

    renderWithMantine(<SaveAsTemplateButton journeyId={7} />);
    fireEvent.click(screen.getByRole('button', { name: 'Make this a regular journey' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Save regular journey' }));

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/journeys/regular/123');
    });
    // The modal closes on success.
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Make this a regular journey' })).not.toBeInTheDocument();
    });
  });
});
