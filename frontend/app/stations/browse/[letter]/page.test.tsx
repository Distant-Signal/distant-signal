import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderWithMantine } from '@/test/render';
import * as api from '@/lib/api';
import StationLetterPage, { generateMetadata } from './page';

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
  vi.mocked(api.getStationCodes).mockResolvedValue(['WAT', 'WOK', 'KGX']);
  vi.mocked(api.getStationName).mockImplementation(async (crs) => {
    if (crs === 'WOK') throw new Error('lookup failed');
    return NAMES[crs] ?? null;
  });
});

const params = (letter: string) => ({ params: Promise.resolve({ letter }) });

describe('StationLetterPage', () => {
  it('lists every station with that first letter as a link to its page', async () => {
    renderWithMantine(await StationLetterPage(params('w')));
    expect(screen.getByRole('heading', { level: 1, name: 'Stations starting with W' })).toBeInTheDocument();
    const list = screen.getByRole('list', { name: 'Stations' });
    const links = within(list).getAllByRole('link');
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/stations/WAT', '/stations/WOK']);
    // A name that resolved, and the bare code when its lookup failed.
    expect(links.map((a) => a.textContent)).toEqual(['London Waterloo (WAT)', 'WOK']);
  });

  it('links back to the index and the other letters', async () => {
    renderWithMantine(await StationLetterPage(params('w')));
    expect(screen.getByRole('link', { name: 'Stations A to Z' })).toHaveAttribute('href', '/stations/browse');
    expect(screen.getByRole('link', { name: 'K' })).toHaveAttribute('href', '/stations/browse/k');
  });

  it('is not found for a letter with no stations or a bad segment', async () => {
    await expect(StationLetterPage(params('z'))).rejects.toThrow('NEXT_NOT_FOUND');
    await expect(StationLetterPage(params('ab'))).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('has a unique title, description and self-canonical per letter', async () => {
    const w = await generateMetadata(params('w'));
    const k = await generateMetadata(params('k'));
    expect(w.title).toBe('Stations starting with W');
    expect(w.title).not.toBe(k.title);
    expect(w.description).not.toBe(k.description);
    expect(w.alternates?.canonical).toBe('/stations/browse/w');
  });
});
