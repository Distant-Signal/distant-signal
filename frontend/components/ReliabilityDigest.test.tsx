import { describe, it, expect } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderWithMantine } from '@/test/render';
import { ReliabilityDigest } from './ReliabilityDigest';
import type { ReliabilityJourney, ReliabilityResponse, ReliabilityTrain } from '@/lib/types';
import {
  DELAY_REPAY_ESTIMATE_DEFAULTS,
  RELIABILITY_JOURNEY_DEFAULTS,
  RELIABILITY_TRAIN_DEFAULTS,
} from '@/test/apiDefaults';

// Substring-equal to DelayRepayEstimate.test.tsx's own TOP_LEVEL_DISCLAIMER
// fixture -- the one mechanical guard against the two silently drifting
// apart if `delay_repay_rules::ROUTE_DISCLAIMER` is ever reworded.
const CARRIED_FORWARD_DISCLAIMER = 'not a guarantee of compensation and not proof you travelled';

function train(overrides: Partial<ReliabilityTrain> = {}): ReliabilityTrain {
  return {
    ...RELIABILITY_TRAIN_DEFAULTS,
    journeyId: 1,
    legId: 10,
    serviceDate: '2026-09-01',
    delayMinutes: 3,
    ...overrides,
  };
}

function journey(overrides: Partial<ReliabilityJourney> = {}): ReliabilityJourney {
  return {
    ...RELIABILITY_JOURNEY_DEFAULTS,
    journeyId: 1,
    serviceDate: '2026-09-01',
    delayMinutes: 35,
    estimate: { ...DELAY_REPAY_ESTIMATE_DEFAULTS, scheme: 'DR30', bandMinutes: 30, percentage: 50, disclaimer: 'e' },
    ...overrides,
  };
}

function digest(reliability: Partial<ReliabilityResponse>) {
  renderWithMantine(<ReliabilityDigest reliability={{ trains: [], journeys: [], ...reliability }} />);
}

describe('ReliabilityDigest', () => {
  it('nothing finished yet: the check-back-later prose, never a 0% or 0-of-0 figure', () => {
    digest({});
    expect(screen.getByText(/check back once its trains have run/)).toBeInTheDocument();
    expect(screen.getByText(/whether it may have qualified for Delay Repay. No ticket needed./)).toBeInTheDocument();
    expect(screen.queryByText(/0%/)).not.toBeInTheDocument();
    expect(screen.queryByText(/0 of 0/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Attach a ticket/)).not.toBeInTheDocument();
  });

  it('shows an on-time percentage over the trains taken', () => {
    digest({ trains: [train({ delayMinutes: 0 })] });
    expect(screen.getByText(/Of the 1 train you took with a recorded arrival, 100% were on time/)).toBeInTheDocument();
  });

  it('all cancelled: reports the cancellations, with the booked trains the railway replaced', () => {
    digest({
      trains: [train({ legId: null, delayMinutes: null, cancelled: true, replacedBecause: 'cancelled' })],
    });
    expect(screen.getByText(/1 train you were booked on was cancelled/)).toBeInTheDocument();
    expect(screen.getByText(/1 booked train the railway replaced/)).toBeInTheDocument();
    expect(screen.queryByText(/0%/)).not.toBeInTheDocument();
  });

  it('lists only late trains as most delayed, each linking to its journey', () => {
    digest({
      trains: [train({ journeyId: 7, delayMinutes: 12 }), train({ journeyId: 8, legId: 11, delayMinutes: -3 })],
    });
    expect(screen.getByText('Your most delayed trains:')).toBeInTheDocument();
    expect(screen.getByText('12 minutes late')).toBeInTheDocument();
    expect(screen.queryByText('-3 minutes late')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '1 Sep 2026' })).toHaveAttribute('href', '/journeys/7');
  });

  it('counts journeys for Delay Repay with no ticket, and says when one was measured against the booked train', () => {
    digest({
      trains: [train()],
      journeys: [
        journey(),
        journey({ journeyId: 2, againstBookedPlan: true, delayMinutes: 42 }),
        journey({ journeyId: 3, estimate: null, delayMinutes: 4 }),
      ],
    });
    const rollup = screen.getByTestId('delay-repay-rollup');
    expect(within(rollup).getByText(/Of your last 3 finished journeys, 2 may have qualified/)).toBeInTheDocument();
    expect(within(rollup).getByText(/2 journeys: 30 to 59 minutes late/)).toBeInTheDocument();
    expect(within(rollup).getByText('42 minutes late against the train you booked')).toBeInTheDocument();
    expect(within(rollup).queryByText(/Attach a ticket|Add your ticket type/)).toBeNull();
  });

  it('heads the Delay Repay part with a plain h3, not an alert', () => {
    digest({ journeys: [journey()] });
    const rollup = screen.getByTestId('delay-repay-rollup');
    expect(within(rollup).getByRole('heading', { level: 3, name: 'Delay Repay' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText('Possible Delay Repay across your journeys')).toBeNull();
  });

  it('says plainly when none of the finished journeys may have qualified', () => {
    digest({ journeys: [journey({ estimate: null, delayMinutes: 2 })] });
    expect(screen.getByText(/Of your 1 finished journey, 0 may have qualified/)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('asks for the ticket type only when a 120-minute band depends on it', () => {
    digest({
      journeys: [
        journey({
          delayMinutes: 130,
          estimate: {
            ...DELAY_REPAY_ESTIMATE_DEFAULTS,
            scheme: 'DR15',
            bandMinutes: 120,
            percentage: 100,
            disclaimer: 'e',
          },
        }),
      ],
    });
    expect(screen.getByText(/Add your ticket type on the journey/)).toBeInTheDocument();
  });

  it('hedged copy: the disclaimer carried forward, no money total, no claim-performing language, no outbound link', () => {
    digest({ trains: [train()], journeys: [journey()] });
    expect(screen.getByText(new RegExp(CARRIED_FORWARD_DISCLAIMER))).toBeInTheDocument();
    expect(screen.getByText(/don.t store ticket prices/)).toBeInTheDocument();
    expect(screen.queryByText(/claim now/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/get your refund/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\bsubmit\b/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/£/)).not.toBeInTheDocument();
    // The rollup links only to the caller's own journeys, never out to a
    // claim page: each journey's page carries its own claim link.
    const rollup = screen.getByTestId('delay-repay-rollup');
    for (const link of within(rollup).queryAllByRole('link')) {
      expect(link.getAttribute('href')).toMatch(/^\/journeys\/\d+$/);
    }
  });
});
