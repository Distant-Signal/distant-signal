import { describe, it, expect, vi, afterEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithMantine } from '@/test/render';
import { BankHolidaysSection } from './BankHolidaysSection';

async function choose(name: string) {
  fireEvent.click(screen.getByRole('combobox', { name: 'Whose bank holidays' }));
  fireEvent.click(await screen.findByRole('option', { name }));
}

describe('BankHolidaysSection', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('saves a new choice at once', async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(null, { status: 204 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    renderWithMantine(<BankHolidaysSection initial="england-and-wales" />);
    await choose('Scotland');
    expect(await screen.findByText('Saved.')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe('/api/preferences/bank-holiday-division');
    expect(init?.method).toBe('PUT');
    expect(JSON.parse(String(init?.body))).toEqual({ division: 'scotland' });
    expect(screen.getByRole('combobox', { name: 'Whose bank holidays' })).toHaveValue('Scotland');
  });

  it('goes back to the old choice and says so when saving fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 500 })),
    );
    renderWithMantine(<BankHolidaysSection initial={null} />);
    expect(screen.getByRole('combobox', { name: 'Whose bank holidays' })).toHaveValue('England and Wales');
    await choose('Northern Ireland');
    expect(await screen.findByText("Couldn't save your bank holidays. Try again.")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Whose bank holidays' })).toHaveValue('England and Wales'),
    );
  });
});
