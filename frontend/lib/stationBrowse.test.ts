import { describe, expect, it } from 'vitest';
import { groupStations, stationBrowseHref, stationLetters, STATION_LETTER } from './stationBrowse';

const st = (crs: string, name = crs, served = true) => ({ crs, name, served });

describe('stationBrowse', () => {
  it('groups stations by first letter, upper-cased, de-duplicated and sorted by code', () => {
    const groups = groupStations([st('wat', 'London Waterloo'), st('WAT'), st('WOK', 'Woking'), st('AAP'), st('abw')]);
    expect(groups.get('w')).toEqual([st('WAT', 'London Waterloo'), st('WOK', 'Woking')]);
    expect(groups.get('a')?.map((s) => s.crs)).toEqual(['AAP', 'ABW']);
  });

  it('keeps unserved stations, so every station page stays linked', () => {
    expect(groupStations([st('ZZZ', 'Zed', false)]).get('z')).toEqual([st('ZZZ', 'Zed', false)]);
  });

  it('drops anything that is not a three-letter code', () => {
    expect(stationLetters(['8220IR0007', 'AB', 'ABCD', 'A1C', 'EUS'].map((c) => st(c)))).toEqual(['e']);
  });

  it('lists letters A to Z and builds lower-case hrefs', () => {
    expect(stationLetters(['WAT', 'AAP', 'KGX'].map((c) => st(c)))).toEqual(['a', 'k', 'w']);
    expect(stationBrowseHref('K')).toBe('/stations/k');
    expect(STATION_LETTER.test('k')).toBe(true);
    expect(STATION_LETTER.test('kk')).toBe(false);
    expect(STATION_LETTER.test('K')).toBe(false);
  });
});
