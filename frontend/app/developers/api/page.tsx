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
import { ApiFieldTable } from '@/components/ApiFieldTable';
import { READING_PAGE_WIDTH } from '@/components/LegalPage';
import { SectionTitle } from '@/components/SectionTitle';
import { TextLink } from '@/components/TextLink';
import {
  API_BASE_URL,
  attributionRows,
  errorRows,
  OPENAPI_URL,
  POLL_INTERVAL_SECONDS,
  RATE_LIMITS,
  routeDocs,
  routeGroups,
  STATUS_NOTES,
} from '@/lib/apiReference';
import { DEVELOPERS_PATH } from '@/lib/developerDocs';
import { pageMetadata } from '@/lib/pageMetadata';
import { RoutePath, RouteReference } from './RouteReference';

// Per request, as /attribution, so the footer's legal links read the
// runtime flags (OpenDataAttribution.tsx). The reference itself is built
// from lib/openapi-v1.json, with no fetch.
export const dynamic = 'force-dynamic';

const METADATA_TITLE = 'API reference';
const METADATA_DESCRIPTION =
  'Every route of the Distant Signal personal API: scopes, parameters, response fields and errors.';

export const metadata: Metadata = pageMetadata(METADATA_TITLE, METADATA_DESCRIPTION, { path: '/developers/api' });

/** "lines:read" to "group-lines-read". */
function groupHeadingId(key: string): string {
  return `group-${key.replace(/[^A-Za-z0-9]+/g, '-')}`;
}

/** The statuses explained under Errors, in order: every one a route
 * lists, plus the two any unknown path or method gets. */
function errorStatuses(): string[] {
  const listed = new Set(routeDocs().flatMap((route) => route.statuses));
  listed.add('404');
  listed.add('405');
  return [...listed].filter((status) => status !== '200').sort();
}

/** `/developers/api`: the personal API's reference, rendered at build
 * time from the committed OpenAPI document (`lib/apiReference.ts`). */
