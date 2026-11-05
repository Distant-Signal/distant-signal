import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { cleanup, screen, within } from '@testing-library/react';
import { renderWithMantine } from '@/test/render';
import * as legal from '@/lib/legal';
import {
  CC_BY_4_URL,
  DATA_SOURCES,
  NON_AFFILIATION_STATEMENT,
  NRIL_LICENCE_URL,
  NRIL_STATEMENT,
  OGL_V3_URL,
  OpenDataAttribution,
  OpenDataAttributionDetails,
  TFL_TERMS_URL,
} from './OpenDataAttribution';
import { NATIONAL_RAIL_URL, NationalRailCredit } from './NationalRailCredit';
import { ATTRIBUTION_SOURCES, NON_AFFILIATION } from '@/lib/api-types';
import { visibleText } from '@/test/routeText';
import { SOURCE_CODE_URL } from '@/lib/sourceCode';

vi.mock('@/lib/legal', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/legal')>();
  return { ...actual, legalPagesVisible: vi.fn(actual.legalPagesVisible) };
});

afterEach(() => {
  vi.mocked(legal.legalPagesVisible).mockReset();
  delete process.env.LEGAL_PAGES_PUBLISHED;
  delete process.env.LEGAL_PAGES_PREVIEW;
});

describe('OpenDataAttribution', () => {
  it('carries no data credit lines: each source is credited beside its data (DataCredits)', () => {
    const { container } = renderWithMantine(<OpenDataAttribution />);
    const footer = container.querySelector('footer') as HTMLElement;
    for (const credit of [
      'Powered by TfL Open Data',
      'powered by NationalRail',
      'Train Information Services Ltd',
      NRIL_STATEMENT,
      'Contains public sector information',
      'RSP',
      'National Transport Authority',
      'OpenDataNI',
    ]) {
      expect(visibleText(footer)).not.toContain(credit);
    }
  });

  it('keeps the non-affiliation note (LEG-25)', () => {
    renderWithMantine(<OpenDataAttribution />);
    expect(screen.getByText('Independent and unofficial.')).toBeInTheDocument();
  });

  it('is a landmark, so it is reachable rather than just visible', () => {
    const { container } = renderWithMantine(<OpenDataAttribution />);
    expect(container.querySelector('footer')).not.toBeNull();
  });

  it('links to the /attribution page from a labelled footer nav', () => {
    renderWithMantine(<OpenDataAttribution />);
    const nav = screen.getByRole('navigation', { name: 'Site information' });
    expect(within(nav).getByRole('link', { name: 'Data sources and licences' })).toHaveAttribute(
      'href',
      '/attribution',
    );
    expect(within(nav).getByRole('link', { name: 'Preferences' })).toHaveAttribute('href', '/account/preferences');
  });

  it('links to the source code from every page (AGPL-3.0 section 13)', () => {
    renderWithMantine(<OpenDataAttribution />);
    const nav = screen.getByRole('navigation', { name: 'Site information' });
    const link = within(nav).getByRole('link', { name: 'Source code (opens in a new tab)' });
    expect(link).toHaveAttribute('href', SOURCE_CODE_URL);
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('links to the developer pages', () => {
    renderWithMantine(<OpenDataAttribution />);
    const nav = screen.getByRole('navigation', { name: 'Site information' });
    expect(within(nav).getByRole('link', { name: 'Developers' })).toHaveAttribute('href', '/developers');
  });

  it('hides the legal page links while the legal pages are unpublished (the default)', () => {
    renderWithMantine(<OpenDataAttribution />);
    for (const name of ['Privacy', 'Terms', 'Cookies', 'Contact', 'Accessibility']) {
      expect(screen.queryByRole('link', { name })).toBeNull();
    }
  });

  it('keeps the legal links hidden when the flag is on but placeholders remain', () => {
    process.env.LEGAL_PAGES_PUBLISHED = 'true';
    renderWithMantine(<OpenDataAttribution />);
    expect(screen.queryByRole('link', { name: 'Privacy' })).toBeNull();
  });

  it('shows the legal page links in preview mode, so reviewers can reach the drafts', () => {
    process.env.LEGAL_PAGES_PREVIEW = 'true';
    renderWithMantine(<OpenDataAttribution />);
    expect(screen.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy');
  });

  it('shows the legal page links once the legal pages are published', () => {
    vi.mocked(legal.legalPagesVisible).mockReturnValue(true);
    renderWithMantine(<OpenDataAttribution />);
    const links: [name: string, href: string][] = [
      ['Privacy', '/privacy'],
      ['Terms', '/terms'],
      ['Cookies', '/cookies'],
      ['Contact', '/contact'],
      ['Accessibility', '/accessibility'],
    ];
    for (const [name, href] of links) {
      expect(screen.getByRole('link', { name })).toHaveAttribute('href', href);
    }
  });
});

describe('OpenDataAttributionDetails (/attribution)', () => {
  const statementOf = (id: string) => {
    const heading = document.getElementById(`source-${id}`);
    expect(heading).not.toBeNull();
    const section = heading!.closest('section')!;
    return section.querySelector('[data-attribution-statement]') as HTMLElement;
  };

  it('gives every data source a heading and a statement', () => {
    renderWithMantine(<OpenDataAttributionDetails />);
    for (const source of DATA_SOURCES) {
      expect(screen.getByRole('heading', { level: 2, name: source.title })).toBeInTheDocument();
      expect(statementOf(source.id).textContent).not.toBe('');
    }
  });

  it('carries the TfL and National Rail wording verbatim', () => {
    renderWithMantine(<OpenDataAttributionDetails />);
    expect(visibleText(statementOf('tfl') as Element)).toMatch(
      /^Powered by TfL Open Data\. Contains OS data © Crown copyright and database rights 2016\. Geomni UK Map data © and database rights 2019\.$/,
    );
    expect(visibleText(statementOf('national-rail') as Element)).toMatch(
      /^powered by NationalRail \(Train Information Services Ltd\)$/,
    );
  });

  it('carries the prescribed NRIL statement, linked to the licence', () => {
    renderWithMantine(<OpenDataAttributionDetails />);
    const link = within(statementOf('network-rail')).getByRole('link', {
      name: `${NRIL_STATEMENT} (opens in a new tab)`,
    });
    expect(link).toHaveAttribute('href', NRIL_LICENCE_URL);
  });

  it('credits the delay attribution glossary under the OGL', () => {
    renderWithMantine(<OpenDataAttributionDetails />);
    const statement = statementOf('network-rail-delay-attribution');
    expect(visibleText(statement as Element)).toMatch(/^Contains information of Network Rail Infrastructure Limited/);
    expect(
      within(statement).getByRole('link', { name: 'Open Government Licence v3.0 (opens in a new tab)' }),
    ).toHaveAttribute('href', OGL_V3_URL);
  });

  it('credits the CORPUS location codes under the OGL', () => {
    renderWithMantine(<OpenDataAttributionDetails />);
    const statement = statementOf('network-rail-corpus');
    expect(visibleText(statement as Element)).toMatch(/^Contains information of Network Rail Infrastructure Limited/);
    expect(
      within(statement).getByRole('link', { name: 'Open Government Licence v3.0 (opens in a new tab)' }),
    ).toHaveAttribute('href', OGL_V3_URL);
  });

  it('credits the CIF timetable as "Source: RSP" with a Rail Delivery Group link', () => {
    renderWithMantine(<OpenDataAttributionDetails />);
    const statement = statementOf('rsp-timetable');
    expect(visibleText(statement as Element)).toMatch(/^Source: RSP/);
    expect(within(statement).getByRole('link', { name: 'Rail Delivery Group (opens in a new tab)' })).toHaveAttribute(
      'href',
      'https://www.raildeliverygroup.com',
    );
  });

  it("meets CC BY 4.0 for the NTA's Irish Rail GTFS: provider name, licence link and 'as is'", () => {
    renderWithMantine(<OpenDataAttributionDetails />);
    const statement = statementOf('nta-gtfs');
    expect(
      within(statement).getByRole('link', { name: 'National Transport Authority (opens in a new tab)' }),
    ).toBeInTheDocument();
    expect(within(statement).getByRole('link', { name: 'CC BY 4.0 (opens in a new tab)' })).toHaveAttribute(
      'href',
      CC_BY_4_URL,
    );
    expect(visibleText(statement as Element)).toMatch('provided "as is"');
  });

  it('uses the OGL v3 statement for Translink data from OpenDataNI', () => {
    renderWithMantine(<OpenDataAttributionDetails />);
    const statement = statementOf('opendatani');
    expect(visibleText(statement as Element)).toMatch(
      'Contains public sector information licensed under the Open Government Licence v3.0.',
    );
    expect(
      within(statement).getByRole('link', { name: 'Open Government Licence v3.0 (opens in a new tab)' }),
    ).toHaveAttribute('href', OGL_V3_URL);
    expect(visibleText(statement as Element)).toMatch('Translink data from OpenDataNI');
  });

  it('credits Iarnród Éireann and railwaycodes.org.uk', () => {
    renderWithMantine(<OpenDataAttributionDetails />);
    expect(visibleText(statementOf('irish-rail-realtime') as Element)).toMatch('Iarnród Éireann');
    expect(visibleText(statementOf('railwaycodes') as Element)).toMatch('railwaycodes.org.uk');
  });

  it('credits the TfL timetables only while the TfL network is shown', () => {
    renderWithMantine(<OpenDataAttributionDetails />);
    expect(document.getElementById('source-tfl-timetables')).toBeNull();
    cleanup();
    renderWithMantine(<OpenDataAttributionDetails transitNetworks={['tfl']} />);
    expect(visibleText(statementOf('tfl-timetables') as Element)).toMatch(
      "Transport for London's journey planner timetables",
    );
    // TfL's own credit stays, once.
    expect(visibleText(statementOf('tfl') as Element)).toMatch('Powered by TfL Open Data');
  });

  it('states that the service is unofficial and unaffiliated', () => {
    renderWithMantine(<OpenDataAttributionDetails />);
    expect(screen.getByText(NON_AFFILIATION_STATEMENT)).toBeInTheDocument();
  });

  it('opens every external link in a new tab without an opener', () => {
    const { container } = renderWithMantine(<OpenDataAttributionDetails />);
    for (const a of container.querySelectorAll('a[href^="http"]')) {
      expect(a).toHaveAttribute('target', '_blank');
      expect(a).toHaveAttribute('rel', 'noopener noreferrer');
    }
  });
});

/** The api's personal-token responses credit their sources in the
 * website's own words (personal API tokens spec §5.2). It exports them as
 * `ATTRIBUTION_SOURCES` and `NON_AFFILIATION` in the generated
 * `lib/api-types.ts` (crates/api/src/api_types.rs); this checks the site
 * still says the same. */
describe("the api's attribution", () => {
  it('uses the same statements and licence links', () => {
    expect(NRIL_STATEMENT).toBe(ATTRIBUTION_SOURCES.networkRail.notice);
    expect(NRIL_LICENCE_URL).toBe(ATTRIBUTION_SOURCES.networkRail.url);
    expect(TFL_TERMS_URL).toBe(ATTRIBUTION_SOURCES.tfl.url);
    expect(NATIONAL_RAIL_URL).toBe(ATTRIBUTION_SOURCES.nationalRail.url);
    expect(NON_AFFILIATION_STATEMENT).toBe(NON_AFFILIATION);
  });

  it('shows each notice the api sends', () => {
    const { container } = renderWithMantine(
      <>
        <OpenDataAttribution />
        <OpenDataAttributionDetails />
        <NationalRailCredit />
      </>,
    );
    const text = visibleText(container);
    const { railDeliveryGroup, ...prescribed } = ATTRIBUTION_SOURCES;
    for (const source of Object.values(prescribed)) {
      expect(text).toContain(source.notice);
    }
    // Knowledgebase incidents have no prescribed wording: the api names
    // the publisher in its own sentence, and the site credits it by name.
    expect(text).toContain(railDeliveryGroup.name);
    expect(text).toContain(NON_AFFILIATION);
  });
});

/** railwaycodes.org.uk is credited only because the line-catalogue
 * validator's live tier scrapes it. The validator says whether it does in
 * crates/line-catalogue-validator/site-credits.json (checked against its
 * scrape by its own test), and the credit must exist exactly while it
 * does. The validator is ds-core's (repo-split spec, phase 4): this reads
 * the copy scripts/sync-core.py vendors from the pinned release
 * (lib/site-credits.json, signed release asset, CI checks it). */
describe("the line-catalogue validator's credits", () => {
  const credits = JSON.parse(readFileSync('lib/site-credits.json', 'utf8')) as Record<string, boolean>;

  it.each(Object.entries(credits))('lists %s on /attribution exactly while the validator needs it', (id, needed) => {
    expect(DATA_SOURCES.some((source) => source.id === id)).toBe(needed);
  });
});
