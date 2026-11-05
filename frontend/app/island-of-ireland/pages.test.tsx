import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, within } from '@testing-library/react';
import { renderWithMantine } from '@/test/render';
import * as api from '@/lib/api';
import { BANGOR, BELFAST, CONNOLLY, DEPARTURES, LINES, STATIONS } from '@/test/irelandFixtures';
import IrelandPage, { metadata } from './page';
import IrelandNetworkPage, { generateMetadata as networkMetadata } from './[network]/page';
import IrelandLinePage, { generateMetadata as lineMetadata } from './[network]/lines/[line]/page';
import IrelandStationPage, { generateMetadata as stationMetadata } from './[network]/stations/[station]/page';

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return {
    ...actual,
    getIrelandStations: vi.fn(),
    getIrelandLines: vi.fn(),
    getIrelandDepartures: vi.fn(),
  };
});

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => '/island-of-ireland/iarnrod-eireann',
  useSearchParams: () => new URLSearchParams(),
}));

const network = (slug: string) => ({ params: Promise.resolve({ network: slug }) });
const line = (slug: string, id: string) => ({ params: Promise.resolve({ network: slug, line: id }) });
const station = (slug: string, id: string) => ({ params: Promise.resolve({ network: slug, station: id }) });

beforeEach(() => {
  cleanup();
  vi.mocked(api.getIrelandStations).mockResolvedValue(STATIONS);
  vi.mocked(api.getIrelandLines).mockResolvedValue(LINES);
  vi.mocked(api.getIrelandDepartures).mockResolvedValue({ departures: DEPARTURES, polledAt: '2026-11-04T09:05:03Z' });
});

