import { Stack, Text, Title } from '@mantine/core';
import type { Metadata } from 'next';
import { OpenDataAttributionDetails } from '@/components/OpenDataAttribution';
import { getTransitNetworks } from '@/lib/api';
import { READING_PAGE_WIDTH } from '@/components/LegalPage';
import { pageMetadata } from '@/lib/pageMetadata';
import { SectionTitle } from '@/components/SectionTitle';
import { TextLink } from '@/components/TextLink';
import { SOFTWARE_LICENCE_NAME, SOFTWARE_LICENCE_URL, SOURCE_CODE_URL, VERSION_PATH } from '@/lib/sourceCode';

// Render per request so the footer's legal links (lib/legal.ts, read at
// request time) are right on this page too. Without it Next prerenders this
// page at build time, with the flags as they were in the image build.
export const dynamic = 'force-dynamic';

const METADATA_TITLE = 'Data sources and licences';
const METADATA_DESCRIPTION = 'The open data Distant Signal uses, and the credit each licence requires.';

export const metadata: Metadata = pageMetadata(METADATA_TITLE, METADATA_DESCRIPTION, { path: '/attribution' });

/** `/attribution`: always public (unlike the draft legal pages), because the
 * licences below require the attribution now. Content lives in
 * `components/OpenDataAttribution.tsx` beside the footer's short version. */
export default async function AttributionPage() {
  // The tram networks shown ([] by default): their sources are credited too.
  const transit = await getTransitNetworks();
  return (
    <Stack p="lg" gap="lg" maw={READING_PAGE_WIDTH}>
      <Title order={1}>Data sources and licences</Title>
      <OpenDataAttributionDetails transitNetworks={transit.map((network) => network.id)} />
      {/* AGPL-3.0 §13 (lib/sourceCode.ts): the footer links the source on
          every page; this says what the licence is and where the exact
          running commits are listed. */}
      <Stack gap={4} component="section" aria-labelledby="source-code">
        <SectionTitle id="source-code">Source code</SectionTitle>
        <Text size="sm">
          Distant Signal is free software, licensed under the{' '}
          <TextLink href={SOFTWARE_LICENCE_URL} external inline underline="always">
            {SOFTWARE_LICENCE_NAME}
          </TextLink>
          . You can read and reuse{' '}
          <TextLink href={SOURCE_CODE_URL} external inline underline="always">
            its source code
          </TextLink>
          , and the{' '}
          <TextLink href={VERSION_PATH} inline underline="always">
            list of running versions
          </TextLink>{' '}
          names the exact code this site runs.
        </Text>
      </Stack>
    </Stack>
  );
}
