import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen } from '@testing-library/react';
import { renderWithMantine } from '@/test/render';
import { noteMinBuild, resetMinBuildStore } from '@/lib/minBuildStore';

const reloadForUpdate = vi.fn(() => Promise.resolve());
vi.mock('@/lib/reloadForUpdate', () => ({ reloadForUpdate: () => reloadForUpdate() }));
import { BuildUpdateNotice } from './BuildUpdateNotice';

const MESSAGE = 'A new version of Distant Signal is available.';

describe('BuildUpdateNotice', () => {
  beforeEach(() => {
    reloadForUpdate.mockClear();
    resetMinBuildStore();
    vi.stubEnv('NEXT_PUBLIC_BUILD_EPOCH', '3');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('shows when the server floor is above this build', () => {
    renderWithMantine(<BuildUpdateNotice serverMinBuild={4} />);
    expect(screen.getByRole('status')).toHaveTextContent(MESSAGE);
  });

  it.each([3, 2, null])('stays hidden for a floor of %s', (floor) => {
    renderWithMantine(<BuildUpdateNotice serverMinBuild={floor} />);
    expect(screen.queryByText(MESSAGE)).toBeNull();
  });

  it('shows when an api response carries a higher floor, and not for a lower one', () => {
    renderWithMantine(<BuildUpdateNotice serverMinBuild={null} />);
    act(() => noteMinBuild('3'));
    expect(screen.queryByText(MESSAGE)).toBeNull();
    act(() => noteMinBuild('8'));
    expect(screen.getByText(MESSAGE)).toBeInTheDocument();
  });

  it('stays hidden for a build with no epoch', () => {
    vi.stubEnv('NEXT_PUBLIC_BUILD_EPOCH', '');
    renderWithMantine(<BuildUpdateNotice serverMinBuild={99} />);
    expect(screen.queryByText(MESSAGE)).toBeNull();
  });

  it('reloads from the button and takes no focus on its own', () => {
    renderWithMantine(<BuildUpdateNotice serverMinBuild={4} />);
    const button = screen.getByRole('button', { name: 'Reload' });
    expect(button).not.toHaveFocus();
    fireEvent.click(button);
    expect(reloadForUpdate).toHaveBeenCalledTimes(1);
  });
});
