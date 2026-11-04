import { describe, expect, it } from 'vitest';
import {
  BANGOR,
  BELFAST,
  CONNOLLY,
  DEPARTURES,
  DROGHEDA,
  DROGHEDA_LINE,
  ENTERPRISE,
  HOLYWOOD,
  LINES,
  STATIONS,
} from '@/test/irelandFixtures';
import {
  departureRows,
  IRELAND_ID,
  irelandLineDiagram,
  irelandLineHref,
  irelandStationHref,
  lineEnds,
  lineStations,
  lineSwatch,
  linesAt,
  liveBoardCount,
  matchingStations,
  mayHaveLiveBoard,
  networkBySlug,
  networkInfo,
  networkNotice,
  networkSummary,
  stationHref,
  stationsById,
} from './ireland';
import { searchKey } from './stationSearch';

describe('networks', () => {
  it('names each network by its operator, and maps the api value to a slug', () => {
    expect(networkInfo('republic-of-ireland')).toEqual({
      network: 'republic-of-ireland',
      slug: 'iarnrod-eireann',
      name: 'Iarnród Éireann',
    });
    expect(networkInfo('northern-ireland')?.name).toBe('NI Railways');
    expect(networkBySlug('ni-railways')?.network).toBe('northern-ireland');
  });

  it('knows no other network, prototype keys included', () => {
    expect(networkInfo('constructor')).toBeNull();
    expect(networkBySlug('republic-of-ireland')).toBeNull();
    expect(networkBySlug('toString')).toBeNull();
  });
});

describe('hrefs and ids', () => {
  it('encodes a corridor id that holds a slash', () => {
    expect(irelandLineHref('iarnrod-eireann', 'DUB-DRO/DUN')).toBe(
      '/island-of-ireland/iarnrod-eireann/lines/DUB-DRO%2FDUN',
    );
    expect(irelandStationHref('ni-railways', 'nir-bangor')).toBe('/island-of-ireland/ni-railways/stations/nir-bangor');
    expect(stationHref(CONNOLLY)).toBe('/island-of-ireland/iarnrod-eireann/stations/8220IR0007');
  });

  it('accepts the catalogue ids and refuses anything else', () => {
    for (const id of ['8220IR0007', 'nir-bangor', 'DUB-BFT', 'DUB-DRO/DUN']) expect(IRELAND_ID.test(id)).toBe(true);
    for (const id of ['', '../x', 'a b', '%2F', 'x'.repeat(65)]) expect(IRELAND_ID.test(id)).toBe(false);
  });
});

describe('lines', () => {
  const byId = stationsById(STATIONS);

  it("lists a line's known stations in order, dropping ids the catalogue lacks", () => {
    expect(lineStations(DROGHEDA_LINE, byId)).toEqual([
      { id: CONNOLLY.id, name: 'Dublin Connolly' },
      { id: DROGHEDA.id, name: 'Drogheda' },
    ]);
  });

  it("names a line's ends", () => {
    expect(lineEnds(ENTERPRISE, byId)).toBe('Dublin Connolly to Belfast Grand Central');
    expect(lineEnds({ stations: [CONNOLLY.id] }, byId)).toBeNull();
  });

  it('finds the lines at a station', () => {
    expect(linesAt(LINES, DROGHEDA.id).map((line) => line.id)).toEqual(['DUB-BFT', 'DUB-DRO/DUN']);
    expect(linesAt(LINES, BELFAST.id).map((line) => line.id)).toEqual(['DUB-BFT']);
  });

  it('uses only a well-formed colour, else the neutral swatch', () => {
    expect(lineSwatch(ENTERPRISE)).toEqual({ colour: '#00843D' });
    expect(lineSwatch({ color: null })).toEqual({ colour: null });
    expect(lineSwatch({ color: 'red;background:url(x)' })).toEqual({ colour: null });
  });

  it('draws a line as one strip with both ends marked', () => {
    const diagram = irelandLineDiagram(lineStations(ENTERPRISE, byId));
    expect(diagram.stops.map((stop) => [stop.station.name, stop.terminus])).toEqual([
      ['Dublin Connolly', true],
      ['Drogheda', false],
      ['Belfast Grand Central', true],
    ]);
    expect(diagram.from?.name).toBe('Dublin Connolly');
    expect(diagram.to?.name).toBe('Belfast Grand Central');
    expect(irelandLineDiagram([]).from).toBeNull();
  });
});

describe('live boards', () => {
  it('asks for a board only for an Iarnród Éireann station with a live code', () => {
    expect(mayHaveLiveBoard(CONNOLLY)).toBe(true);
    expect(mayHaveLiveBoard(BELFAST)).toBe(false);
    expect(mayHaveLiveBoard(BANGOR)).toBe(false);
    expect(mayHaveLiveBoard({ network: 'northern-ireland', liveCode: 'X' })).toBe(false);
  });

  it('counts the stations with a board', () => {
    expect(liveBoardCount(STATIONS)).toBe(2);
    expect(liveBoardCount([BANGOR, HOLYWOOD])).toBe(0);
  });

  it('shows the expected time, the timetabled one when different, and leaves out trains ending here', () => {
    expect(departureRows(DEPARTURES)).toEqual([
      {
        key: 'A101-0',
        time: '08:05',
        scheduled: '08:00',
        destination: 'Belfast Grand Central',
        origin: 'Dublin Connolly',
        trainCode: 'A101',
        lateMinutes: 5,
      },
      {
        key: 'D802-1',
        time: '08:10',
        scheduled: null,
        destination: 'Drogheda',
        origin: 'Dublin Connolly',
        trainCode: 'D802',
        lateMinutes: 0,
      },
    ]);
  });

  it('falls back to the timetabled time when the expected one is missing or malformed', () => {
    const [row] = departureRows([{ ...DEPARTURES[0]!, expectedDeparture: '00:0' }]);
    expect(row?.time).toBe('08:00');
    expect(row?.scheduled).toBeNull();
  });
});

describe('summaries', () => {
  it('says what each network has', () => {
    const iarnrod = STATIONS.filter((station) => station.network === 'republic-of-ireland');
    const nir = STATIONS.filter((station) => station.network === 'northern-ireland');
    expect(networkSummary(iarnrod, 2)).toBe('2 lines, 3 stations. Live departures at 2 stations.');
    expect(networkSummary(nir, 1)).toBe('1 line, 2 stations. Stations and lines only.');
  });

  it('never claims line status, and says when there are no live times', () => {
    const iarnrod = networkInfo('republic-of-ireland')!;
    const nir = networkInfo('northern-ireland')!;
    expect(networkNotice(iarnrod, [CONNOLLY])).toBe(
      "Lines and stations from the published timetable. Station pages show live departures where we have them. We don't show line status for Iarnród Éireann.",
    );
    expect(networkNotice(iarnrod, [BELFAST])).toContain("We don't have live Iarnród Éireann times yet.");
    expect(networkNotice(nir, [BANGOR])).toBe(
      "Lines and stations. We don't have live NI Railways times or line status.",
    );
  });
});

describe('matchingStations', () => {
  it('matches on the search key, with each station page and network', () => {
    const matches = matchingStations(STATIONS, searchKey('bangor'), searchKey);
    expect(matches).toEqual([
      { station: BANGOR, href: '/island-of-ireland/ni-railways/stations/nir-bangor', networkName: 'NI Railways' },
    ]);
    expect(matchingStations(STATIONS, '', searchKey)).toEqual([]);
  });
});
