import { Stack, Text, Title } from '@mantine/core';
import type { Metadata } from 'next';
import { IrelandAttributionNote } from '@/components/IrelandAttributionNote';
import { LineStatusRow, LineStatusRowDetail, LineStatusRowItem, LineStatusRowList } from '@/components/LineStatusRow';
import { SearchableList } from '@/components/SearchableList';
import { SectionTitle } from '@/components/SectionTitle';
import { TextLink } from '@/components/TextLink';
import {
  IRELAND_LABEL,
  IRELAND_PATH,
  irelandLineHref,
  irelandNetworkHref,
  irelandStationHref,
  lineEnds,
  lineSwatch,
  networkNotice,
  stationsById,
} from '@/lib/ireland';
import { loadIreland, loadIrelandNetwork } from '@/lib/irelandData';
import { pageMetadata, previewImageAlt } from '@/lib/pageMetadata';

interface Params {
  params: Promise<{ network: string }>;
  /** `?q=`: the station list's filter, kept in the address. */
  searchParams?: Promise<{ q?: string | string[] }>;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { network } = await params;
  const { info } = await loadIrelandNetwork(network);
  return pageMetadata(info.name, `${info.name}: lines and stations, with live departures where we have them.`, {
    path: irelandNetworkHref(info.slug),
    imageAlt: previewImageAlt(info.name),
  });
}

/** `/island-of-ireland/[network]`: one Irish network's lines and stations.
 * Lines are `LineStatusRow`s with no badge: there is no line status for
 * either network, so none is shown and the notice says so (design §4).
 * Stations are an A to Z with a filter: a few hundred at most. */
export default async function IrelandNetworkPage({ params, searchParams }: Params) {
  const { network } = await params;
  const { q } = (await searchParams) ?? {};
  const { info, stations, lines } = await loadIrelandNetwork(network);
  const byId = stationsById(stations);
  const others = (await loadIreland()).filter((other) => other.info.slug !== info.slug);
  const irishRail = others.find((other) => other.info.network === 'republic-of-ireland');
  return (
    <Stack p="lg" gap="lg">
      <Stack gap={4}>
        <Title order={1}>{info.name}</Title>
        <TextLink href={IRELAND_PATH}>{IRELAND_LABEL}</TextLink>
        <Text c="dimmed">{networkNotice(info, stations)}</Text>
      </Stack>

      <Stack gap="sm">
        <SectionTitle>Lines</SectionTitle>
        {lines.length === 0 ? (
          <Text c="dimmed">No lines listed for {info.name}.</Text>
        ) : (
          <LineStatusRowList label="Lines">
            {lines.map((line) => {
              const ends = lineEnds(line, byId);
              return (
                <LineStatusRowItem key={line.id}>
                  <LineStatusRow href={irelandLineHref(info.slug, line.id)} name={line.name} colour={lineSwatch(line)}>
                    {ends && <LineStatusRowDetail>{ends}</LineStatusRowDetail>}
                  </LineStatusRow>
                </LineStatusRowItem>
              );
            })}
          </LineStatusRowList>
        )}
        {/* The border (design §4): the Enterprise and the stations it
            shares with NI Railways come from Iarnród Éireann only. */}
        {info.network === 'republic-of-ireland' ? (
          <Text size="sm" c="dimmed">
            Includes the Enterprise between Dublin and Belfast, run with NI Railways.
          </Text>
        ) : (
          irishRail && (
            <Text size="sm" c="dimmed">
              The Enterprise between Belfast and Dublin, and its stops at Lisburn, Portadown, Lurgan and Newry, are
              under{' '}
              <TextLink href={irelandNetworkHref(irishRail.info.slug)} inline underline="always">
                {irishRail.info.name}
              </TextLink>
              .
            </Text>
          )
        )}
      </Stack>

      <Stack gap="sm">
        <SectionTitle>Stations</SectionTitle>
        <SearchableList
          searchLabel="Find a station"
          noun={{ one: 'station', other: 'stations' }}
          titlePrefix={`${info.name} stations`}
          initialQuery={Array.isArray(q) ? q[0] : q}
          layout="list"
          listLabel="Stations"
          items={stations.map((station) => ({
            key: station.id,
            text: station.name,
            // Not prefetched: a long list of links scrolling past would
            // each fetch a route.
            node: (
              <TextLink href={irelandStationHref(info.slug, station.id)} prefetch={false}>
                {station.name}
              </TextLink>
            ),
          }))}
        />
      </Stack>

      <IrelandAttributionNote
        credits={info.network === 'republic-of-ireland' ? [info.network, 'live'] : [info.network]}
      />
    </Stack>
  );
}
