import { describe, expect, it } from 'vitest';
import { groupStationCodes, stationBrowseHref, stationLetters, STATION_LETTER } from './stationBrowse';

describe('stationBrowse', () => {
  it('groups codes by first letter, upper-cased, de-duplicated and sorted', () => {
    const groups = groupStationCodes(['wat', 'WAT', 'WOK', 'AAP', 'abw']);
    expect(groups.get('w')).toEqual(['WAT', 'WOK']);
    expect(groups.get('a')).toEqual(['AAP', 'ABW']);
  });

  it('drops anything that is not a three-letter code', () => {
    expect(stationLetters(['8220IR0007', 'AB', 'ABCD', 'A1C', 'EUS'])).toEqual(['e']);
  });

  it('lists letters A to Z and builds lower-case hrefs', () => {
    expect(stationLetters(['WAT', 'AAP', 'KGX'])).toEqual(['a', 'k', 'w']);
    expect(stationBrowseHref('K')).toBe('/stations/k');
    expect(STATION_LETTER.test('k')).toBe(true);
    expect(STATION_LETTER.test('kk')).toBe(false);
    expect(STATION_LETTER.test('K')).toBe(false);
  });
});
