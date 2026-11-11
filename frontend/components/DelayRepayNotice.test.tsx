import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithMantine } from '@/test/render';
import { DelayRepayNotice } from './DelayRepayNotice';

describe('DelayRepayNotice', () => {
  it('renders nothing when no journey may qualify', () => {
    renderWithMantine(<DelayRepayNotice count={0} />);
    expect(screen.queryByTestId('delay-repay-notice')).toBeNull();
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('one journey: singular title and "Open it", as a note rather than an alert', () => {
    renderWithMantine(<DelayRepayNotice count={1} />);
    const note = screen.getByRole('note');
    expect(note).toHaveTextContent('1 recent journey may qualify for Delay Repay');
    expect(note).toHaveTextContent("Open it to see the estimate and the operator's claim page.");
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('several journeys: plural title and "Open each one"', () => {
    renderWithMantine(<DelayRepayNotice count={3} />);
    const note = screen.getByRole('note');
    expect(note).toHaveTextContent('3 recent journeys may qualify for Delay Repay');
    expect(note).toHaveTextContent('Open each one to see the estimate');
  });

  it('keeps the hedge: a rough estimate, never a claim made for the traveller, and nothing to dismiss', () => {
    renderWithMantine(<DelayRepayNotice count={2} />);
    const note = screen.getByRole('note');
    expect(note).toHaveTextContent(
      "It's a rough estimate: your ticket and the operator decide, and Distant Signal never claims for you.",
    );
    expect(screen.queryByRole('button')).toBeNull();
  });
});
