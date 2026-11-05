import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithMantine } from '@/test/render';
import { visibleText } from '@/test/routeText';
import { ATTRIBUTION_SOURCES } from '@/lib/api-types';
import {
  CREDITS,
  DataCredits,
  journeyCredits,
  KNOWLEDGEBASE_INCIDENTS_STATEMENT,
  lineCredits,
  NATIONAL_RAIL_STATEMENT,
  NRIL_LICENCE_URL,
  NRIL_STATEMENT,
  RSP_STATEMENT,
  TRAIN_CREDITS,
  type CreditId,
} from './DataCredits';
import { DATA_SOURCES } from './OpenDataAttribution';
import { NATIONAL_RAIL_URL } from './NationalRailCredit';

function rendered(): string[] {
  return [...document.querySelectorAll('[data-credit]')].map((node) => node.getAttribute('data-credit') ?? '');
}

function creditText(id: CreditId): string {
  return visibleText(document.querySelector(`[data-credit="${id}"]`) as Element);
}

describe('DataCredits', () => {
  it('renders each credit once, in order, then links the full credits', () => {
    renderWithMantine(<DataCredits credits={['tfl', 'national-rail', false, 'tfl', null]} />);
    expect(rendered()).toEqual(['tfl', 'national-rail']);
    expect(screen.getByRole('link', { name: 'Data credits' })).toHaveAttribute('href', '/attribution');
  });

  it('renders nothing for no credits', () => {
    const { container } = renderWithMantine(<DataCredits credits={[]} />);
    expect(container.querySelector('[data-data-credits]')).toBeNull();
  });

  it("carries TfL's required wording verbatim, and the mapping statements with its stops", () => {
    // TfL's modified OGL v2.0 requires this exact phrase wherever its open
    // data is presented. Reworded, it stops being attribution.
    renderWithMantine(<DataCredits credits={['tfl', 'tfl-stops']} />);
    expect(creditText('tfl')).toBe('Powered by TfL Open Data');
    expect(creditText('tfl-stops')).toBe(
      'Powered by TfL Open Data. Contains OS data © Crown copyright and database rights 2016. Geomni UK Map data © and database rights 2019.',
    );
  });

  it("carries Darwin's and Knowledgebase Stations' wordings verbatim, linking only Darwin's", () => {
    // Each feed's Schedule 1 §8 fixes its string (lowercase "powered", one
    // word "NationalRail"): docs/superpowers/plans/2026-09-01-rdm-attribution-wording.md.
    // They share "NationalRail", so one line keeps both intact.
    renderWithMantine(<DataCredits credits={['national-rail']} />);
    expect(creditText('national-rail')).toBe(NATIONAL_RAIL_STATEMENT);
    expect(NATIONAL_RAIL_STATEMENT).toContain('powered by NationalRail');
    expect(NATIONAL_RAIL_STATEMENT).toContain('NationalRail (Train Information Services Ltd)');
    const link = screen.getByRole('link', { name: 'powered by NationalRail (opens in a new tab)' });
    expect(link).toHaveAttribute('href', NATIONAL_RAIL_URL);
    expect(visibleText(link)).toBe('powered by NationalRail');
  });

  it("carries Network Rail's prescribed statement verbatim, linked to the licence (LEG-19)", () => {
    renderWithMantine(<DataCredits credits={['network-rail']} />);
    const link = screen.getByRole('link', { name: `${NRIL_STATEMENT} (opens in a new tab)` });
    expect(link).toHaveAttribute('href', NRIL_LICENCE_URL);
    expect(NRIL_STATEMENT).toBe(
      'Contains Information of Network Rail Infrastructure Limited licensed under the following licence',
    );
  });

  it('credits the timetable as "Source: RSP" with a Rail Delivery Group link (LEG-22)', () => {
    renderWithMantine(<DataCredits credits={['rsp-timetable']} />);
    expect(creditText('rsp-timetable')).toBe(`${RSP_STATEMENT} (Rail Delivery Group)`);
    expect(screen.getByRole('link', { name: 'Rail Delivery Group (opens in a new tab)' })).toHaveAttribute(
      'href',
      'https://www.raildeliverygroup.com',
    );
  });

  it('names Rail Delivery Group for Knowledgebase incidents, as the api does', () => {
    renderWithMantine(<DataCredits credits={['knowledgebase-incidents']} />);
    expect(creditText('knowledgebase-incidents')).toBe(KNOWLEDGEBASE_INCIDENTS_STATEMENT);
    expect(KNOWLEDGEBASE_INCIDENTS_STATEMENT).toBe(`${ATTRIBUTION_SOURCES.railDeliveryGroup.notice}.`);
  });

  it('renders credit links as TextLinks that keep the dimmed colour, underlined, in a new tab', () => {
    renderWithMantine(<DataCredits credits={['national-rail', 'network-rail', 'rsp-timetable']} />);
    for (const name of [
      'powered by NationalRail (opens in a new tab)',
      `${NRIL_STATEMENT} (opens in a new tab)`,
      'Rail Delivery Group (opens in a new tab)',
    ]) {
      const link = screen.getByRole('link', { name });
      expect(link).toHaveAttribute('data-text-link', 'always');
      expect(link).toHaveAttribute('data-text-link-tone', 'inherit');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      expect(link.querySelector('svg[data-icon="external-link"]')).toHaveAttribute('aria-hidden', 'true');
    }
  });

  it("uses /attribution's statements, so the two can't drift", () => {
    for (const source of DATA_SOURCES) {
      if (source.id in CREDITS && source.id !== 'tfl') {
        expect(source.statement, source.id).toBe(CREDITS[source.id as CreditId]);
      }
    }
    expect(DATA_SOURCES.find((source) => source.id === 'tfl')?.statement).toBe(CREDITS['tfl-stops']);
  });
});

describe('lineCredits', () => {
  it('credits TfL for a TfL line, Darwin and TRUST for any other, and nothing for no lines', () => {
    expect(lineCredits(['tfl-victoria'])).toEqual(['tfl']);
    expect(lineCredits(['brighton-main-line', 'custom-12'])).toEqual(['national-rail', 'network-rail']);
    expect(lineCredits(['tfl-victoria', 'brighton-main-line'])).toEqual(['national-rail', 'network-rail', 'tfl']);
    expect(lineCredits([])).toEqual([]);
  });
});

describe('journeyCredits', () => {
  it("credits a journey's trains, and TfL's stops only when a leg uses one", () => {
    expect(journeyCredits([{ kind: 'train' }])).toEqual([...TRAIN_CREDITS]);
    expect(journeyCredits([{ kind: 'untracked', originStopId: null, destinationStopId: null }])).toEqual([
      ...TRAIN_CREDITS,
    ]);
    expect(journeyCredits([{ kind: 'untracked', originStopId: '940GZZLURSQ', destinationStopId: null }])).toEqual([
      ...TRAIN_CREDITS,
      'tfl-stops',
    ]);
  });
});
