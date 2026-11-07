import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithMantine } from '@/test/render';
import { RouteShortcutPicker } from './RouteShortcutPicker';

const saved = { key: 'saved-1', label: 'Office', originCrs: 'WOK', destinationCrs: 'WAT' };
const recent = { key: 'recent-GLD-WOK', label: 'Guildford to Woking', originCrs: 'GLD', destinationCrs: 'WOK' };

describe('RouteShortcutPicker', () => {
  it('offers saved and recent routes, each filling both stations', () => {
    const onPick = vi.fn();
    renderWithMantine(<RouteShortcutPicker shortcuts={{ saved: [saved], recent: [recent] }} onPick={onPick} />);
    expect(screen.getByRole('group', { name: 'Start from a saved route' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Guildford to Woking' }));
    expect(onPick).toHaveBeenCalledWith('GLD', 'WOK');
    fireEvent.click(screen.getByRole('button', { name: 'Office' }));
    expect(onPick).toHaveBeenLastCalledWith('WOK', 'WAT');
  });

  it('leaves out an empty kind', () => {
    renderWithMantine(<RouteShortcutPicker shortcuts={{ saved: [], recent: [recent] }} onPick={vi.fn()} />);
    expect(screen.queryByText('Start from a saved route')).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Recent routes' })).toBeInTheDocument();
  });

  it('renders nothing with neither', () => {
    renderWithMantine(<RouteShortcutPicker shortcuts={{ saved: [], recent: [] }} onPick={vi.fn()} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByText('Recent routes')).not.toBeInTheDocument();
  });
});