export default function ApiReferencePage() {
  const groups = routeGroups();
  return (
    <Stack p="lg" gap="lg" maw={READING_PAGE_WIDTH}>
      <TextLink href={DEVELOPERS_PATH} underline="always">
        Back to developers
      </TextLink>
      <Title order={1}>API reference</Title>
      <Text>
        Every route of the personal API. It reads your own Distant Signal data with a personal API token, and never
        changes anything. This page is made from the API&apos;s{' '}
        <TextLink href={OPENAPI_URL} external inline underline="always">
          OpenAPI document
        </TextLink>
        , which needs no token.
      </Text>

      <Stack gap="xs" component="nav" aria-labelledby="routes-heading">
        <SectionTitle id="routes-heading">Routes</SectionTitle>
        {groups.map((group) => (
          <Stack gap={4} key={group.key}>
            <Text size="sm" fw={600}>
              {group.title}
            </Text>
            <List size="sm" spacing={4} listStyleType="none" withPadding={false}>
              {group.routes.map((route) => (
                <ListItem key={route.id}>
                  <TextLink href={`#${route.id}`} size="sm">
                    <RoutePath route={route} />
                  </TextLink>
                </ListItem>
              ))}
            </List>
          </Stack>
        ))}
      </Stack>

      <Stack gap="xs" component="section" aria-labelledby="requests-heading">
        <SectionTitle id="requests-heading">Requests</SectionTitle>
        <Text>
          Send every request to <Code>{API_BASE_URL}</Code>, with the token in the Authorization header:
        </Text>
        <Code block className="ds-pre-wrap ds-break-anywhere">
          Authorization: Bearer dsp_your_token_here
        </Code>
        <Text size="sm">
          Every route answers GET and HEAD only. The token works only on this address, not on the website&apos;s own
          pages.
        </Text>
      </Stack>

      <Stack gap="xs" component="section" aria-labelledby="responses-heading">
        <SectionTitle id="responses-heading">Responses and attribution</SectionTitle>
        <Text>
          Every successful response is a JSON object with two fields: <Code>data</Code>, the answer, and{' '}
          <Code>attribution</Code>, the credits the data needs.
        </Text>
        <Text>
          <strong>Show the attribution wherever you show the data.</strong> The data comes from open feeds whose
          licences require their credit, word for word. Show each source&apos;s notice unchanged, and the statement that
          Distant Signal is independent and unofficial.
        </Text>
        <ApiFieldTable rows={attributionRows()} caption="Fields of attribution" />
        <Text size="sm">
          Times are date and time strings in RFC 3339 form, such as <Code>2026-09-17T08:42:00Z</Code>. Dates are{' '}
          <Code>YYYY-MM-DD</Code>. A field with &quot;or null&quot; is always sent but may be <Code>null</Code>; one
          marked &quot;May be left out&quot; can be missing.
        </Text>
      </Stack>

      <Stack gap="xs" component="section" aria-labelledby="polling-heading">
        <SectionTitle id="polling-heading">Polling and caching</SectionTitle>
        <Text>
          Ask for the same thing no more than once every {POLL_INTERVAL_SECONDS} seconds. Each response says so in its{' '}
          <Code>DS-Poll-Interval</Code> header, and its <Code>Cache-Control</Code> header says how long to keep it.
        </Text>
        <Text>
          Each response has an <Code>ETag</Code>. Send it back as <Code>If-None-Match</Code> and, if nothing has
          changed, you get a 304 with no body.
        </Text>
      </Stack>

      <Stack gap="xs" component="section" aria-labelledby="limits-heading">
        <SectionTitle id="limits-heading">Rate limits</SectionTitle>
        <Table verticalSpacing={6} horizontalSpacing="xs" aria-label="Rate limits">
          <TableThead>
            <TableTr>
              <TableTh>Limit</TableTh>
              <TableTh ta="right">Per minute</TableTh>
              <TableTh ta="right">Burst</TableTh>
            </TableTr>
          </TableThead>
          <TableTbody>
            {RATE_LIMITS.map((limit) => (
              <TableTr key={limit.label}>
                <TableTd>{limit.label}</TableTd>
                <TableTd ta="right">{limit.perMinute}</TableTd>
                <TableTd ta="right">{limit.burst}</TableTd>
              </TableTr>
            ))}
          </TableTbody>
        </Table>
        <Text size="sm">
          Over a limit, you get a 429 with a <Code>Retry-After</Code> header: wait that many seconds before the next
          request.
        </Text>
      </Stack>

      <Stack gap="xs" component="section" aria-labelledby="errors-heading">
        <SectionTitle id="errors-heading">Errors</SectionTitle>
        <Text>
          An error is a JSON object with a stable <Code>error</Code> code and a <Code>message</Code>. It has no
          attribution.
        </Text>
        <ApiFieldTable rows={errorRows()} caption="Fields of an error" />
        <Table verticalSpacing={6} horizontalSpacing="xs" layout="fixed" aria-label="Status codes">
          <TableThead>
            <TableTr>
              <TableTh w="30%">Status</TableTh>
              <TableTh>Meaning</TableTh>
            </TableTr>
          </TableThead>
          <TableTbody>
            {errorStatuses().map((status) => {
              const note = STATUS_NOTES[status];
              return (
                <TableTr key={status} id={`status-${status}`}>
                  <TableTd>
                    <Text size="sm" fw={600}>
                      {status} {note?.title}
                    </Text>
                  </TableTd>
                  <TableTd>
                    <Text size="sm">{note?.text}</Text>
                    {note?.code && (
                      <Text size="xs" c="dimmed">
                        Error code: <Code>{note.code}</Code>
                      </Text>
                    )}
                  </TableTd>
                </TableTr>
              );
            })}
          </TableTbody>
        </Table>
      </Stack>

      <Stack gap="xs" component="section" aria-labelledby="tfl-shaped-objects">
        <SectionTitle id="tfl-shaped-objects">TfL-shaped objects</SectionTitle>
        <Text>
          Line status, station disruption and departures come in the shape of TfL&apos;s Unified API, the same objects
          the website reads. The OpenAPI document leaves their fields open on purpose: it says only that each item is an
          object.
        </Text>
        <Text size="sm">
          Read the fields you need and ignore the rest, because new ones can appear. A line&apos;s status, for example,
          is in <Code>lineStatuses[].statusSeverityDescription</Code>.
        </Text>
      </Stack>

      {groups.map((group) => (
        <Stack gap="md" component="section" aria-labelledby={groupHeadingId(group.key)} key={group.key}>
          <Stack gap={4}>
            <SectionTitle id={groupHeadingId(group.key)}>{group.title}</SectionTitle>
            {group.scope && (
              <Text size="sm" c="dimmed">
                Scope: <Code>{group.scope}</Code>
              </Text>
            )}
          </Stack>
          {group.routes.map((route) => (
            <RouteReference key={route.id} route={route} />
          ))}
        </Stack>
      ))}

      <Text size="sm">
        <TextLink href={DEVELOPERS_PATH} inline>
          Back to developers
        </TextLink>
      </Text>
    </Stack>
  );
}
