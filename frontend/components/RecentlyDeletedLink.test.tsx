import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithMantine } from '@/test/render';
import { RecentlyDeletedLink } from './RecentlyDeletedLink';
import { getSessionOrLoggedOut, LOGGED_OUT_SESSION } from '@/lib/api';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { LOGGED_OUT_SESSION: actual.LOGGED_OUT_SESSION, getSessionOrLoggedOut: vi.fn() };
});

const loggedIn = { ...LOGGED_OUT_SESSION, authenticated: true, id: 'user-1' };

describe('RecentlyDeletedLink', () => {
  it('links to Recently deleted while the feature is on', async () => {
    vi.mocked(getSessionOrLoggedOut).mockResolvedValue({ ...loggedIn, recentlyDeletedEnabled: true });
    renderWithMantine(<>{await RecentlyDeletedLink()}</>);
    expect(screen.getByRole('link', { name: 'Recently deleted' })).toHaveAttribute(
      'href',
      '/journeys/recently-deleted',
    );
  });

  it('renders nothing while it is off, or for a logged-out visitor', async () => {
    vi.mocked(getSessionOrLoggedOut).mockResolvedValue({ ...loggedIn, recentlyDeletedEnabled: false });
    expect(await RecentlyDeletedLink()).toBeNull();
    vi.mocked(getSessionOrLoggedOut).mockResolvedValue({ ...LOGGED_OUT_SESSION, recentlyDeletedEnabled: true });
    expect(await RecentlyDeletedLink()).toBeNull();
  });
});
