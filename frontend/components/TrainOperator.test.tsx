import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithMantine } from '@/test/render';
import { TrainOperator } from './TrainOperator';

describe('TrainOperator', () => {
  it('shows the name with its code', () => {
    renderWithMantine(<TrainOperator name="West Midlands Railway" code="WM" />);
    expect(screen.getByTestId('train-operator')).toHaveTextContent('Operated by West Midlands Railway (WM)');
  });

  it('shows the name alone or the code alone', () => {
    const { unmount } = renderWithMantine(<TrainOperator name="West Midlands Railway" code={null} />);
    expect(screen.getByTestId('train-operator')).toHaveTextContent(/^Operated by West Midlands Railway$/);
    unmount();
    renderWithMantine(<TrainOperator code="WM" />);
    expect(screen.getByTestId('train-operator')).toHaveTextContent(/^Operated by WM$/);
  });

  it('renders nothing without an operator', () => {
    const { container } = renderWithMantine(<TrainOperator name={null} code="" />);
    expect(container.querySelector('[data-testid="train-operator"]')).toBeNull();
  });
});
