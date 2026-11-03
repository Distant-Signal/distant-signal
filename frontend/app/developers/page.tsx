import {
  Code,
  List,
  ListItem,
  Stack,
  Table,
  TableTbody,
  TableTd,
  TableTh,
  TableThead,
  TableTr,
  Text,
  Title,
} from '@mantine/core';
import type { Metadata } from 'next';
import { READING_PAGE_WIDTH } from '@/components/LegalPage';
import { SectionTitle } from '@/components/SectionTitle';
import { TextLink } from '@/components/TextLink';
import { NON_AFFILIATION } from '@/lib/api-types';
import { API_BASE_URL, OPENAPI_URL, POLL_INTERVAL_SECONDS } from '@/lib/apiReference';
import { API_REFERENCE_PATH, CONNECTED_APPS_PATH, RECIPES } from '@/lib/developerDocs';
import { pageMetadata } from '@/lib/pageMetadata';
import { lifetimeLabel, PERSONAL_TOKEN_SCOPES, personalScopeSentence } from '@/lib/personalTokens';

// Per request, as /attribution, so the footer's legal links read the
// runtime flags (OpenDataAttribution.tsx).
export const dynamic = 'force-dynamic';

const METADATA_TITLE = 'Developers';
const METADATA_DESCRIPTION = 'Read your own Distant Signal data from a script, a home dashboard or a phone shortcut.';

export const metadata: Metadata = pageMetadata(METADATA_TITLE, METADATA_DESCRIPTION, { path: '/developers' });

/** The lifetimes the Connected apps page offers (docs/personal-api-tokens.md). */
const LIFETIME_DAYS = [7, 30, 90, 365] as const;

const CURL_EXAMPLE = `export DS_TOKEN=dsp_your_token_here
curl -H "Authorization: Bearer $DS_TOKEN" ${API_BASE_URL}/v1/me`;

/** What `/v1/me` answers, with example values. Its attribution has no
 * sources: it is about the token, not rail data. */
const ME_EXAMPLE = JSON.stringify(
  {
    data: {
      name: 'Kitchen display',
      scopes: ['lines:read', 'journeys:read'],
      createdAt: '2026-11-03T09:00:00Z',
      expiresAt: '2027-02-01T09:00:00Z',
    },
    attribution: { sources: [], statement: NON_AFFILIATION },
  },
  null,
  2,
);

/** `/developers`: what the personal API is and how to start with it. The
 * reference is `/developers/api`. */
export default function DevelopersPage() {
  return (
    <Stack p="lg" gap="lg" maw={READING_PAGE_WIDTH}>
      <Title order={1}>Developers</Title>
      <Text>
        Read your own Distant Signal data from something you run yourself, such as a script, a home dashboard or a phone
        shortcut. You need a personal API token.
      </Text>

      <Stack gap="xs" component="section" aria-labelledby="tokens-heading">
        <SectionTitle id="tokens-heading">Personal API tokens</SectionTitle>
        <Text>
          A token can only read, never change anything. Each one reads only what you allow when you create it:
        </Text>
        <Table verticalSpacing={6} horizontalSpacing="xs" layout="fixed" aria-label="Token scopes">
          <TableThead>
            <TableTr>
              <TableTh w="45%">Scope</TableTh>
              <TableTh>What it can read</TableTh>
            </TableTr>
          </TableThead>
          <TableTbody>
            {PERSONAL_TOKEN_SCOPES.map((scope) => (
              <TableTr key={scope}>
                <TableTd>
                  <Code className="ds-nowrap">{scope}</Code>
                </TableTd>
                <TableTd>{personalScopeSentence(scope)}</TableTd>
              </TableTr>
            ))}
          </TableTbody>
        </Table>
        <List size="sm" spacing={4}>
          <ListItem>
            A token lasts {LIFETIME_DAYS.slice(0, -1).map(lifetimeLabel).join(', ')} or{' '}
            {lifetimeLabel(LIFETIME_DAYS[LIFETIME_DAYS.length - 1] ?? 365)}, and stops working after 90 days without
            use.
          </ListItem>
          <ListItem>You can have up to 10 tokens, and revoke any of them at any time.</ListItem>
          <ListItem>
            Anyone with a token can read what it allows, so keep it private. We notify you whenever a token is created.
          </ListItem>
        </List>
      </Stack>

      <Stack gap="xs" component="section" aria-labelledby="create-heading">
        <SectionTitle id="create-heading">Create a token</SectionTitle>
        <List type="ordered" spacing={4}>
          <ListItem>
            Open{' '}
            <TextLink href={CONNECTED_APPS_PATH} inline underline="always">
              Connected apps
            </TextLink>{' '}
            (you need to log in).
          </ListItem>
          <ListItem>Under Personal API tokens, give it a name and tick what it may read.</ListItem>
          <ListItem>Choose when it expires and press Create token.</ListItem>
          <ListItem>Copy the token straight away. You won&apos;t see it again.</ListItem>
        </List>
      </Stack>

      <Stack gap="xs" component="section" aria-labelledby="request-heading">
        <SectionTitle id="request-heading">Make a request</SectionTitle>
        <Text>
          The API is at <Code>{API_BASE_URL}</Code>. Send the token in the Authorization header. This asks which token
          you are using:
        </Text>
        <Code block className="ds-pre-wrap ds-break-anywhere">
          {CURL_EXAMPLE}
        </Code>
        <Text>Every answer has the data and the credits that go with it:</Text>
        <Code block className="ds-pre-wrap ds-break-anywhere">
          {ME_EXAMPLE}
        </Code>
        <Text size="sm">
          Show the attribution wherever you show the data, and ask for the same thing no more than once every{' '}
          {POLL_INTERVAL_SECONDS} seconds.
        </Text>
        <Text>
          <TextLink href={API_REFERENCE_PATH} underline="always">
            API reference
          </TextLink>
        </Text>
        <Text size="sm" c="dimmed">
          The reference is also an{' '}
          <TextLink href={OPENAPI_URL} external inline underline="always">
            OpenAPI document
          </TextLink>{' '}
          for tools that read one.
        </Text>
      </Stack>

      <Stack gap="xs" component="section" aria-labelledby="recipes-heading">
        <SectionTitle id="recipes-heading">Recipes</SectionTitle>
        <Text size="sm">Step-by-step guides, on GitHub.</Text>
        <List spacing="xs" listStyleType="none" withPadding={false}>
          {RECIPES.map((recipe) => (
            <ListItem key={recipe.url}>
              <TextLink href={recipe.url} external underline="always">
                {recipe.title}
              </TextLink>
              <Text size="sm" c="dimmed">
                {recipe.description}
              </Text>
            </ListItem>
          ))}
        </List>
      </Stack>

      <Stack gap="xs" component="section" aria-labelledby="unofficial-heading">
        <SectionTitle id="unofficial-heading">Independent and unofficial</SectionTitle>
        <Text size="sm">{NON_AFFILIATION}</Text>
      </Stack>
    </Stack>
  );
}
