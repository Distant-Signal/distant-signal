import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithMantine } from '@/test/render';
import RegularJourneysPage from './page';
import * as api from '@/lib/api';
import type { JourneyTemplateListItem } from '@/lib/types';
import { byVisibleText } from '@/test/routeText';
import { TEMPLATE_TARGET_DEFAULTS } from '@/test/apiDefaults';

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return {
    ...actual,
    getMyJourneyTemplates: vi.fn(),
  };
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/journeys/regular',
  useSearchParams: () => new URLSearchParams(''),
}));

function template(overrides: Partial<JourneyTemplateListItem> = {}): JourneyTemplateListItem {
  return {
    id: 1,
    customName: null,
    createdAt: '2026-09-22T00:00:00Z',
    legCount: 1,
    firstOriginCrs: 'KGX',
    firstOriginName: 'London Kings Cross',
    lastDestinationCrs: 'EDB',
    lastDestinationName: 'Edinburgh',
    active: true,
    daysOfWeek: null,
    defaultMatchMode: 'manual',
    nextRunOn: null,
    hasOpenLegs: false,
    ...TEMPLATE_TARGET_DEFAULTS,
    startsOn: null,
    endsOn: null,
    ...overrides,
  };
}

async function renderPage() {
  return renderWithMantine(await RegularJourneysPage());
}

