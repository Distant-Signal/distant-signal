import { describe, it, expect } from 'vitest';
import {
  categoryLabel,
  changesBadge,
  isCrossStationTransfer,
  tocNameLookup,
  operatorLabel,
  operatorNameAndCode,
  transitOperatorName,
  transferLabel,
  transferLegLabel,
  transferLegMode,
  withStationWalks,
} from './displayLabels';
import type { TripPlanItinerary, TripPlanLeg } from './types';
import { ITINERARY_DEFAULTS } from '@/test/apiDefaults';

describe('categoryLabel', () => {
  it('maps a known TOML-enum category to a human label', () => {
    expect(categoryLabel('main-line')).toBe('Main line');
  });

  it('maps a TfL mode-name category to a human label', () => {
    expect(categoryLabel('elizabeth-line')).toBe('Elizabeth line');
  });

  it('maps the custom-line category to a human label', () => {
    expect(categoryLabel('custom')).toBe('Custom line');
  });

  it('falls back to the raw token for an unlisted category', () => {
    expect(categoryLabel('some-future-category')).toBe('some-future-category');
  });

  // Signal Box Audit, flib Low finding: "prototype-key lookups can render a
  // function as a label". `category` is an open-ended string (a TOML
  // category, a TfL mode_name, or "custom") -- a category literally named
  // "constructor" (or another Object.prototype key) used to make
  // `CATEGORY_LABELS[category]` resolve to `Object.prototype.constructor`
  // (a function), which `?? category` would not catch.
  it('falls back to the raw token for a category matching an Object.prototype key, not a function', () => {
    expect(categoryLabel('constructor')).toBe('constructor');
    expect(typeof categoryLabel('constructor')).toBe('string');
    expect(categoryLabel('toString')).toBe('toString');
    expect(categoryLabel('hasOwnProperty')).toBe('hasOwnProperty');
  });
});

describe('operatorLabel', () => {
  it('renders "Name (CODE)" when the code resolves', () => {
    const lookup = tocNameLookup([{ code: 'GR', name: 'London North Eastern Railway' }]);
    expect(operatorLabel('GR', lookup)).toBe('London North Eastern Railway (GR)');
  });

  it('falls back to the bare code when the lookup has no match', () => {
    const lookup = tocNameLookup([{ code: 'GR', name: 'London North Eastern Railway' }]);
    expect(operatorLabel('SW', lookup)).toBe('SW');
  });

  it('falls back to the bare code for every operator when the TOC list is empty', () => {
    const lookup = tocNameLookup([]);
    expect(operatorLabel('SW', lookup)).toBe('SW');
  });
});

describe('operatorNameAndCode', () => {
  it('shows the name with its code in parentheses', () => {
    expect(operatorNameAndCode('West Midlands Railway', 'WM')).toBe('West Midlands Railway (WM)');
  });

  it('shows whichever of the two there is', () => {
    expect(operatorNameAndCode('West Midlands Railway', null)).toBe('West Midlands Railway');
    expect(operatorNameAndCode(undefined, 'WM')).toBe('WM');
  });

  it('is null without either, treating blanks as missing', () => {
    expect(operatorNameAndCode(null, null)).toBeNull();
    expect(operatorNameAndCode('  ', '')).toBeNull();
    expect(operatorNameAndCode(undefined, undefined)).toBeNull();
  });

  it('does not repeat a code the name already carries', () => {
    expect(operatorNameAndCode('Avanti West Coast (VT)', 'VT')).toBe('Avanti West Coast (VT)');
    expect(operatorNameAndCode('VT', 'VT')).toBe('VT');
  });
});

describe('transferLabel', () => {
  it('adds the line where known, saying "line" once for the Tube', () => {
    expect(transferLabel('TUBE', 'Victoria')).toBe('Tube (Victoria line)');
    expect(transferLabel('tube', 'Elizabeth line')).toBe('Tube (Elizabeth line)');
    expect(transferLabel('METRO', 'DLR')).toBe('Metro (DLR)');
  });

  it('is the mode alone without a line', () => {
    expect(transferLabel('TUBE')).toBe('Tube');
    expect(transferLabel('WALK', '  ')).toBe('Walk');
    expect(transferLabel('TUBE', null)).toBe('Tube');
  });
});

