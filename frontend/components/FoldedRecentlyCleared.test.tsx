import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithMantine } from '@/test/render';
import { FoldedRecentlyCleared } from './FoldedRecentlyCleared';
import * as api from '@/lib/api';

vi.mock('@/lib/api', () => ({ getRecentlyCleared: vi.fn() }));

const NOW = Date.parse('2026-11-28T10:00:00Z');

async function renderFold() {
  return renderWithMantine(await FoldedRecentlyCleared({ crs: 'KGX', now: NOW }));
}

describe('FoldedRecentlyCleared', () => {
  it('folds the cleared incidents, closed, with their text still in the page', async () => {
    vi.mocked(api.getRecentlyCleared).mockResolvedValue([
      {
        incidentId: 'inc-1',
        summary: 'Signalling fault at Peterborough',
        description: '<p>Cleared by the signaller.</p>',
        operators: ['GR'],
        affectedLines: [{ id: 'ecml', name: 'East Coast Main Line' }],
        clearedAt: '2026-11-28T09:00:00Z',
        lastListedAt: '2026-11-28T09:30:00Z',
        expectedUntil: null,
        expectedUntilEndOfDay: false,
      },
    ]);
    await renderFold();
    expect(api.getRecentlyCleared).toHaveBeenCalledWith({ station: 'KGX' });
    const button = screen.getByRole('button', { name: 'Recently cleared' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button.closest('h2')).not.toBeNull();
    const link = screen.getByText('Signalling fault at Peterborough');
    expect(link).toBeInTheDocument();
    expect(link).not.toBeVisible();
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(link).toBeVisible();
  });

  it('renders no fold when nothing has cleared', async () => {
    vi.mocked(api.getRecentlyCleared).mockResolvedValue([]);
    await renderFold();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('says so inside the fold when the read fails', async () => {
    vi.mocked(api.getRecentlyCleared).mockRejectedValue(new Error('boom'));
    await renderFold();
    expect(screen.getByRole('button', { name: 'Recently cleared' })).toBeInTheDocument();
    expect(screen.getByText(/Couldn't load recently cleared incidents/)).toBeInTheDocument();
  });
});
