import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithMantine } from '@/test/render';
import { JourneyDetailView } from './JourneyDetailView';
import { journeyDetail, trainLeg } from '@/test/journeyFixtures';
import type { JourneyDetail } from '@/lib/types';

/* "Track this journey again" and "Move this journey" on the journey page. */

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/journeys/42',
  useSearchParams: () => new URLSearchParams(''),
}));

const KGX: [string, string] = ['KGX', 'London Kings Cross'];
const YRK: [string, string] = ['YRK', 'York'];

function journey(overrides: Partial<JourneyDetail> = {}): JourneyDetail {
  return {
    ...journeyDetail(42, [trainLeg(1, KGX, YRK, '2026-09-17T07:00:00Z', '2026-09-17T09:00:00Z')]),
    ...overrides,
  };
}

function renderView(detail: JourneyDetail, at: string, viaShareLink = false) {
  return renderWithMantine(
    <JourneyDetailView journey={detail} fetchedAt={at} origin="https://example.test" viaShareLink={viaShareLink} />,
  );
}

describe('JourneyDetailView track again and move', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-17T05:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('offers the owner both before the journey starts', () => {
    renderView(journey(), '2026-09-17T05:00:00Z');
    expect(screen.getByRole('button', { name: 'Move this journey' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Track this journey again' })).toBeInTheDocument();
  });

  it('stops offering a move once the journey has started', () => {
    vi.setSystemTime(new Date('2026-09-18T05:00:00Z'));
    renderView(journey(), '2026-09-18T05:00:00Z');
    expect(screen.queryByRole('button', { name: 'Move this journey' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Track this journey again' })).toBeInTheDocument();
  });

  it('never offers a move to someone who is not the owner', () => {
    renderView(journey({ isOwner: false }), '2026-09-17T05:00:00Z');
    expect(screen.queryByRole('button', { name: 'Move this journey' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Track this journey again' })).toBeInTheDocument();
  });
});
