import { describe, it, expect, afterEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithMantine } from '@/test/render';
import { PersonalTokenNotice } from './PersonalTokenNotice';
import type { PersonalTokenRow } from '@/lib/api-types';

const notice: PersonalTokenRow = {
  id: 7,
  name: 'Kitchen display',
  hint: 'AbC1',
  scopes: ['lines:read'],
  createdAt: '2026-11-03T09:00:00Z',
  expiresAt: '2027-02-01T09:00:00Z',
  lastUsedAt: null,
};

const title = 'An API token called "Kitchen display" was created';

describe('PersonalTokenNotice', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('names the token, when it was created, and where to revoke it', async () => {
    renderWithMantine(<PersonalTokenNotice notice={notice} />);
    expect(await screen.findByText(title)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Revoke it in Connected apps' })).toHaveAttribute(
      'href',
      '/account/connected-apps',
    );
  });

  it('stays dismissed for that token, and shows again for a new one', async () => {
    const { unmount } = renderWithMantine(<PersonalTokenNotice notice={notice} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText(title)).not.toBeInTheDocument();
    unmount();
    renderWithMantine(<PersonalTokenNotice notice={notice} />);
    expect(screen.queryByText(title)).not.toBeInTheDocument();
    renderWithMantine(<PersonalTokenNotice notice={{ ...notice, id: 8 }} />);
    expect(await screen.findByText(title)).toBeInTheDocument();
  });
});