describe('transfer legs (#95)', () => {
  const stop = (id: string) => ({ id, name: id, modes: ['tube'], lines: [] });
  const leg = {
    kind: 'transfer' as const,
    mode: 'TRANSFER',
    originCrs: 'EUS',
    destinationCrs: 'VIC',
    minutes: 19,
  };

  it('tells a TRANSFER between stations from a change within one', () => {
    expect(isCrossStationTransfer(leg)).toBe(true);
    expect(isCrossStationTransfer({ ...leg, destinationCrs: 'eus' })).toBe(false);
    expect(isCrossStationTransfer({ ...leg, originCrs: null, destinationCrs: null })).toBe(false);
    expect(isCrossStationTransfer({ ...leg, mode: 'TUBE' })).toBe(false);
  });

  it('reads a known Tube hop as the Tube: run by LT, or a Tube stop at both ends', () => {
    expect(transferLegMode(leg)).toBe('TRANSFER');
    expect(transferLegMode({ ...leg, operator: 'LT' })).toBe('TUBE');
    expect(transferLegMode({ ...leg, originStop: stop('A'), destinationStop: stop('B') })).toBe('TUBE');
    expect(transferLegMode({ ...leg, originStop: stop('A') })).toBe('TRANSFER');
    expect(transferLegMode({ ...leg, operator: 'ds:DLR' })).toBe('TRANSFER');
    // A change within one station stays one, whoever runs the pair's link.
    expect(transferLegMode({ ...leg, destinationCrs: 'EUS', operator: 'LT' })).toBe('TRANSFER');
    expect(transferLegMode({ ...leg, mode: 'WALK', operator: 'LT' })).toBe('WALK');
  });

  it('labels each the way it saves', () => {
    expect(transferLegLabel(leg)).toBe('Transfer');
    expect(transferLegLabel({ ...leg, operator: 'LT', line: 'Victoria' })).toBe('Tube (Victoria line)');
    expect(transferLegLabel({ ...leg, destinationCrs: 'EUS' })).toBe('Change');
    expect(transferLegLabel({ ...leg, mode: 'TUBE', line: 'Northern' })).toBe('Tube (Northern line)');
  });
});

describe('changesBadge', () => {
  const actonTown = { id: '940GZZLUACT', name: 'Acton Town', modes: ['tube'], lines: [] };
  const ride = (mode: string, changes: boolean): TripPlanLeg => ({
    kind: 'transfer',
    mode,
    originCrs: null,
    destinationCrs: null,
    minutes: 60,
    access: { end: 'both', basis: 'line', distanceMetres: 33_000, ...(changes && { changeAt: actonTown }) },
  });
  const itinerary = (legs: TripPlanLeg[], changeCount: number, accessChangeCount?: number): TripPlanItinerary => ({
    ...ITINERARY_DEFAULTS,
    legs,
    changeCount,
    ...(accessChangeCount !== undefined && { accessChangeCount }),
    totalDurationMinutes: 60,
  });

  it("counts National Rail's changes alone as before", () => {
    expect(changesBadge(itinerary([], 0))).toEqual({ total: 0, label: '0 changes' });
    expect(changesBadge(itinerary([], 1, 0))).toEqual({ total: 1, label: '1 change' });
  });

  it("adds a TfL ride's change and says what it is", () => {
    expect(changesBadge(itinerary([ride('TUBE', true)], 0, 1))).toEqual({
      total: 1,
      label: '1 change',
      breakdown: '1 Tube change',
    });
    expect(changesBadge(itinerary([ride('TUBE', true), ride('METRO', true)], 2, 2))).toEqual({
      total: 4,
      label: '4 changes',
      breakdown: '2 train changes, 1 Tube change, 1 Metro change',
    });
  });

  it('falls back to TfL when the legs do not name every change', () => {
    expect(changesBadge(itinerary([ride('TUBE', false)], 0, 1)).breakdown).toBe('1 TfL change');
  });
});

describe('withStationWalks', () => {
  const euston = { id: '940GZZLUEUS', name: 'Euston', modes: ['tube'], lines: [] };
  const victoria = { id: '940GZZLUVIC', name: 'Victoria', modes: ['tube'], lines: [] };
  const hop = {
    kind: 'transfer' as const,
    mode: 'TUBE',
    originCrs: 'EUS',
    destinationCrs: 'VIC',
    minutes: 15,
    originStop: euston,
    destinationStop: victoria,
    stationWalks: { originMinutes: 2, destinationMinutes: 3 },
  };

  it('splits a Tube hop into the walk in, the ride and the walk out', () => {
    const { stationWalks: _walks, ...ride } = hop;
    expect(withStationWalks(hop)).toEqual([
      { kind: 'transfer', mode: 'WALK', originCrs: 'EUS', destinationCrs: null, destinationStop: euston, minutes: 2 },
      { ...ride, minutes: 10 },
      { kind: 'transfer', mode: 'WALK', originCrs: null, originStop: victoria, destinationCrs: 'VIC', minutes: 3 },
    ]);
  });

  it('leaves a leg with no walks, no stops or no time left to ride alone', () => {
    const { stationWalks: _walks, ...plain } = hop;
    expect(withStationWalks(plain)).toEqual([plain]);
    const { originStop: _stop, ...oneStop } = hop;
    expect(withStationWalks(oneStop)).toEqual([oneStop]);
    expect(withStationWalks({ ...hop, minutes: 5 })).toEqual([{ ...hop, minutes: 5 }]);
  });
});

describe('transitOperatorName', () => {
  it('names the four transit operator codes when the list has no entry', () => {
    expect(transitOperatorName('LT', {})).toBe('London Underground');
    expect(transitOperatorName('ds:DLR', {})).toBe('Docklands Light Railway');
    expect(transitOperatorName('ds:LONDON_TRAMS', {})).toBe('London Trams');
    expect(transitOperatorName('ds:METROLINK', {})).toBe('Metrolink');
  });

  it("prefers the list's name", () => {
    expect(transitOperatorName('LT', { LT: 'London Underground Ltd' })).toBe('London Underground Ltd');
  });

  it('is undefined for any other code, including inherited property names', () => {
    expect(transitOperatorName('VT', {})).toBeUndefined();
    expect(transitOperatorName('constructor', {})).toBeUndefined();
  });
});
