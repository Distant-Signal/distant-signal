import { Stack, Text, Title } from '@mantine/core';
import { CreateGroupForm } from '@/components/CreateGroupForm';
import type { Metadata } from 'next';

// The page says what happens after "Create group": CreateGroupForm.tsx
// immediately rotates the new group's first invite link (spec §6) before
// navigating to the detail page where GroupInviteLinkCard shows it. Also
// `maw={480}`, on top of the `<main>` width fix: a one-field form stretching
// the full content width reads as unfinished.
export const metadata: Metadata = { title: 'Create a group', robots: { index: false } };

export default function NewGroupPage() {
  return (
    <Stack p="lg" gap="md" maw={480}>
      <Title order={1}>Create a group</Title>
      <Text c="dimmed">You&apos;ll get an invite link to share as soon as it&apos;s created.</Text>
      <CreateGroupForm />
    </Stack>
  );
}
