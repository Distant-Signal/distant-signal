import type { IrelandDeparture, IrelandLine, IrelandStation } from '@/lib/ireland';

/** A small island of Ireland catalogue, in the api's shape after DS-359
 * (`liveCode`, `rawName`, `color`). */
export const CONNOLLY: IrelandStation = {
  id: '8220IR0007',
  name: 'Dublin Connolly',
  network: 'republic-of-ireland',
  latitude: 53.35,
  longitude: -6.25,
  liveCode: 'CNLLY',
  rawName: null,
};
export const DROGHEDA: IrelandStation = {
  id: '8300IR0074',
  name: 'Drogheda',
  network: 'republic-of-ireland',
  latitude: null,
  longitude: null,
  liveCode: 'DGHDA',
  rawName: null,
};
export const BELFAST: IrelandStation = {
  id: '7020IR2162',
  name: 'Belfast Grand Central',
  network: 'republic-of-ireland',
  latitude: null,
  longitude: null,
  liveCode: null,
  rawName: null,
};
export const BANGOR: IrelandStation = {
  id: 'nir-bangor',
  name: 'Bangor',
  network: 'northern-ireland',
  latitude: 54.66,
  longitude: -5.67,
  liveCode: null,
  rawName: null,
};
export const HOLYWOOD: IrelandStation = {
  id: 'nir-holywood',
  name: 'Holywood',
  network: 'northern-ireland',
  latitude: null,
  longitude: null,
  liveCode: null,
  rawName: 'HOLLYWOOD RAIL HALT',
};

export const STATIONS: IrelandStation[] = [BANGOR, BELFAST, CONNOLLY, DROGHEDA, HOLYWOOD];

export const ENTERPRISE: IrelandLine = {
  id: 'DUB-BFT',
  name: 'Dublin - Belfast',
  shortName: null,
  network: 'republic-of-ireland',
  agency: 'Iarnród Éireann / Irish Rail',
  color: '#00843D',
  textColor: '#FFFFFF',
  stations: [CONNOLLY.id, DROGHEDA.id, BELFAST.id],
};
export const DROGHEDA_LINE: IrelandLine = {
  id: 'DUB-DRO/DUN',
  name: 'Dublin - Drogheda/Dundalk',
  shortName: null,
  network: 'republic-of-ireland',
  agency: null,
  color: null,
  textColor: null,
  stations: [CONNOLLY.id, 'unknown-id', DROGHEDA.id],
};
export const BANGOR_LINE: IrelandLine = {
  id: 'nir-bangor-line',
  name: 'Bangor Line',
  shortName: null,
  network: 'northern-ireland',
  agency: 'NI Railways',
  color: null,
  textColor: null,
  stations: [HOLYWOOD.id, BANGOR.id],
};

export const LINES: IrelandLine[] = [BANGOR_LINE, ENTERPRISE, DROGHEDA_LINE];

export const DEPARTURES: IrelandDeparture[] = [
  {
    trainCode: 'A101',
    origin: 'Dublin Connolly',
    destination: 'Belfast Grand Central',
    scheduledArrival: null,
    scheduledDeparture: '08:00',
    expectedArrival: null,
    expectedDeparture: '08:05',
    lateMinutes: 5,
    status: 'En Route',
    dueInMinutes: 12,
  },
  {
    trainCode: 'D802',
    origin: 'Dublin Connolly',
    destination: 'Drogheda',
    scheduledArrival: null,
    scheduledDeparture: '08:10',
    expectedArrival: null,
    expectedDeparture: '08:10',
    lateMinutes: 0,
    status: 'No Information',
    dueInMinutes: 22,
  },
  {
    trainCode: 'E999',
    origin: 'Bray',
    destination: 'Dublin Connolly',
    scheduledArrival: '08:15',
    scheduledDeparture: null,
    expectedArrival: '08:15',
    expectedDeparture: null,
    lateMinutes: 0,
    status: 'En Route',
    dueInMinutes: 27,
  },
];
