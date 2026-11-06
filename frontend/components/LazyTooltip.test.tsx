import { afterEach, describe, it, expect, vi } from 'vitest';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { LazyTooltip } from './LazyTooltip';
import { renderWithMantine } from '@/test/render';

// The theme `Tooltip`'s behaviour (components/Tooltip.test.tsx), from a
// tooltip that only mounts when it is first wanted (DS-374).
describe('LazyTooltip', () => {
  afterEach(() => vi.restoreAllMocks());

  function renderTooltip() {
    renderWithMantine(
      <LazyTooltip label="Departs from platform 4">
        <button type="button">Platform</button>
      </LazyTooltip>,
    );
    return screen.getByRole('button', { name: 'Platform' });
  }

  /** jsdom never matches `:focus-visible`; a browser does for keyboard
   * focus. */
  function focusVisible(visible: boolean) {
    const matches = Element.prototype.matches;
    vi.spyOn(Element.prototype, 'matches').mockImplementation(function (this: Element, selector: string) {
      return selector === ':focus-visible' ? visible : matches.call(this, selector);
    });
  }

  it('renders only the trigger, undescribed, until wanted', () => {
    const trigger = renderTooltip();
    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(trigger).not.toHaveAttribute('aria-describedby');
    expect(document.querySelector('[data-portal]')).toBeNull();
  });

  it('opens on hover as the trigger’s description, and closes on leave', async () => {
    const trigger = renderTooltip();
    fireEvent.mouseEnter(trigger);
    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent('Departs from platform 4');
    expect(trigger).toHaveAccessibleDescription('Departs from platform 4');
    // The same element: mounting the tooltip doesn't re-mount the trigger.
    expect(screen.getByRole('button', { name: 'Platform' })).toBe(trigger);

    fireEvent.mouseLeave(trigger);
    await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull());
    expect(trigger).not.toHaveAttribute('aria-describedby');

    fireEvent.mouseEnter(trigger);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Departs from platform 4');
  });

  it('opens on keyboard focus, keeping focus on the trigger, and closes on blur', async () => {
    focusVisible(true);
    const trigger = renderTooltip();
    act(() => trigger.focus());
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Departs from platform 4');
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAccessibleDescription('Departs from platform 4');

    act(() => trigger.blur());
    await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull());
  });

  it('stays shut for the focus a click gives', async () => {
    focusVisible(false);
    const trigger = renderTooltip();
    act(() => trigger.focus());
    // Give a wrongly opening tooltip its render.
    await act(async () => {});
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('stays shut for a tap', async () => {
    const trigger = renderTooltip();
    fireEvent.pointerEnter(trigger, { pointerType: 'touch' });
    fireEvent.mouseEnter(trigger);
    await act(async () => {});
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('closes on Escape', async () => {
    const trigger = renderTooltip();
    fireEvent.mouseEnter(trigger);
    await screen.findByRole('tooltip');
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull());
  });

  it('keeps the trigger’s own handlers', () => {
    const onMouseEnter = vi.fn();
    const onFocus = vi.fn();
    renderWithMantine(
      <LazyTooltip label="Label">
        <button type="button" onMouseEnter={onMouseEnter} onFocus={onFocus}>
          Trigger
        </button>
      </LazyTooltip>,
    );
    const trigger = screen.getByRole('button', { name: 'Trigger' });
    fireEvent.mouseEnter(trigger);
    act(() => trigger.focus());
    expect(onMouseEnter).toHaveBeenCalledTimes(1);
    expect(onFocus).toHaveBeenCalledTimes(1);
  });
});
