import { Group, Stack, Text, Title } from '@mantine/core';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { IrelandAttributionNote } from '@/components/IrelandAttributionNote';
import { SectionTitle } from '@/components/SectionTitle';
import { TextLink } from '@/components/TextLink';
import { TransitLineDiagram } from '@/components/TransitLineDiagram';
import { TransitLineSwatch } from '@/components/TransitLineSwatch';
import {
  irelandLineDiagram,
  irelandLineHref,
  irelandNetworkHref,
  irelandStationHref,
  lineStations,
  lineSwatch,
  stationsById,
} from '@/lib/ireland';
import { idFromSegment, loadIrelandNetwork } from '@/lib/irelandData';
import { pageMetadata, previewImageAlt } from '@/lib/pageMetadata';
import { lineColour } from '@/lib/transitStops';

interface Params {
  params: Promise<{ network: string; line: string }>;
}

async function load(network: string, segment: string) {
  const id = idFromSegment(segment);
  const data = await loadIrelandNetwork(network);
  const line = data.lines.find((candidate) => candidate.id === id);
  if (!line) notFound();
  return { ...data, line, stops: lineStations(line, stationsById(data.stations)) };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { network, line: segment } = await params;
  const { info, line, stops } = await load(network, segment);
  const first = stops[0];
  const last = stops[stops.length - 1];
  const route = first && last && first.id !== last.id ? ` from ${first.name} to ${last.name}` : '';
  return pageMetadata(line.name, `${line.name}, ${info.name}: its stations in order${route}.`, {
    path: irelandLineHref(info.slug, line.id),
    imageAlt: previewImageAlt(line.name),
  });
}

/** `/island-of-ireland/[network]/lines/[line]`: an Irish line's stations
 * in order, drawn as a route strip (`TransitLineDiagram`) from the line's
 * one stopping pattern. No status badge (there is no line status for
 * either network, design §4), no timetable and no pin. */
export default async function IrelandLinePage({ params }: Params) {
  const { network, line: segment } = await params;
  const { info, line, stops } = await load(network, segment);
  const swatch = lineSwatch(line);
  const diagram = irelandLineDiagram(stops);
  const route = diagram.from && diagram.to && diagram.from.id !== diagram.to.id;
  return (
    <Stack p="lg" gap="lg">
      <Stack gap={4}>
        <Group gap="sm" wrap="nowrap">
          <TransitLineSwatch line={swatch} size={18} />
          <Title order={1}>{line.name}</Title>
        </Group>
        <TextLink href={irelandNetworkHref(info.slug)}>{info.name}</TextLink>
      </Stack>

      <Text c="dimmed">We don&apos;t have line status for this line.</Text>

      <Stack gap="sm">
        <SectionTitle>Stations</SectionTitle>
        {stops.length === 0 ? (
          <Text c="dimmed">No stations listed for this line.</Text>
        ) : (
          <>
            {route && diagram.from && diagram.to && (
              <Text size="sm" c="dimmed">
                {`${diagram.from.name} to ${diagram.to.name}, both ways.`}
              </Text>
            )}
            <TransitLineDiagram
              stopHref={(id) => irelandStationHref(info.slug, id)}
              diagram={diagram}
              colour={lineColour(swatch)}
              label={`${line.name} stations${route && diagram.from && diagram.to ? `, ${diagram.from.name} to ${diagram.to.name}` : ''}`}
              idPrefix="line-diagram"
            />
          </>
        )}
      </Stack>

      <IrelandAttributionNote credits={[info.network]} />
    </Stack>
  );
}
