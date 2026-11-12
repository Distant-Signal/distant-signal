import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderWithMantine } from '@/test/render';
import * as api from '@/lib/api';
import { StationBrowseIndex, StationLetterPage, stationBrowseMetadata } from './StationBrowse';

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return { ...actual, getStationCodes: vi.fn(), getStationName: vi.fn() };
});

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));

const NAMES: Record<string, string> = { WAT: 'London Waterloo', WOK: 'Woking' };

beforeEach(() => {
  vi.mocked(api.getStationCodes).mockReset().mockResolvedValue(['WAT', 'WOK', 'KGX']);
  vi.mocked(api.getStationName)
    .mockReset()
    .mockImplementation(async (crs) => {
      if (crs === 'WOK') throw new Error('lookup failed');
      return NAMES[crs] ?? null;
    });
});

describe('StationBrowseIndex', () => {
  it('links each letter that has stations, and no other', async () => {
    renderWithMantine(await StationBrowseIndex());
    const nav = screen.getByRole('navigation', { name: 'Stations by first letter' });
    expect(nav.querySelectorAll('a')).toHaveLength(2);
    expect(screen.getByRole('link', { name: 'K' })).toHaveAttribute('href', '/stations/k');
    expect(screen.getByRole('link', { name: 'W' })).toHaveAttribute('href', '/stations/w');
  });

  it('says so when the list cannot be loaded', async () => {
    vi.mocked(api.getStationCodes).mockRejectedValue(new Error('down'));
    renderWithMantine(await StationBrowseIndex());
    expect(screen.getByText(/Couldn't load the station list/)).toBeInTheDocument();
  });
});

describe('StationLetterPage', () => {
  it('lists every station with that first letter as a link to its page', async () => {
    renderWithMantine(await StationLetterPage({ letter: 'w' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Stations starting with W' })).toBeInTheDocument();
    const links = within(screen.getByRole('list', { name: 'Stations' })).getAllByRole('link');
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/stations/WAT', '/stations/WOK']);
    // A name that resolved, and the bare code when its lookup failed.
    expect(links.map((a) => a.textContent)).toEqual(['London Waterloo (WAT)', 'WOK']);
  });

  it('links back to the index and the other letters', async () => {
    renderWithMantine(await StationLetterPage({ letter: 'w' }));
    expect(screen.getByRole('link', { name: 'Stations A to Z' })).toHaveAttribute('href', '/stations/a-z');
    expect(screen.getByRole('link', { name: 'K' })).toHaveAttribute('href', '/stations/k');
  });

  it('is not found for a letter with no stations or a bad segment', async () => {
    await expect(StationLetterPage({ letter: 'z' })).rejects.toThrow('NEXT_NOT_FOUND');
    await expect(StationLetterPage({ letter: 'ab' })).rejects.toThrow('NEXT_NOT_FOUND');
  });
});

describe('stationBrowseMetadata', () => {
  it('gives the index and each letter a unique title, description and self-canonical', () => {
    const index = stationBrowseMetadata('a-z');
    const w = stationBrowseMetadata('w');
    const k = stationBrowseMetadata('k');
    expect(index.title).toBe('Stations A to Z');
    expect(index.alternates?.canonical).toBe('/stations/a-z');
    expect(w.title).toBe('Stations starting with W');
    expect(w.alternates?.canonical).toBe('/stations/w');
    expect(new Set([index.title, w.title, k.title, index.description, w.description, k.description]).size).toBe(6);
  });
});
