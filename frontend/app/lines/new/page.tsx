import { Center, Stack, Title } from '@mantine/core';
import { CustomLineForm } from '../CustomLineForm';
import type { Metadata } from 'next';

// No `export const revalidate = 0` -- unlike `/lines/page.tsx` (which
// fetches four things server-side and needs it to avoid `next build`
// trying and failing to prerender against the `api` service, which only
// exists on the compose network at runtime -- see that page's own
// comment), this page fetches nothing server-side. Matches
// `app/track/page.tsx`'s existing shape: a static route with no dynamic
// segment and no server-side data fetch needs nothing here.
export const metadata: Metadata = { title: 'New custom line', robots: { index: false } };

export default function NewCustomLinePage() {
  return (
    // `Center` plus a `maw` matching CustomLineForm's own `maw={480}`
    // keeps this chrome's width in lockstep with the form's, so the
    // heading lines up with the form's edges -- same reasoning as
    // `[id]/edit/page.tsx`'s own comment, which this page copies almost
    // verbatim (see that file for the precedent).
    <Center>
      <Stack p="lg" gap="md" maw={480} w="100%">
        <Title order={1}>New custom line</Title>
        {/* The account-needed hint and the "what is a custom line" explanation live inside `CustomLineForm`,
            not here: this page and `[id]/edit/page.tsx` both mount the form directly under their `<h1>`, so
            one shared copy cannot drift apart. */}
        <CustomLineForm cancelHref="/lines" />
      </Stack>
    </Center>
  );
}
