import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithMantine } from '@/test/render';
import { TrackedTrainRowMenu } from './TrackedTrainRowMenu';

// DeleteTrainButton and RenameTrainButton call useRouter(), which throws
// outside a real Next.js App Router tree.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/journeys',
  useSearchParams: () => new URLSearchParams(''),
}));

function renderMenu() {
  renderWithMantine(
    <TrackedTrainRowMenu
      displayName="10:02 to Brighton"
      trackingId={42}
      customName={null}
      defaultName="10:02 to Brighton"
      sharedGroupCount={0}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'More actions for 10:02 to Brighton' }));
}

/** `hidden: true`: in jsdom floating-ui's `hide()` middleware sets
 * `display: none` on the dropdown (everything measures 0x0), as
 * AccountMenu.test.tsx explains. */
function menuItem(name: string) {
  return screen.findByRole('menuitem', { name, hidden: true });
}

describe('TrackedTrainRowMenu', () => {
  it('renders only menu items inside the open menu, with no initial-focus placeholder', async () => {
    // axe's `aria-required-children` fires on Mantine's placeholder
    // `<div role="presentation">` when it sits inside `role="menu"`.
    renderMenu();
    await menuItem('Stop tracking');
    const menu = screen.getByRole('menu', { hidden: true });
    expect(menu.querySelector('[role="presentation"]')).toBeNull();
  });

  it('puts its items in the tab order, which is what makes dropping the placeholder safe', async () => {
    renderMenu();
    expect(await menuItem('Rename')).toHaveAttribute('tabindex', '0');
    expect(await menuItem('Stop tracking')).toHaveAttribute('tabindex', '0');
  });
});
