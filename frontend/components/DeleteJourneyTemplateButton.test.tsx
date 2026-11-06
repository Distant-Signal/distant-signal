import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithMantine } from '@/test/render';
import { DeleteJourneyTemplateButton } from './DeleteJourneyTemplateButton';

const pushMock = vi.fn();
const refreshMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
  usePathname: () => '/journeys/regular/167',
  useSearchParams: () => new URLSearchParams(''),
}));

describe('DeleteJourneyTemplateButton', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    pushMock.mockClear();
    refreshMock.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not call DELETE until the confirmation modal is confirmed', () => {
    const fetchMock = vi.mocked(fetch);
    renderWithMantine(<DeleteJourneyTemplateButton templateId={167} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete regular journey' }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('DELETEs the template and redirects to /journeys/regular on success', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    renderWithMantine(<DeleteJourneyTemplateButton templateId={167} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete regular journey' }));
    await waitFor(() => screen.getByRole('button', { name: 'Confirm delete regular journey' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete regular journey' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/JourneyTemplates/167', { method: 'DELETE' });
    });
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/journeys/regular'));
  });

  it('shows an error and does not navigate on a failed (non-401) delete', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(new Response('no template with that id', { status: 404 }));

    renderWithMantine(<DeleteJourneyTemplateButton templateId={167} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete regular journey' }));
    await waitFor(() => screen.getByRole('button', { name: 'Confirm delete regular journey' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete regular journey' }));

    await waitFor(() => {
      expect(screen.getByText("Couldn't delete this regular journey. It may have been removed.")).toBeInTheDocument();
    });
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('a 401 shows a login prompt instead of the raw backend error text', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(new Response('no session', { status: 401 }));

    renderWithMantine(<DeleteJourneyTemplateButton templateId={167} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete regular journey' }));
    await waitFor(() => screen.getByRole('button', { name: 'Confirm delete regular journey' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete regular journey' }));

    const loginLink = await screen.findByRole('link', { name: 'Log in to delete this regular journey' });
    expect(loginLink).toBeInTheDocument();
    expect(screen.queryByText('no session')).not.toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('says the journeys already made from it are kept', async () => {
    renderWithMantine(<DeleteJourneyTemplateButton templateId={167} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete regular journey' }));
    await waitFor(() => expect(screen.getByText(/Journeys already made from it are kept\./)).toBeInTheDocument());
  });
});
