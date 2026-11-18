import { describe, expect, it } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithMantine } from '@/test/render';
import { CollapsedLegs } from './CollapsedLegs';

function renderRow() {
  return renderWithMantine(
    <CollapsedLegs label="Walk to Victoria, 6 min" detail="12 min to change.">
      <div id="leg-l_one">Walk, Euston to Victoria</div>
    </CollapsedLegs>,
  );
}

describe('CollapsedLegs', () => {
  it('is closed by default, with its label and detail showing', () => {
    renderRow();
    const toggle = screen.getByRole('button', { name: 'Walk to Victoria, 6 min' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('12 min to change.')).toBeVisible();
    expect(screen.getByText('Walk, Euston to Victoria')).not.toBeVisible();
  });

  it('keeps the legs in the page while closed, for their anchors, and names them with aria-controls', () => {
    renderRow();
    const toggle = screen.getByRole('button', { name: 'Walk to Victoria, 6 min' });
    const id = toggle.getAttribute('aria-controls');
    expect(id).toBeTruthy();
    expect(document.getElementById(id as string)).toContainElement(document.getElementById('leg-l_one'));
  });

  it('opens and closes on a click', () => {
    renderRow();
    const toggle = screen.getByRole('button', { name: 'Walk to Victoria, 6 min' });
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Walk, Euston to Victoria')).toBeVisible();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('Walk, Euston to Victoria')).not.toBeVisible();
  });

  it('is a real button the keyboard can reach, so Enter and Space operate it natively', () => {
    renderRow();
    const toggle = screen.getByRole('button', { name: 'Walk to Victoria, 6 min' });
    expect(toggle.tagName).toBe('BUTTON');
    expect(toggle).not.toBeDisabled();
    expect(toggle).not.toHaveAttribute('tabindex', '-1');
    toggle.focus();
    expect(toggle).toHaveFocus();
  });

  it('opens for a hash that points at a leg inside it', () => {
    window.location.hash = '#leg-l_one';
    renderRow();
    expect(screen.getByRole('button', { name: 'Walk to Victoria, 6 min' })).toHaveAttribute('aria-expanded', 'true');
    window.location.hash = '';
  });
});
