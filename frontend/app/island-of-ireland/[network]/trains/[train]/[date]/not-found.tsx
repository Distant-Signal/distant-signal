import { Stack, Text, Title } from '@mantine/core';
import { TextLink } from '@/components/TextLink';
import { IRELAND_PATH } from '@/lib/ireland';

/** A train no departure board has shown on that date (or an address that
 * can't be one): we don't make up a page for a train we haven't seen. */
export default function IrelandTrainNotFound() {
  return (
    <Stack p="lg" gap="md">
      {/* order={1}, size="h2": see app/error.tsx. */}
      <Title order={1} size="h2">
        We haven&apos;t seen this train
      </Title>
      <Text c="dimmed">
        No departure board has shown this train on that date. A train appears once it&apos;s due at a station in the
        next 90 minutes.
      </Text>
      <TextLink href={IRELAND_PATH} underline="always">
        See Ireland and Northern Ireland
      </TextLink>
    </Stack>
  );
}
