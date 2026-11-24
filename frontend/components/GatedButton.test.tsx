import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithMantine } from '@/test/render';
import { GatedButton } from './GatedButton';

describe('GatedButton', () => {
  it('stays focusable while blocked, says why, and ignores the press', () => {
    const onClick = vi.fn();
    renderWithMantine(
      <GatedButton blockedReason="Fill in Name." onClick={onClick}>
        Save
      </GatedButton>,
    );
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).not.toBeDisabled();
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveAccessibleDescription('Fill in Name.');
    button.focus();
    expect(button).toHaveFocus();
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('does not submit its form while blocked, and does once the reason is gone', () => {
    const onSubmit = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
    const first = renderWithMantine(
      <form onSubmit={onSubmit}>
        <GatedButton type="submit" blockedReason="Fill in Name.">
          Save
        </GatedButton>
      </form>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSubmit).not.toHaveBeenCalled();
    first.unmount();
    renderWithMantine(
      <form onSubmit={onSubmit}>
        <GatedButton type="submit" blockedReason={null}>
          Save
        </GatedButton>
      </form>,
    );
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).not.toHaveAttribute('aria-disabled');
    expect(button).toHaveAccessibleDescription('');
    fireEvent.click(button);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('keeps focus while its request is in flight, and ignores a second press', () => {
    const onClick = vi.fn();
    renderWithMantine(
      <GatedButton busy onClick={onClick}>
        Searching
      </GatedButton>,
    );
    const button = screen.getByRole('button', { name: 'Searching' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveAttribute('aria-busy', 'true');
    button.focus();
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
    expect(button).toHaveFocus();
  });

  it('keeps a description the caller gave', () => {
    renderWithMantine(
      <>
        <span id="note">Check the form.</span>
        <GatedButton aria-describedby="note" blockedReason="Fill in Name.">
          Save
        </GatedButton>
      </>,
    );
    expect(screen.getByRole('button', { name: 'Save' })).toHaveAccessibleDescription('Check the form. Fill in Name.');
  });
});
