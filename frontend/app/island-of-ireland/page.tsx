import { Stack, Text, Title } from '@mantine/core';
import type { Metadata } from 'next';
import { CardTitleLink, ClickableCard } from '@/components/ClickableCard';
import { IrelandAttributionNote } from '@/components/IrelandAttributionNote';
import { IRELAND_LABEL, IRELAND_PATH, irelandNetworkHref, networkSummary } from '@/lib/ireland';
import { loadIreland } from '@/lib/irelandData';
import { pageMetadata } from '@/lib/pageMetadata';

export const metadata: Metadata = pageMetadata(
  IRELAND_LABEL,
  'Iarnród Éireann and NI Railways lines and stations, with live departures where we have them.',
  { path: IRELAND_PATH },
);

/** `/island-of-ireland`: the two Irish networks, one card each, and what
 * we have for each. Not found while neither has any stations (the feeds
 * are off by default), so nothing about them shows until they're on.
 * docs/superpowers/specs/2026-11-04-island-of-ireland-pages-design.md. */
export default async function IrelandPage() {
  const networks = await loadIreland();
  return (
    <Stack p="lg" gap="lg">
      <Stack gap={4}>
        <Title order={1}>{IRELAND_LABEL}</Title>
        <Text c="dimmed">Lines and stations on both networks. We don&apos;t show line status for Irish trains.</Text>
      </Stack>
      <Stack component="ul" gap="sm" className="ds-plain-list" aria-label="Networks">
        {networks.map(({ info, stations, lines }) => (
          <li key={info.slug}>
            <ClickableCard>
              <Stack gap={2}>
                <Text fw={600}>
                  <CardTitleLink href={irelandNetworkHref(info.slug)}>{info.name}</CardTitleLink>
                </Text>
                <Text size="sm" c="dimmed">
                  {networkSummary(stations, lines.length)}
                </Text>
              </Stack>
            </ClickableCard>
          </li>
        ))}
      </Stack>
      <IrelandAttributionNote
        credits={networks.flatMap(({ info }) =>
          info.network === 'republic-of-ireland' ? [info.network, 'live' as const] : [info.network],
        )}
      />
    </Stack>
  );
}