describe('RegularJourneysPage', () => {
  it('shows a login prompt when not logged in (getMyJourneyTemplates returns null)', async () => {
    vi.mocked(api.getMyJourneyTemplates).mockResolvedValue(null);
    await renderPage();
    expect(screen.getByRole('heading', { level: 1, name: 'Regular journeys' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Log in to see your regular journeys' })).toBeInTheDocument();
  });

  it('shows the empty-state copy when logged in with no templates', async () => {
    vi.mocked(api.getMyJourneyTemplates).mockResolvedValue([]);
    await renderPage();
    expect(screen.getByText(/No regular journeys yet\./)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'New regular journey' })).toHaveAttribute('href', '/journeys/regular/new');
  });

  it('renders one card per template, titled by its custom name when set', async () => {
    vi.mocked(api.getMyJourneyTemplates).mockResolvedValue([template({ id: 1, customName: 'My commute' })]);
    await renderPage();
    const link = screen.getByRole('link', { name: 'My commute' });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/journeys/regular/1');
    // The computed route is still shown as a secondary line under a custom name.
    expect(screen.getByText(byVisibleText('London Kings Cross (KGX) to Edinburgh (EDB)'))).toBeInTheDocument();
  });

  it('falls back to the computed route as the title when there is no custom name', async () => {
    vi.mocked(api.getMyJourneyTemplates).mockResolvedValue([template({ id: 2, customName: null })]);
    await renderPage();
    expect(screen.getByRole('link', { name: 'London Kings Cross (KGX) to Edinburgh (EDB)' })).toBeInTheDocument();
  });

  it('shows the leg count, singular for one leg', async () => {
    vi.mocked(api.getMyJourneyTemplates).mockResolvedValue([template({ legCount: 1 })]);
    await renderPage();
    expect(screen.getByText(/1 leg ·/)).toBeInTheDocument();
  });

  it('shows the leg count, plural for more than one leg', async () => {
    vi.mocked(api.getMyJourneyTemplates).mockResolvedValue([template({ legCount: 3 })]);
    await renderPage();
    expect(screen.getByText(/3 legs ·/)).toBeInTheDocument();
  });

  it('renders one card per template when there are several', async () => {
    vi.mocked(api.getMyJourneyTemplates).mockResolvedValue([
      template({ id: 1, customName: 'Commute' }),
      template({ id: 2, customName: 'Weekend trip' }),
    ]);
    await renderPage();
    expect(screen.getByRole('link', { name: 'Commute' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Weekend trip' })).toBeInTheDocument();
  });

  it('says a template with no days does not recur', async () => {
    vi.mocked(api.getMyJourneyTemplates).mockResolvedValue([template()]);
    await renderPage();
    expect(screen.getByText('Not recurring')).toBeInTheDocument();
    expect(screen.queryByText('Paused')).not.toBeInTheDocument();
  });

  it("shows a recurring template's days and next run", async () => {
    vi.mocked(api.getMyJourneyTemplates).mockResolvedValue([
      template({ daysOfWeek: 31, nextRunOn: '2099-01-05', nextDate: '2099-01-05' }),
      template({ id: 2, daysOfWeek: 1 | 4 | 16, nextRunOn: null }),
    ]);
    await renderPage();
    expect(screen.getByText(byVisibleText('Weekdays · Next: 5 Jan 2099'))).toBeInTheDocument();
    expect(screen.getByText('Mon, Wed, Fri')).toBeInTheDocument();
  });

  it('marks a paused template and gives no next run', async () => {
    vi.mocked(api.getMyJourneyTemplates).mockResolvedValue([
      template({ daysOfWeek: 31, active: false, nextRunOn: null, hasOpenLegs: true }),
    ]);
    await renderPage();
    expect(screen.getByText('Paused')).toBeInTheDocument();
    expect(screen.getByText('Weekdays')).toBeInTheDocument();
    expect(screen.queryByText(/Add a departure time/)).not.toBeInTheDocument();
  });

  it('asks for times when a recurring leg has none', async () => {
    vi.mocked(api.getMyJourneyTemplates).mockResolvedValue([
      template({ daysOfWeek: 31, nextRunOn: '2099-01-05', hasOpenLegs: true }),
      template({ id: 2, daysOfWeek: 31, nextRunOn: '2099-01-05', hasOpenLegs: true, defaultMatchMode: 'auto' }),
    ]);
    await renderPage();
    expect(
      screen.getByText('Add a departure time to each leg so we can remind you to pick a train.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Add a departure time to each leg to let us pick your train.')).toBeInTheDocument();
  });

  it('names a regular journey by its route and target', async () => {
    vi.mocked(api.getMyJourneyTemplates).mockResolvedValue([
      template({
        id: 5,
        originCrs: 'WOK',
        originName: 'Woking',
        destinationCrs: 'WAT',
        destinationName: 'London Waterloo',
        target: { kind: 'depart_after', time: '07:45:00', dayOffset: 0 },
      }),
    ]);
    await renderPage();
    expect(screen.getByRole('link', { name: 'Woking to London Waterloo, leave after 07:45' })).toHaveAttribute(
      'href',
      '/journeys/regular/5',
    );
    expect(screen.queryByText(/1 leg ·/)).not.toBeInTheDocument();
  });

  it('shows a pair as one card with two rows, and skip next and pause for both', async () => {
    const outbound = template({
      id: 5,
      originCrs: 'WOK',
      originName: 'Woking',
      destinationCrs: 'WAT',
      destinationName: 'London Waterloo',
      target: { kind: 'depart_after', time: '07:45:00', dayOffset: 0 },
      pairedTemplateId: 6,
      daysOfWeek: 31,
      nextDate: '2099-01-05',
    });
    const back = template({
      id: 6,
      originCrs: 'WAT',
      originName: 'London Waterloo',
      destinationCrs: 'WOK',
      destinationName: 'Woking',
      target: { kind: 'depart_after', time: '17:30:00', dayOffset: 0 },
      pairedTemplateId: 5,
      daysOfWeek: 31,
      nextDate: '2099-01-05',
    });
    // The list is newest first: the return comes before its outbound.
    vi.mocked(api.getMyJourneyTemplates).mockResolvedValue([back, outbound]);
    const { container } = await renderPage();
    const cards = container.querySelectorAll('[data-regular-pair]');
    expect(cards).toHaveLength(1);
    const rows = screen.getAllByRole('link', { name: /, leave after/ });
    expect(rows.map((link) => link.textContent)).toEqual([
      'Woking to London Waterloo, leave after 07:45',
      'London Waterloo to Woking, leave after 17:30',
    ]);
    expect(screen.getAllByRole('button', { name: 'Skip next' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Pause' })).toHaveLength(1);
  });

  it('offers Resume, not Skip next, for a paused regular journey', async () => {
    vi.mocked(api.getMyJourneyTemplates).mockResolvedValue([
      template({ daysOfWeek: 31, active: false, nextDate: null }),
    ]);
    await renderPage();
    expect(screen.getByRole('button', { name: 'Resume' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Skip next' })).not.toBeInTheDocument();
  });
});
