import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithMantine } from '@/test/render';
import { PersonalTokens } from './PersonalTokens';
import type { PersonalTokensResponse } from '@/lib/api-types';

const refreshMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: refreshMock }),
  usePathname: () => '/account/connected-apps',
  useSearchParams: () => new URLSearchParams(''),
}));

const token = {
  id: 7,
  name: 'Kitchen display',
  hint: 'AbC1',
  scopes: ['lines:read', 'trains:read'],
  createdAt: '2026-11-01T09:00:00Z',
  expiresAt: '2027-01-30T09:00:00Z',
  lastUsedAt: null,
};

const data: PersonalTokensResponse = {
  apiBaseUrl: 'https://ds-api.example.com',
  scopes: [{ name: 'journeys:read' }, { name: 'lines:read' }, { name: 'trains:read' }, { name: 'preferences:read' }],
  lifetimes: [7, 30, 90, 365],
  defaultLifetimeDays: 90,
  maxActive: 10,
  tokens: [token],
};

describe('PersonalTokens', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    refreshMock.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lists each token with what it can read, never the token itself', () => {
    renderWithMantine(<PersonalTokens data={data} />);
    expect(screen.getByRole('heading', { name: 'Personal API tokens' })).toBeInTheDocument();
    expect(screen.getByText('Kitchen display')).toBeInTheDocument();
    expect(screen.getByText('AbC1')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'See line status and station disruption',
      'See trains and live departures',
    ]);
    expect(screen.getByText(/Never used\./)).toBeInTheDocument();
    expect(screen.getByText('https://ds-api.example.com')).toBeInTheDocument();
    // One token: no Revoke all.
    expect(screen.queryByRole('button', { name: 'Revoke all tokens' })).not.toBeInTheDocument();
  });

  it('creates a token with the ticked scopes and shows it once', async () => {
    const created = { ...token, id: 8, name: 'Shortcut', scopes: ['journeys:read'], token: 'dsp_' + 'a'.repeat(38) };
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(created), { status: 201 }));
    renderWithMantine(<PersonalTokens data={data} />);
    const create = screen.getByRole('button', { name: 'Create token' });
    // Nothing to create until it has a name and a scope.
    expect(create).toBeDisabled();
    fireEvent.change(screen.getByRole('textbox', { name: /Name/ }), { target: { value: ' Shortcut ' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'See your saved journeys' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Expires after' }), { target: { value: '30' } });
    expect(create).toBeEnabled();
    fireEvent.click(create);
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith('/api/account/personal-tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Shortcut', scopes: ['journeys:read'], lifetimeDays: 30 }),
      }),
    );
    expect(await screen.findByDisplayValue(created.token)).toBeInTheDocument();
    expect(screen.getByText(/You won.t see it again\./)).toBeInTheDocument();
    expect(refreshMock).toHaveBeenCalled();
  });

  it('says why a create was refused at the limit', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'token_limit', message: 'too many' }), { status: 409 }),
    );
    renderWithMantine(<PersonalTokens data={data} />);
    fireEvent.change(screen.getByRole('textbox', { name: /Name/ }), { target: { value: 'One more' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'See your saved journeys' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create token' }));
    expect(await screen.findByText('You can have up to 10 tokens. Revoke one first.')).toBeInTheDocument();
  });

  it('offers no form at the limit', () => {
    renderWithMantine(<PersonalTokens data={{ ...data, maxActive: 1 }} />);
    expect(screen.queryByRole('button', { name: 'Create token' })).not.toBeInTheDocument();
    expect(screen.getByText(/the most you can have/)).toBeInTheDocument();
  });

  it('revokes one token, and all of them, after a confirmation', async () => {
    renderWithMantine(<PersonalTokens data={{ ...data, tokens: [token, { ...token, id: 9, name: 'Board' }] }} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Revoke' })[0]!);
    expect(fetch).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm revoke Kitchen display' }));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/account/personal-tokens/7', { method: 'DELETE' }));
    fireEvent.click(screen.getByRole('button', { name: 'Revoke all tokens' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm revoke all tokens' }));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/account/personal-tokens', { method: 'DELETE' }));
  });

  it('says when there are no tokens', () => {
    renderWithMantine(<PersonalTokens data={{ ...data, tokens: [] }} />);
    expect(screen.getByText('You have no tokens.')).toBeInTheDocument();
  });
});
