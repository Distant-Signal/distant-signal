import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithMantine } from '@/test/render';
import { Webhooks } from './Webhooks';
import type { WebhookDestination, WebhooksResponse } from '@/lib/api-types';

const refreshMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: refreshMock }),
  usePathname: () => '/account/notifications',
  useSearchParams: () => new URLSearchParams(''),
}));

const destination: WebhookDestination = {
  id: 3,
  kind: 'ntfy',
  name: 'My phone',
  url: 'https://ntfy.example.org/trains',
  hasSecret: false,
  enabled: true,
  disabledReason: null,
  lastSuccessAt: null,
  lastFailureAt: null,
  lastError: null,
  createdAt: '2026-11-09T09:00:00Z',
};

const data: WebhooksResponse = {
  kinds: [
    { kind: 'generic', secret: 'none' },
    { kind: 'ntfy', secret: 'optional' },
    { kind: 'gotify', secret: 'required' },
  ],
  maxDestinations: 5,
  destinations: [destination],
};

describe('Webhooks', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    refreshMock.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lists each destination with its state', () => {
    renderWithMantine(<Webhooks data={data} />);
    expect(screen.getByRole('heading', { name: 'Webhooks' })).toBeInTheDocument();
    expect(screen.getByText('My phone')).toBeInTheDocument();
    expect(screen.getByText('https://ntfy.example.org/trains')).toBeInTheDocument();
    expect(screen.getByText('On')).toBeInTheDocument();
    expect(screen.getByText('Nothing sent yet.')).toBeInTheDocument();
  });

  it('shows why the notifier turned a destination off, and turns it back on', async () => {
    const off = { ...destination, enabled: false, disabledReason: 'Turned off after repeated failures.' };
    renderWithMantine(<Webhooks data={{ ...data, destinations: [off] }} />);
    expect(screen.getByText('Off')).toBeInTheDocument();
    expect(screen.getByText('Turned off after repeated failures.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Turn on My phone' }));
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith('/api/account/webhooks/3', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: true }),
      }),
    );
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
  });

  it('adds a signed destination and shows its secret once', async () => {
    const created = { secret: 'whsec_' + 'a'.repeat(40), destination: { ...destination, id: 4, kind: 'generic' } };
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(created), { status: 201 }));
    renderWithMantine(<Webhooks data={data} />);
    const add = screen.getByRole('button', { name: 'Add destination' });
    expect(add).toBeDisabled();
    fireEvent.change(screen.getByRole('textbox', { name: /Name/ }), { target: { value: ' Home ' } });
    fireEvent.change(screen.getByRole('textbox', { name: /Address/ }), { target: { value: 'https://example.org/h' } });
    fireEvent.click(add);
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith('/api/account/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'generic', name: 'Home', url: 'https://example.org/h' }),
      }),
    );
    expect(await screen.findByDisplayValue(created.secret)).toBeInTheDocument();
    expect(screen.getByText(/You won.t see it again\./)).toBeInTheDocument();
    expect(refreshMock).toHaveBeenCalled();
  });

  it('needs the app token for Gotify and sends it as the secret', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ secret: null, destination: { ...destination, kind: 'gotify' } }), { status: 201 }),
    );
    renderWithMantine(<Webhooks data={data} />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Type' }), { target: { value: 'gotify' } });
    fireEvent.change(screen.getByRole('textbox', { name: /Name/ }), { target: { value: 'Server' } });
    fireEvent.change(screen.getByRole('textbox', { name: /Address/ }), { target: { value: 'https://g.example.org' } });
    const add = screen.getByRole('button', { name: 'Add destination' });
    expect(add).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/App token/), { target: { value: 'AppTok' } });
    expect(add).toBeEnabled();
    fireEvent.click(add);
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith('/api/account/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'gotify', name: 'Server', url: 'https://g.example.org', secret: 'AppTok' }),
      }),
    );
    expect(await screen.findByText('New notifications will be sent to it.')).toBeInTheDocument();
  });

  it('says why a refused address was refused', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'invalid_request', message: 'x' }), { status: 400 }),
    );
    renderWithMantine(<Webhooks data={data} />);
    fireEvent.change(screen.getByRole('textbox', { name: /Name/ }), { target: { value: 'Local' } });
    fireEvent.change(screen.getByRole('textbox', { name: /Address/ }), { target: { value: 'https://10.0.0.1/x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add destination' }));
    expect(await screen.findByText(/isn.t valid\. Use a public https address/)).toBeInTheDocument();
  });

  it('words a logged-out add the usual way, once', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 401 }));
    renderWithMantine(<Webhooks data={data} />);
    fireEvent.change(screen.getByRole('textbox', { name: /Name/ }), { target: { value: 'Local' } });
    fireEvent.change(screen.getByRole('textbox', { name: /Address/ }), { target: { value: 'https://example.org/x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add destination' }));
    expect(await screen.findByText("Couldn't add the destination. Log in and try again.")).toBeInTheDocument();
    expect(screen.getAllByText(/Couldn't add the destination/)).toHaveLength(1);
  });

  it('shows the last problem and the turned-off reason as sentences with one full stop', () => {
    const failing = {
      ...destination,
      lastSuccessAt: '2026-11-09T08:00:00Z',
      lastFailureAt: '2026-11-09T09:00:00Z',
      lastError: 'The destination did not accept it',
    };
    const { unmount } = renderWithMantine(<Webhooks data={{ ...data, destinations: [failing] }} />);
    expect(
      screen.getByText(/Last accepted .*Last problem .*: The destination did not accept it\.$/),
    ).toBeInTheDocument();
    unmount();
    const off = {
      ...destination,
      enabled: false,
      disabledReason: 'Turned off after repeated failures. Last problem: x',
    };
    renderWithMantine(<Webhooks data={{ ...data, destinations: [off] }} />);
    expect(screen.getByText('Turned off after repeated failures. Last problem: x.')).toBeInTheDocument();
  });

  it('says what a webhook message carries, not that it carries no journey details', () => {
    renderWithMantine(<Webhooks data={data} />);
    expect(screen.getByText(/which includes your route, times and delays/)).toBeInTheDocument();
    expect(screen.getByText(/We never send your name, email or account ID/)).toBeInTheDocument();
    expect(screen.queryByText(/never your account or journey details/)).not.toBeInTheDocument();
  });

  it('offers no form at the limit', () => {
    renderWithMantine(<Webhooks data={{ ...data, maxDestinations: 1 }} />);
    expect(screen.queryByRole('button', { name: 'Add destination' })).not.toBeInTheDocument();
    expect(screen.getByText(/the most you can have/)).toBeInTheDocument();
  });

  it('deletes after a confirmation', async () => {
    renderWithMantine(<Webhooks data={data} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(fetch).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm delete My phone' }));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/account/webhooks/3', { method: 'DELETE' }));
  });
});
