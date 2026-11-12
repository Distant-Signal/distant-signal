import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithMantine } from '@/test/render';
import * as api from '@/lib/api';
import StationBrowsePage, { metadata } from './page';

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return { ...actual, getStationCodes: vi.fn() };
});

beforeEach(() => {
  vi.mocked(api.getStationCodes).mockReset();
});

describe('StationBrowsePage', () => {
  it('links each letter that has stations, and no other', async () => {
    vi.mocked(api.getStationCodes).mockResolvedValue(['WAT', 'WOK', 'KGX']);
    renderWithMantine(await StationBrowsePage());
    const nav = screen.getByRole('navigation', { name: 'Stations by first letter' });
    expect(nav.querySelectorAll('a')).toHaveLength(2);
    expect(screen.getByRole('link', { name: 'K' })).toHaveAttribute('href', '/stations/browse/k');
    expect(screen.getByRole('link', { name: 'W' })).toHaveAttribute('href', '/stations/browse/w');
  });

  it('says so when the list cannot be loaded', async () => {
    vi.mocked(api.getStationCodes).mockRejectedValue(new Error('down'));
    renderWithMantine(await StationBrowsePage());
    expect(screen.getByText(/Couldn't load the station list/)).toBeInTheDocument();
  });

  it('has its own title, description and canonical', () => {
    expect(metadata.title).toBe('Stations A to Z');
    expect(metadata.description).toMatch(/A to Z/);
    expect(metadata.alternates?.canonical).toBe('/stations/browse');
  });
});
