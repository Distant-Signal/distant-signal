import { Stack, Text, Title } from '@mantine/core';
import { TextLink } from '@/components/TextLink';

/** An unknown Irish network, line or station, or every one of them while
 * the Irish feeds are off. */
export default function IrelandNotFound() {
  return (
    <Stack p="lg" gap="md">
      {/* order={1}, size="h2": see app/error.tsx. */}
      <Title order={1} size="h2">
        Not found
      </Title>
      <Text c="dimmed">We don&apos;t have an Irish network, line or station at this address.</Text>
      <TextLink href="/lines" underline="always">
        See all lines
      </TextLink>
    </Stack>
  );
}
