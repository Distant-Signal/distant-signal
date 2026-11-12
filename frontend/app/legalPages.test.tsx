import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import { notFound } from 'next/navigation';
import { renderWithMantine } from '@/test/render';
import * as legal from '@/lib/legal';
import PrivacyPage, { dynamic as privacyDynamic, generateMetadata as PrivacyGenerateMetadata } from './privacy/page';
import TermsPage, { dynamic as termsDynamic } from './terms/page';
import CookiesPage, { dynamic as cookiesDynamic } from './cookies/page';
import ContactPage, { dynamic as contactDynamic } from './contact/page';
import AccessibilityPage, { dynamic as accessibilityDynamic } from './accessibility/page';
import AttributionPage, { dynamic as attributionDynamic } from './attribution/page';
import * as api from '@/lib/api';
import type { TransitNetwork } from '@/lib/types';
import { SOURCE_CODE_URL } from '@/lib/sourceCode';

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return { ...actual, getTransitNetworks: vi.fn() };
});

// Real Next throws from notFound(); mirror that so an unpublished page never
// renders past the gate.
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

vi.mock('@/lib/legal', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/legal')>();
  return { ...actual, legalPagesMode: vi.fn(() => 'off'), legalPagesPublished: vi.fn(() => false) };
});

const PAGES = [
  ['/privacy', PrivacyPage, privacyDynamic, 'Privacy notice'],
  ['/terms', TermsPage, termsDynamic, 'Terms of use'],
  ['/cookies', CookiesPage, cookiesDynamic, 'Cookies and browser storage'],
  ['/contact', ContactPage, contactDynamic, 'Contact'],
  ['/accessibility', AccessibilityPage, accessibilityDynamic, 'Accessibility statement'],
] as const;

afterEach(() => {
  vi.mocked(legal.legalPagesMode).mockReturnValue('off');
  vi.mocked(legal.legalPagesPublished).mockReturnValue(false);
  vi.mocked(notFound).mockClear();
});

