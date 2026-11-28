import { describe, it, expect, vi, afterEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithMantine } from '@/test/render';
import { ChangeTimeSection } from './ChangeTimeSection';

const NAME = 'Allow extra time to change trains';

async function choose(name: string) {
  fireEvent.click(screen.getByRole('combobox', { name: NAME }));
  fireEvent.click(await screen.findByRole('option', { name }));
}

function stubFetch(status: number) {
  const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(null, { status }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('ChangeTimeSection', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shows the current value and the helper text', () => {
    renderWithMantine(<ChangeTimeSection initial={10} />);
    expect(screen.getByRole('combobox', { name: NAME })).toHaveValue('10 minutes');
    expect(screen.getByText(/Added to the minimum time Distant Signal needs between trains/)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Changing trains' })).toBeInTheDocument();
  });

  it.each([
    ['None', 0, 5],
    ['5 minutes', 5, 0],
    ['10 minutes', 10, 0],
    ['15 minutes', 15, 0],
  ])('saves %s at once', async (label, minutes, initial) => {
    const fetchMock = stubFetch(204);
    renderWithMantine(<ChangeTimeSection initial={initial} />);
    await choose(label);
    expect(await screen.findByText('Saved.')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe('/api/preferences/change-time');
    expect(init?.method).toBe('PUT');
    expect(JSON.parse(String(init?.body))).toEqual({ extraMinutes: minutes });
    expect(screen.getByRole('combobox', { name: NAME })).toHaveValue(label);
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
  });

  it('goes back to the old value and says so when saving fails', async () => {
    stubFetch(500);
    renderWithMantine(<ChangeTimeSection initial={0} />);
    await choose('15 minutes');
    expect(await screen.findByText("Couldn't save your extra time. Try again.")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('combobox', { name: NAME })).toHaveValue('None'));
    expect(screen.queryByText('Saved.')).not.toBeInTheDocument();
  });

  it('goes back and says so when the request cannot be made', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('offline');
      }),
    );
    renderWithMantine(<ChangeTimeSection initial={5} />);
    await choose('None');
    expect(await screen.findByText("Couldn't save your extra time. Try again.")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('combobox', { name: NAME })).toHaveValue('5 minutes'));
  });

  it('keeps a stored value that is not one of the usual choices as its own option', async () => {
    stubFetch(204);
    renderWithMantine(<ChangeTimeSection initial={7} />);
    expect(screen.getByRole('combobox', { name: NAME })).toHaveValue('7 minutes');
    fireEvent.click(screen.getByRole('combobox', { name: NAME }));
    const options = (await screen.findAllByRole('option')).map((option) => option.textContent);
    expect(options).toEqual(['None', '5 minutes', '7 minutes', '10 minutes', '15 minutes']);
  });
});
