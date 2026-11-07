import { describe, expect, it } from 'vitest';
import { recentRoutes, savedRoutes } from './routeShortcuts';
import { JOURNEY_LIST_ITEM_DEFAULTS, TEMPLATE_TARGET_DEFAULTS } from '@/test/apiDefaults';
import type { JourneyListItem, JourneyTemplateListItem, SharedVia } from './types';

function template(id: number, overrides: Partial<JourneyTemplateListItem> = {}): JourneyTemplateListItem {
  return {
    ...TEMPLATE_TARGET_DEFAULTS,
    id,
    customName: null,
    createdAt: '2026-11-01T00:00:00Z',
    legCount: 1,
    firstOriginCrs: 'WOK',
    firstOriginName: 'Woking',
    lastDestinationCrs: 'WAT',
    lastDestinationName: 'London Waterloo',
    active: true,
    daysOfWeek: null,
    defaultMatchMode: 'manual',
    nextRunOn: null,
    hasOpenLegs: false,
    startsOn: null,
    endsOn: null,
    ...overrides,
  };
}

function journey(id: number, createdAt: string, overrides: Partial<JourneyListItem> = {}): JourneyListItem {
  return {
    ...JOURNEY_LIST_ITEM_DEFAULTS,
    id,
    legId: id,
    originCrs: 'WOK',
    destinationCrs: 'WAT',
    serviceDate: '2026-11-01',
    firstServiceDate: '2026-11-01',
    createdAt,
    firstOriginCrs: 'WOK',
    firstOriginName: 'Woking',
    lastDestinationCrs: 'WAT',
    lastDestinationName: 'London Waterloo',
    ...overrides,
  };
}

describe('savedRoutes', () => {
  it('lists regular journeys with no days, in order, by name or route', () => {
    const routes = savedRoutes([
      template(1, { customName: ' Office ' }),
      template(2, { daysOfWeek: 31 }),
      template(3, { originCrs: 'GLD', originName: 'Guildford', destinationCrs: 'WAT', destinationName: null }),
      template(4, { firstOriginCrs: null }),
    ]);
    expect(routes).toEqual([
      { key: 'saved-1', label: 'Office', originCrs: 'WOK', destinationCrs: 'WAT' },
      { key: 'saved-3', label: 'Guildford to London Waterloo', originCrs: 'GLD', destinationCrs: 'WAT' },
    ]);
    expect(savedRoutes(null)).toEqual([]);
  });
});

describe('recentRoutes', () => {
  it('lists the newest distinct routes first, leaving out Irish trains and journeys not theirs', () => {
    const routes = recentRoutes([
      journey(1, '2026-11-01T08:00:00Z'),
      journey(2, '2026-11-03T08:00:00Z', {
        firstOriginCrs: 'GLD',
        firstOriginName: 'Guildford',
        lastDestinationCrs: 'WOK',
        lastDestinationName: 'Woking',
      }),
      journey(3, '2026-11-02T08:00:00Z'),
      journey(4, '2026-11-04T08:00:00Z', { irishTrain: {} as JourneyListItem['irishTrain'] }),
      journey(5, '2026-11-05T08:00:00Z', { sharedVia: [] as SharedVia[] }),
    ]);
    expect(routes.map((route) => route.label)).toEqual(['Guildford to Woking', 'Woking to London Waterloo']);
  });

  it('keeps at most five', () => {
    const many = Array.from({ length: 8 }, (_, index) =>
      journey(index, `2026-11-0${index + 1}T08:00:00Z`, { lastDestinationCrs: `ZZ${String.fromCharCode(65 + index)}` }),
    );
    expect(recentRoutes(many)).toHaveLength(5);
  });
});