describe('draft legal pages', () => {
  it.each(PAGES)('%s 404s while the legal pages are unpublished', (_path, Page) => {
    expect(() => Page()).toThrow('NEXT_NOT_FOUND');
    expect(notFound).toHaveBeenCalled();
  });

  it.each(PAGES)('%s renders per request, so the runtime flag is read', (_path, _Page, dynamic) => {
    expect(dynamic).toBe('force-dynamic');
  });

  it.each(PAGES)('%s renders its heading once published', (_path, Page, _dynamic, heading) => {
    vi.mocked(legal.legalPagesMode).mockReturnValue('published');
    renderWithMantine(Page());
    expect(screen.getByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
    expect(notFound).not.toHaveBeenCalled();
  });

  it.each(PAGES)('%s shows a draft banner in preview mode, and none once published', (_path, Page) => {
    vi.mocked(legal.legalPagesMode).mockReturnValue('preview');
    const preview = renderWithMantine(Page());
    expect(preview.container.querySelector('[data-legal-draft]')).toHaveTextContent('Draft, not yet published');
    preview.unmount();
    vi.mocked(legal.legalPagesMode).mockReturnValue('published');
    const live = renderWithMantine(Page());
    expect(live.container.querySelector('[data-legal-draft]')).toBeNull();
  });

  it('marks the pages noindex while they are not really published', () => {
    expect(PrivacyGenerateMetadata().robots).toEqual({ index: false, follow: false });
  });

  it('points privacy rights at the account export and deletion features', () => {
    vi.mocked(legal.legalPagesMode).mockReturnValue('published');
    renderWithMantine(PrivacyPage());
    expect(screen.getByText(legal.ACCOUNT_EXPORT_LABEL)).toBeInTheDocument();
    expect(screen.getByText(legal.ACCOUNT_DELETE_LABEL)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'account page' })).toHaveAttribute('href', legal.ACCOUNT_ROUTE);
    expect(screen.getByText(/0303 123 1113/)).toBeInTheDocument();
  });

  it('lists the Anthropic key as stored locally at the user’s choice', () => {
    vi.mocked(legal.legalPagesMode).mockReturnValue('published');
    renderWithMantine(CookiesPage());
    expect(screen.getByText('ds-anthropic-api-key')).toBeInTheDocument();
    expect(screen.getByText(/stored in your browser at your choice and never sent to us/)).toBeInTheDocument();
    expect(screen.getByText('distant_signal_session')).toBeInTheDocument();
  });

  it('offers the usage-counts opt-in on the cookies page and lists its browser storage (DS-190)', () => {
    vi.mocked(legal.legalPagesMode).mockReturnValue('published');
    renderWithMantine(CookiesPage());
    expect(screen.getByRole('heading', { level: 2, name: 'Usage counts' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Help improve Distant Signal' })).not.toBeChecked();
    expect(screen.getByText('ds-analytics-opt-in')).toBeInTheDocument();
    expect(screen.getByText('ds-analytics-offline-pending')).toBeInTheDocument();
    expect(screen.queryByText(/We do not use analytics/)).toBeNull();
  });

  it('discloses the feature counts and the opt-in usage counts, and keeps server logs 31 days (DS-190)', () => {
    vi.mocked(legal.legalPagesMode).mockReturnValue('published');
    renderWithMantine(PrivacyPage());
    expect(screen.getByRole('heading', { level: 3, name: 'Feature counts' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 3, name: 'Usage counts (only if you turn them on)' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/To object, email us/)).toBeInTheDocument();
    expect(screen.getByText(/Daily totals are kept for 13 months/)).toBeInTheDocument();
    expect(screen.getByText(/Global Privacy Control or Do Not Track, nothing is sent/)).toBeInTheDocument();
    expect(screen.getByText(/Our server logs are kept for up to 31 days/)).toBeInTheDocument();
    expect(screen.queryByText(/rotated within days/)).toBeNull();
  });

  it('states the right to complain to us, the right to object, withdrawing consent and the response times (DS-465)', () => {
    vi.mocked(legal.legalPagesMode).mockReturnValue('published');
    renderWithMantine(PrivacyPage());
    expect(screen.getByRole('heading', { level: 2, name: 'Complaints' })).toBeInTheDocument();
    expect(screen.getByText(/We acknowledge every complaint within 30 days/)).toBeInTheDocument();
    expect(screen.getByText(/whether or not you have complained to us first/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Your right to object' })).toBeInTheDocument();
    expect(screen.getByText(/You can withdraw this consent at any time with the same switch/)).toBeInTheDocument();
    expect(screen.getByText(/the law lets us take up to two more months/)).toBeInTheDocument();
  });

  it('says where the servers are and that the data is transferred to the EU (DS-465)', () => {
    vi.mocked(legal.legalPagesMode).mockReturnValue('published');
    renderWithMantine(PrivacyPage());
    expect(screen.getByText(/currently in Vienna, Austria/)).toBeInTheDocument();
    expect(screen.getByText(/our backups are stored in Germany, which is also in the EU/)).toBeInTheDocument();
    expect(screen.getByText(/Hetzner \(backup storage, Germany\)/)).toBeInTheDocument();
    expect(screen.queryByText(/may process data in the United States/)).toBeNull();
  });

  it('does not say backups run on infrastructure we operate (DS-465)', () => {
    vi.mocked(legal.legalPagesMode).mockReturnValue('published');
    renderWithMantine(PrivacyPage());
    expect(
      screen.getByText(/Our login service and database run on infrastructure we operate ourselves/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/backups are encrypted on our servers before they are sent to Hetzner/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/database and backups all run on/)).toBeNull();
  });

  it('keeps a deleted journey in Recently deleted and says how long backups add (DS-465)', () => {
    vi.mocked(legal.legalPagesMode).mockReturnValue('published');
    renderWithMantine(PrivacyPage());
    expect(screen.getByText(/kept in Recently deleted for 7 days so you can save it again/)).toBeInTheDocument();
    expect(screen.getByText(/in a backup for up to 21 days after you delete it/)).toBeInTheDocument();
  });

  it('lists the device label for push subscriptions (DS-465)', () => {
    vi.mocked(legal.legalPagesMode).mockReturnValue('published');
    renderWithMantine(PrivacyPage());
    expect(screen.getByText(/a short label for the device worked out from your browser/)).toBeInTheDocument();
  });

  it('has a changes clause and the enforceable liability wording in the terms (DS-465)', () => {
    vi.mocked(legal.legalPagesMode).mockReturnValue('published');
    renderWithMantine(TermsPage());
    expect(screen.getByRole('heading', { level: 2, name: 'Changes to these terms' })).toBeInTheDocument();
    expect(screen.getByText(/nothing in them takes away rights the law gives you/)).toBeInTheDocument();
  });

  it('uses log in and log out wording and the 15 minute login cookie on the cookies page (DS-465)', () => {
    vi.mocked(legal.legalPagesMode).mockReturnValue('published');
    renderWithMantine(CookiesPage());
    expect(screen.queryByText(/signed out|sign out/i)).toBeNull();
    expect(screen.getByText('How long: 15 minutes.')).toBeInTheDocument();
  });

  it('gives a content reporting route in the terms (Online Safety Act)', () => {
    vi.mocked(legal.legalPagesMode).mockReturnValue('published');
    renderWithMantine(TermsPage());
    expect(screen.getByRole('heading', { level: 2, name: 'Reporting content and complaints' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: legal.LEGAL_CONFIG.CONTACT_EMAIL }).length).toBeGreaterThan(0);
  });
});

describe('privacy notice ICO registration line', () => {
  afterEach(() => {
    delete legal.LEGAL_CONFIG.ICO_REGISTRATION;
  });

  it('is absent when unset', () => {
    vi.mocked(legal.legalPagesMode).mockReturnValue('published');
    renderWithMantine(PrivacyPage());
    expect(screen.queryByText(/ICO registration/)).not.toBeInTheDocument();
  });

  it('is shown when set', () => {
    vi.mocked(legal.legalPagesMode).mockReturnValue('published');
    legal.LEGAL_CONFIG.ICO_REGISTRATION = 'ZA123456';
    renderWithMantine(PrivacyPage());
    expect(screen.getByText('ICO registration: ZA123456.')).toBeInTheDocument();
  });
});

describe('/attribution', () => {
  it('renders per request, so its footer reads the runtime legal-pages flag', () => {
    expect(attributionDynamic).toBe('force-dynamic');
  });

  it('is always public, whatever the legal pages flag says', async () => {
    vi.mocked(api.getTransitNetworks).mockResolvedValue([]);
    renderWithMantine(await AttributionPage());
    expect(screen.getByRole('heading', { level: 1, name: 'Data sources and licences' })).toBeInTheDocument();
    expect(notFound).not.toHaveBeenCalled();
    // No tram network shown: no Metrolink credit.
    expect(screen.queryByRole('heading', { name: /Manchester Metrolink/ })).toBeNull();
  });

  it('names the software licence and links the source and the running versions', async () => {
    vi.mocked(api.getTransitNetworks).mockResolvedValue([]);
    renderWithMantine(await AttributionPage());
    const section = screen.getByRole('region', { name: 'Source code' });
    expect(
      within(section).getByRole('link', {
        name: 'GNU Affero General Public License v3.0 or later (opens in a new tab)',
      }),
    ).toHaveAttribute('href', 'https://www.gnu.org/licenses/agpl-3.0.html');
    expect(within(section).getByRole('link', { name: 'its source code (opens in a new tab)' })).toHaveAttribute(
      'href',
      SOURCE_CODE_URL,
    );
    expect(within(section).getByRole('link', { name: 'list of running versions' })).toHaveAttribute(
      'href',
      '/api/version',
    );
  });

  it('credits a tram network while it is shown, with the non-affiliation line', async () => {
    vi.mocked(api.getTransitNetworks).mockResolvedValue([{ id: 'metrolink' } as TransitNetwork]);
    renderWithMantine(await AttributionPage());
    expect(
      screen.getByRole('heading', { name: 'Manchester Metrolink (Bus Open Data Service and NaPTAN)' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Distant Signal is not affiliated with TfGM/)).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /Bus Open Data Service/ }).length).toBeGreaterThan(0);
  });

  it('credits Nottingham Express Transit to the Traveline National Dataset, only while it is shown', async () => {
    vi.mocked(api.getTransitNetworks).mockResolvedValue([{ id: 'net' } as TransitNetwork]);
    renderWithMantine(await AttributionPage());
    expect(
      screen.getByRole('heading', { name: 'Nottingham Express Transit (Traveline National Dataset and NaPTAN)' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Distant Signal is not affiliated with Nottingham Express Transit/)).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /Traveline National Dataset/ }).length).toBeGreaterThan(0);
    // Metrolink's credit is not shown with only NET on, nor BODS.
    expect(screen.queryByRole('heading', { name: /Manchester Metrolink/ })).toBeNull();
    expect(screen.queryByRole('link', { name: /Bus Open Data Service/ })).toBeNull();
  });
});
