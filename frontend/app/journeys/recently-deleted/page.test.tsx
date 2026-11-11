import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithMantine } from '@/test/render';
import RecentlyDeletedPage from './page';
import { getRecentlyDeletedJourneys, getSessionOrLoggedOut, LOGGED_OUT_SESSION } from '@/lib/api';
import type { SessionInfo } from '@/lib/types';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    LOGGED_OUT_SESSION: actual.LOGGED_OUT_SESSION,
    getSessionOrLoggedOut: vi.fn(),
    getRecentlyDeletedJourneys: vi.fn(),
  };
});

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/journeys/recently-deleted',
  useSearchParams: () => new URLSearchParams(''),
}));

const loggedIn: SessionInfo = {
  ...LOGGED_OUT_SESSION,
  authenticated: true,
  id: 'user-1',
  name: 'Ada',
  recentlyDeletedEnabled: true,
};

describe('RecentlyDeletedPage', () => {
  beforeEach(() => {
    vi.mocked(getRecentlyDeletedJourneys).mockReset();
  });

  it('asks a logged-out visitor to log in', async () => {
    vi.mocked(getSessionOrLoggedOut).mockResolvedValue(LOGGED_OUT_SESSION);
    renderWithMantine(await RecentlyDeletedPage());
    expect(screen.getByText('Log in to see the journeys you deleted recently.')).toBeInTheDocument();
    expect(getRecentlyDeletedJourneys).not.toHaveBeenCalled();
  });

  it('is not found while the feature is off', async () => {
    vi.mocked(getSessionOrLoggedOut).mockResolvedValue({ ...loggedIn, recentlyDeletedEnabled: false });
    await expect(RecentlyDeletedPage()).rejects.toThrow('NEXT_NOT_FOUND');
    expect(getRecentlyDeletedJourneys).not.toHaveBeenCalled();
  });

  it('is not found when the api answers 404', async () => {
    vi.mocked(getSessionOrLoggedOut).mockResolvedValue(loggedIn);
    vi.mocked(getRecentlyDeletedJourneys).mockResolvedValue(null);
    await expect(RecentlyDeletedPage()).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('lists the journeys', async () => {
    vi.mocked(getSessionOrLoggedOut).mockResolvedValue(loggedIn);
    vi.mocked(getRecentlyDeletedJourneys).mockResolvedValue({
      retentionDays: 7,
      connectedAppRetentionDays: 30,
      items: [],
    });
    renderWithMantine(await RecentlyDeletedPage());
    expect(screen.getByRole('heading', { level: 1, name: 'Recently deleted' })).toBeInTheDocument();
    expect(screen.getByText(/Nothing deleted in the last 7 days\./)).toBeInTheDocument();
  });

  it('says so when the list fails to load', async () => {
    vi.mocked(getSessionOrLoggedOut).mockResolvedValue(loggedIn);
    vi.mocked(getRecentlyDeletedJourneys).mockRejectedValue(new Error('boom'));
    renderWithMantine(await RecentlyDeletedPage());
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load your recently deleted journeys. Try again.");
  });
});
