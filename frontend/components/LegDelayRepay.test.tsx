import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithMantine } from '@/test/render';
import { LegDelayRepay, legDelayRepaySummary } from './LegDelayRepay';
import type { DelayRepayEstimate, LegDelayRepay as LegDelayRepayFields } from '@/lib/types';
import { DELAY_REPAY_ESTIMATE_DEFAULTS, LEG_DELAY_REPAY_DEFAULTS } from '@/test/apiDefaults';

function fields(overrides: Partial<LegDelayRepayFields> = {}): LegDelayRepayFields {
  return {
    ...LEG_DELAY_REPAY_DEFAULTS,
    claimUrl: 'https://delayrepay.lner.co.uk/delayrepayV2/',
    disclaimer: 'A rough estimate.',
    ...overrides,
  };
}

const longDelay: DelayRepayEstimate = {
  ...DELAY_REPAY_ESTIMATE_DEFAULTS,
  scheme: 'DR30',
  bandMinutes: 120,
  percentage: 100,
  fareBasis: 'return',
  disclaimer: 'e',
};

describe('legDelayRepaySummary', () => {
  it('reads the leg in a few words', () => {
    expect(legDelayRepaySummary(fields())).toBe('No delay recorded yet');
    expect(legDelayRepaySummary(fields({ delayMinutes: 0 }))).toBe('On time');
    expect(legDelayRepaySummary(fields({ delayMinutes: 9, provisional: true }))).toBe('9 minutes late so far');
    expect(legDelayRepaySummary(fields({ delayMinutes: 125, estimate: longDelay }))).toBe(
      'May qualify (DR30, 120+ minutes)',
    );
    expect(legDelayRepaySummary(fields({ outcome: 'notReached', measuredAtName: 'York' }))).toBe("Didn't reach York");
    expect(legDelayRepaySummary(fields({ serviceMode: 'bus', liveTracking: false }))).toBe(
      "Buses and ferries aren't measured",
    );
  });
});

describe('LegDelayRepay', () => {
  it('stays closed to its summary line when nothing may be due', () => {
    const { container } = renderWithMantine(<LegDelayRepay delayRepay={fields({ delayMinutes: 4 })} />);
    expect(container.querySelector('details')).not.toHaveAttribute('open');
    expect(screen.getByText('4 minutes late')).toBeInTheDocument();
  });

  it('opens when the leg may qualify, and asks for the ticket type only when it would change the band', () => {
    const { container } = renderWithMantine(
      <LegDelayRepay delayRepay={fields({ delayMinutes: 125, estimate: longDelay })} />,
    );
    expect(container.querySelector('details')).toHaveAttribute('open');
    expect(screen.getByText(/Add your ticket type below/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /See how to claim from the operator/ })).toHaveAttribute(
      'href',
      'https://delayrepay.lner.co.uk/delayrepayV2/',
    );
  });

  it('asks nothing once the ticket says single or return', () => {
    renderWithMantine(
      <LegDelayRepay
        delayRepay={fields({ delayMinutes: 125, ticketKnown: true, estimate: { ...longDelay, ticketKind: 'return' } })}
      />,
    );
    expect(screen.queryByText(/Add your ticket type/)).not.toBeInTheDocument();
  });
});
