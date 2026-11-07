import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithMantine } from '@/test/render';
import { TrackJourneyAgainButton } from './TrackJourneyAgainButton';
import type { JourneyDetail, JourneyLegDetail } from '@/lib/types';
import { JOURNEY_DETAIL_DEFAULTS, JOURNEY_LEG_DEFAULTS } from '@/test/apiDefaults';

const pushMock = vi.fn();
const TRAIN = { trainUid: 'W12345' } as JourneyLegDetail['trackedTrainState'];
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: vi.fn() }),
  usePathname: () => '/journeys/167',
  useSearchParams: () => new URLSearchParams(''),
}));

function leg(overrides: Partial<JourneyLegDetail> = {}): JourneyLegDetail {
  return {
    kind: 'train',
    ...JOURNEY_LEG_DEFAULTS,
    id: 1,
    originCrs: 'KGX',
    originName: null,
    destinationCrs: 'YRK',
    destinationName: null,
    serviceDate: '2026-09-22',
    departAfter: null,
    departBefore: null,
    arriveAfter: null,
    arriveBefore: null,
    windowSearched: false,
    matchMode: 'manual',
    trackedTrainState: null,
    legSkip: null,
    ...overrides,
  };
}

function journey(legs: JourneyLegDetail[], isOwner = true): JourneyDetail {
  return {
    ...JOURNEY_DETAIL_DEFAULTS,
    id: 167,
    customName: null,
    createdAt: '2026-09-22T00:00:00Z',
    legs,
    isOwner,
    shareLink: null,
  };
}

describe('TrackJourneyAgainButton', () => {
  beforeEach(() => {
    pushMock.mockClear();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {})),
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it('opens the plan-again dialog for the owner, asking the api for the whole route', async () => {
    renderWithMantine(<TrackJourneyAgainButton journey={journey([leg({ trackedTrainState: TRAIN })])} />);
    fireEvent.click(screen.getByRole('button', { name: 'Track this journey again' }));
    expect(await screen.findByRole('dialog', { name: 'Track this journey again' })).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith('/api/Journeys/167/repeat');
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('opens the dialog for a group viewer too', async () => {
    renderWithMantine(<TrackJourneyAgainButton journey={journey([leg({ trackedTrainState: TRAIN })], false)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Track this journey again' }));
    expect(await screen.findByRole('dialog', { name: 'Track this journey again' })).toBeInTheDocument();
  });

  it('keeps the pick-mode /track link through a share link', () => {
    renderWithMantine(<TrackJourneyAgainButton journey={journey([leg()], false)} viaShareLink />);
    fireEvent.click(screen.getByRole('button', { name: 'Track this journey again' }));
    expect(pushMock).toHaveBeenCalledWith('/track?mode=pick&origin=KGX&destination=YRK');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('keeps a window-mode /track link for an Irish train or a transit ride', () => {
    const irish = leg({
      departAfter: '08:00:00',
      matchMode: 'unmatched',
      trackedTrainState: { trainUid: 'ie:A120' } as JourneyLegDetail['trackedTrainState'],
    });
    renderWithMantine(<TrackJourneyAgainButton journey={journey([irish])} />);
    fireEvent.click(screen.getByRole('button', { name: 'Track this journey again' }));
    expect(pushMock).toHaveBeenCalledWith('/track?mode=window&origin=KGX&destination=YRK&departAfter=08%3A00');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('keeps the /track link while a leg has no train picked', () => {
    renderWithMantine(<TrackJourneyAgainButton journey={journey([leg()])} />);
    fireEvent.click(screen.getByRole('button', { name: 'Track this journey again' }));
    expect(pushMock).toHaveBeenCalledWith('/track?mode=pick&origin=KGX&destination=YRK');
  });

  it('renders nothing through a share link when there is no origin to reproduce', () => {
    renderWithMantine(
      <TrackJourneyAgainButton journey={journey([leg({ originCrs: null, destinationCrs: null })])} viaShareLink />,
    );
    expect(screen.queryByRole('button', { name: 'Track this journey again' })).not.toBeInTheDocument();
  });
});
