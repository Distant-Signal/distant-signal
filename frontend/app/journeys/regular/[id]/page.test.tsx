import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithMantine } from '@/test/render';
import JourneyTemplateDetailPage from './page';
import * as api from '@/lib/api';
import type { JourneyTemplateDetail } from '@/lib/types';
import { TEMPLATE_TARGET_DEFAULTS } from '@/test/apiDefaults';

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return {
    ...actual,
    getJourneyTemplate: vi.fn(),
  };
});

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/journeys/regular/167',
  useSearchParams: () => new URLSearchParams(''),
}));

function template(overrides: Partial<JourneyTemplateDetail> = {}): JourneyTemplateDetail {
  return {
    id: 167,
    customName: null,
    createdAt: '2026-09-22T00:00:00Z',
    updatedAt: '2026-09-22T00:00:00Z',
    daysOfWeek: null,
    active: true,
    startsOn: null,
    endsOn: null,
    defaultMatchMode: 'manual',
    autoCommitRule: null,
    ...TEMPLATE_TARGET_DEFAULTS,
    stationBufferMinutes: null,
    planOptions: null,
    usualItinerary: null,
    legs: [
      {
        id: 1,
        originCrs: 'KGX',
        originName: 'London Kings Cross',
        destinationCrs: 'EDB',
        destinationName: 'Edinburgh',
        departAfter: '09:00',
        departBefore: null,
        arriveAfter: null,
        arriveBefore: null,
      },
    ],
    ...overrides,
  };
}

async function renderPage(id = '167') {
  return renderWithMantine(await JourneyTemplateDetailPage({ params: Promise.resolve({ id }) }));
}

describe('JourneyTemplateDetailPage', () => {
  it('shows a login prompt on a 401 (ApiUnauthorizedError)', async () => {
    vi.mocked(api.getJourneyTemplate).mockRejectedValue(new api.ApiUnauthorizedError('API request failed: 401'));
    await renderPage();
    expect(screen.getByRole('link', { name: 'Log in to view this regular journey' })).toBeInTheDocument();
  });

  it('calls notFound() on a 404 (ApiNotFoundError)', async () => {
    vi.mocked(api.getJourneyTemplate).mockRejectedValue(new api.ApiNotFoundError('API request failed: 404'));
    await expect(renderPage()).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('renders the title, the leg editor pre-filled with the template legs, and both header buttons', async () => {
    vi.mocked(api.getJourneyTemplate).mockResolvedValue(template({ customName: 'My commute' }));
    await renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'My commute' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add a date' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete regular journey' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'From station' })).toHaveValue('KGX');
    expect(screen.getByRole('combobox', { name: 'To station' })).toHaveValue('EDB');
    expect(screen.getByLabelText('Earliest departure (optional)')).toHaveValue('09:00');
  });

  it('falls back to the route, as the list names it, when there is no custom name', async () => {
    vi.mocked(api.getJourneyTemplate).mockResolvedValue(template({ customName: null }));
    await renderPage();
    expect(
      screen.getByRole('heading', { level: 1, name: 'London Kings Cross (KGX) to Edinburgh (EDB)' }),
    ).toBeInTheDocument();
  });

  it('shows a regular journey: its target, next date, usual train, return journey and actions', async () => {
    vi.mocked(api.getJourneyTemplate).mockResolvedValue(
      template({
        customName: null,
        daysOfWeek: 31,
        originCrs: 'WOK',
        originName: 'Woking',
        destinationCrs: 'WAT',
        destinationName: 'London Waterloo',
        target: { kind: 'arrive_by', time: '08:30:00', dayOffset: 0 },
        pairedTemplateId: 168,
        nextDate: '2099-01-05',
        usualItinerary: {
          legs: [
            {
              kind: 'train',
              trainUid: 'W12345',
              originCrs: 'WOK',
              destinationCrs: 'WAT',
              departs: '07:48:00',
              departsDayOffset: 0,
              arrivesDayOffset: 0,
            },
          ],
        },
      }),
    );
    await renderPage();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Woking to London Waterloo, arrive by 08:30' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Next: 5 Jan 2099')).toBeInTheDocument();
    expect(screen.getByText('Your usual train: 07:48 Woking to London Waterloo')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'The return journey' })).toHaveAttribute('href', '/journeys/regular/168');
    expect(screen.getByRole('button', { name: 'Skip next' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
  });
});
