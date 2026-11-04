import { Stack, Text, Title } from '@mantine/core';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { IrelandAttributionNote } from '@/components/IrelandAttributionNote';
import { IrelandDepartureBoard } from '@/components/IrelandDepartureBoard';
import { LinkSentence } from '@/components/LinkSentence';
import { SectionTitle } from '@/components/SectionTitle';
import { TextLink } from '@/components/TextLink';
import { getIrelandDepartures } from '@/lib/api';
import {
  type IrelandBoard,
  irelandLineHref,
  irelandNetworkHref,
  irelandStationHref,
  linesAt,
  mayHaveLiveBoard,
} from '@/lib/ireland';
import { idFromSegment, loadIrelandNetwork } from '@/lib/irelandData';
import { createLogger } from '@/lib/logger';
import { pageMetadata, previewImageAlt } from '@/lib/pageMetadata';

const log = createLogger('app/island-of-ireland/station');

interface Params {
  params: Promise<{ network: string; station: string }>;
}

async function load(network: string, segment: string) {
  const id = idFromSegment(segment);
  const data = await loadIrelandNetwork(network);
  const station = data.stations.find((candidate) => candidate.id === id);
  if (!station) notFound();
  return { ...data, station };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { network, station: segment } = await params;
  const { info, station } = await load(network, segment);
  const title = `${station.name}, ${info.name}`;
  const description = mayHaveLiveBoard(station)
    ? `Live departures from ${station.name} and the ${info.name} lines that call there.`
    : `The ${info.name} lines that call at ${station.name}.`;
  return pageMetadata(title, description, {
    path: irelandStationHref(info.slug, station.id),
    imageAlt: previewImageAlt(title),
  });
}

/** The live board: its departures and poll time, `null` when the station has none (404),
 * or `'failed'`; the rest of the page renders either way. */
async function liveBoard(stationId: string): Promise<IrelandBoard | null | 'failed'> {
  try {
    return await getIrelandDepartures(stationId);
  } catch (err) {
    log.warn('island of Ireland departures failed', { station: stationId, error: err });
    return 'failed';
  }
}

/** `/island-of-ireland/[network]/stations/[station]`: an Irish station's
 * lines and, for Iarnród Éireann, its live departures (asked for by
 * catalogue id; the api resolves the board's code). NI Railways has no
 * live times, and the page says so rather than showing an empty board. */
export default async function IrelandStationPage({ params }: Params) {
  const { network, station: segment } = await params;
  const { info, station, lines } = await load(network, segment);
  const here = linesAt(lines, station.id);
  const board = mayHaveLiveBoard(station) ? await liveBoard(station.id) : null;
  return (
    <Stack p="lg" gap="lg">
      <Stack gap={4}>
        <Title order={1}>{station.name}</Title>
        <TextLink href={irelandNetworkHref(info.slug)}>{info.name}</TextLink>
        <LinkSentence
          lead={here.length > 1 ? 'Lines here: ' : 'Line here: '}
          links={here.map((line) => ({ href: irelandLineHref(info.slug, line.id), label: line.name }))}
        />
      </Stack>

      {info.network === 'republic-of-ireland' ? (
        <Stack gap="sm" id="departures">
          <SectionTitle>Departures</SectionTitle>
          <IrelandDepartureBoard board={board} />
        </Stack>
      ) : (
        <Text c="dimmed">We don&apos;t have live {info.name} times.</Text>
      )}

      <IrelandAttributionNote
        credits={board !== null && board !== 'failed' ? [info.network, 'live'] : [info.network]}
      />
    </Stack>
  );
}