describe('/island-of-ireland', () => {
  it('shows a card per network, says what each has, and never shows a status', async () => {
    renderWithMantine(await IrelandPage());
    expect(screen.getByRole('heading', { level: 1, name: 'Ireland and Northern Ireland' })).toBeTruthy();
    expect(metadata.title).toBe('Ireland and Northern Ireland');
    expect(metadata.description).toBeTruthy();
    const cards = within(screen.getByRole('list', { name: 'Networks' })).getAllByRole('listitem');
    expect(cards.map((card) => card.textContent)).toEqual([
      'Iarnród Éireann2 lines, 3 stations. Live departures at 2 stations.',
      'NI Railways1 line, 2 stations. Stations and lines only.',
    ]);
    expect(screen.getByRole('link', { name: 'NI Railways' }).getAttribute('href')).toBe(
      '/island-of-ireland/ni-railways',
    );
    expect(screen.getByText(/We don't show line status for Irish trains/)).toBeTruthy();
    expect(screen.queryByText(/Good service/)).toBeNull();
  });

  it('leaves out a network with no stations', async () => {
    vi.mocked(api.getIrelandStations).mockResolvedValue([CONNOLLY]);
    renderWithMantine(await IrelandPage());
    expect(screen.queryByRole('link', { name: 'NI Railways' })).toBeNull();
  });

  it('is not found while the feeds are off', async () => {
    vi.mocked(api.getIrelandStations).mockResolvedValue([]);
    vi.mocked(api.getIrelandLines).mockResolvedValue([]);
    await expect(IrelandPage()).rejects.toThrow('NEXT_NOT_FOUND');
  });
});

describe('/island-of-ireland/[network]', () => {
  it("lists the network's lines with their ends and no badge, and its stations", async () => {
    renderWithMantine(await IrelandNetworkPage(network('iarnrod-eireann')));
    expect(screen.getByRole('heading', { level: 1, name: 'Iarnród Éireann' })).toBeTruthy();
    const lines = within(screen.getByRole('list', { name: 'Lines' })).getAllByRole('listitem');
    expect(lines).toHaveLength(2);
    expect(lines[0]!.textContent).toContain('Dublin - Belfast');
    expect(lines[0]!.textContent).toContain('Dublin Connolly to Belfast Grand Central');
    expect(screen.getByRole('link', { name: 'Dublin - Drogheda/Dundalk' }).getAttribute('href')).toBe(
      '/island-of-ireland/iarnrod-eireann/lines/DUB-DRO%2FDUN',
    );
    const stations = within(screen.getByRole('list', { name: 'Stations' })).getAllByRole('link');
    expect(stations.map((link) => link.textContent)).toEqual(['Belfast Grand Central', 'Dublin Connolly', 'Drogheda']);
    expect(screen.getByText(/Includes the Enterprise/)).toBeTruthy();
    expect(screen.queryByText(/Good service/)).toBeNull();
  });

  it('points NI Railways readers to the Enterprise stations under Iarnród Éireann', async () => {
    renderWithMantine(await IrelandNetworkPage(network('ni-railways')));
    expect(screen.getByText(/We don't have live NI Railways times or line status/)).toBeTruthy();
    expect(screen.getByText(/its stops at Lisburn, Portadown, Lurgan and Newry/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Iarnród Éireann' }).getAttribute('href')).toBe(
      '/island-of-ireland/iarnrod-eireann',
    );
  });

  it('has a title and description, and is not found for an unknown or empty network', async () => {
    const meta = await networkMetadata(network('ni-railways'));
    expect(meta.title).toBe('NI Railways');
    expect(meta.description).toBe('NI Railways: lines and stations, with live departures where we have them.');
    await expect(IrelandNetworkPage(network('republic-of-ireland'))).rejects.toThrow('NEXT_NOT_FOUND');
    vi.mocked(api.getIrelandStations).mockResolvedValue([CONNOLLY]);
    await expect(IrelandNetworkPage(network('ni-railways'))).rejects.toThrow('NEXT_NOT_FOUND');
  });
});

describe('/island-of-ireland/[network]/lines/[line]', () => {
  it('draws the stations in order, says there is no line status and offers no pin', async () => {
    renderWithMantine(await IrelandLinePage(line('iarnrod-eireann', 'DUB-BFT')));
    expect(screen.getByRole('heading', { level: 1, name: 'Dublin - Belfast' })).toBeTruthy();
    expect(screen.getByText("We don't have line status for this line.")).toBeTruthy();
    const strip = screen.getByRole('list', {
      name: 'Dublin - Belfast stations, Dublin Connolly to Belfast Grand Central',
    });
    expect(
      within(strip)
        .getAllByRole('link')
        .map((link) => link.getAttribute('href')),
    ).toEqual([
      '/island-of-ireland/iarnrod-eireann/stations/8220IR0007',
      '/island-of-ireland/iarnrod-eireann/stations/8300IR0074',
      '/island-of-ireland/iarnrod-eireann/stations/7020IR2162',
    ]);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('takes a corridor id with an encoded slash', async () => {
    renderWithMantine(await IrelandLinePage(line('iarnrod-eireann', 'DUB-DRO%2FDUN')));
    expect(screen.getByRole('heading', { level: 1, name: 'Dublin - Drogheda/Dundalk' })).toBeTruthy();
    const meta = await lineMetadata(line('iarnrod-eireann', 'DUB-DRO/DUN'));
    expect(meta.title).toBe('Dublin - Drogheda/Dundalk');
    expect(meta.description).toBe(
      'Dublin - Drogheda/Dundalk, Iarnród Éireann: its stations in order from Dublin Connolly to Drogheda.',
    );
  });

  it("is not found for another network's line or a malformed id", async () => {
    await expect(IrelandLinePage(line('ni-railways', 'DUB-BFT'))).rejects.toThrow('NEXT_NOT_FOUND');
    await expect(IrelandLinePage(line('iarnrod-eireann', '..%2F..'))).rejects.toThrow('NEXT_NOT_FOUND');
  });
});

describe('/island-of-ireland/[network]/stations/[station]', () => {
  it("shows an Iarnród Éireann station's live departures and its lines", async () => {
    renderWithMantine(await IrelandStationPage(station('iarnrod-eireann', CONNOLLY.id)));
    expect(screen.getByRole('heading', { level: 1, name: 'Dublin Connolly' })).toBeTruthy();
    expect(api.getIrelandDepartures).toHaveBeenCalledWith(CONNOLLY.id);
    expect(screen.getByText(/Lines here:/)).toBeTruthy();
    expect(within(screen.getByRole('list', { name: 'Live departures' })).getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText(/^Updated /)).toBeTruthy();
    expect(document.querySelector('[data-credit="irish-rail-realtime"]')).not.toBeNull();
    const meta = await stationMetadata(station('iarnrod-eireann', CONNOLLY.id));
    expect(meta.title).toBe('Dublin Connolly, Iarnród Éireann');
    expect(meta.description).toBe(
      'Live departures from Dublin Connolly and the Iarnród Éireann lines that call there.',
    );
  });

  it("doesn't ask for a board the api says the station hasn't got", async () => {
    vi.mocked(api.getIrelandDepartures).mockClear();
    renderWithMantine(await IrelandStationPage(station('iarnrod-eireann', BELFAST.id)));
    expect(api.getIrelandDepartures).not.toHaveBeenCalled();
    expect(screen.getByText("We don't have live departures for this station.")).toBeTruthy();
    expect(document.querySelector('[data-credit="irish-rail-realtime"]')).toBeNull();
  });

  it('keeps the page when the board fails', async () => {
    vi.mocked(api.getIrelandDepartures).mockRejectedValue(new Error('500'));
    renderWithMantine(await IrelandStationPage(station('iarnrod-eireann', CONNOLLY.id)));
    expect(screen.getByText("Couldn't load departures. Try again.")).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'Dublin Connolly' })).toBeTruthy();
  });

  it('says NI Railways has no live times, without asking', async () => {
    vi.mocked(api.getIrelandDepartures).mockClear();
    renderWithMantine(await IrelandStationPage(station('ni-railways', BANGOR.id)));
    expect(api.getIrelandDepartures).not.toHaveBeenCalled();
    expect(screen.getByText("We don't have live NI Railways times.")).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Departures' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Bangor Line' })).toBeTruthy();
  });

  it("is not found for another network's station", async () => {
    await expect(IrelandStationPage(station('ni-railways', CONNOLLY.id))).rejects.toThrow('NEXT_NOT_FOUND');
  });
});
