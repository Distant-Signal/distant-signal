import { Stack, Text } from '@mantine/core';
import { DATA_SOURCES } from '@/components/OpenDataAttribution';
import { TextLink } from '@/components/TextLink';
import type { IslandOfIrelandNetwork } from '@/lib/ireland';

/** Which `/attribution` entries cover each kind of Irish data (LEG-20,
 * LEG-21): the NTA's timetable for Iarnród Éireann's stations and lines,
 * Iarnród Éireann's own realtime data for its live boards, and Translink's
 * data via OpenDataNI for NI Railways'. */
export const IRELAND_CREDIT_IDS = {
  'republic-of-ireland': 'nta-gtfs',
  'northern-ireland': 'opendatani',
  live: 'irish-rail-realtime',
} as const;

export type IrelandCredit = keyof typeof IRELAND_CREDIT_IDS;

/** The data credits at the foot of an island of Ireland page: each
 * source's statement exactly as `/attribution` gives it (the same
 * `DATA_SOURCES` entry, so the licence wording can't drift), then a link
 * to the full credits. */
export function IrelandAttributionNote({ credits }: { credits: readonly (IslandOfIrelandNetwork | 'live')[] }) {
  const sources = [...new Set(credits)].flatMap((credit) => {
    const source = DATA_SOURCES.find((entry) => entry.id === IRELAND_CREDIT_IDS[credit]);
    return source ? [source] : [];
  });
  return (
    <Stack gap={4} data-ireland-credits>
      {sources.map((source) => (
        <Text key={source.id} size="xs" c="dimmed" data-credit={source.id}>
          {source.statement}
        </Text>
      ))}
      <Text size="xs" c="dimmed">
        <TextLink href="/attribution" tone="inherit" underline="always" inline>
          Data credits
        </TextLink>
      </Text>
    </Stack>
  );
}
