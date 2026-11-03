import { Card, Code, Stack, Table, TableTbody, TableTd, TableTh, TableThead, TableTr, Text } from '@mantine/core';
import { Fragment } from 'react';
import { ApiFieldsDisclosure } from '@/components/ApiFieldsDisclosure';
import { ApiFieldTable, ApiTypeText } from '@/components/ApiFieldTable';
import { SectionTitle } from '@/components/SectionTitle';
import { TextLink } from '@/components/TextLink';
import type { RouteAccess, RouteDoc } from '@/lib/apiReference';

/** A field table this long or shorter is shown open; a longer one goes
 * behind a disclosure, so the page stays scannable. */
const OPEN_FIELD_ROWS = 15;

/** Who may call it. A public route says nothing: its group heading,
 * "No token needed", already does. */
function accessText(access: RouteAccess) {
  switch (access.kind) {
    case 'public':
      return null;
    case 'anyToken':
      return <Text size="sm">Needs any token, whatever its scopes.</Text>;
    case 'scope':
      return (
        <Text size="sm">
          Needs a token with <Code>{access.scope}</Code>.
        </Text>
      );
  }
}

function ResponseData({ route }: { route: RouteDoc }) {
  const label = `${route.method} ${route.path}`;
  switch (route.data.kind) {
    case 'document':
      return (
        <Text size="sm">The OpenAPI 3.1 document itself, as JSON. It is not wrapped in data and attribution.</Text>
      );
    case 'open':
      return (
        <Text size="sm">
          <Code>data</Code> is an {route.data.type.label} in TfL&apos;s shape, whose fields are left open. See{' '}
          <TextLink href="#tfl-shaped-objects" inline>
            TfL-shaped objects
          </TextLink>
          .
        </Text>
      );
    case 'fields': {
      const { rows, type } = route.data;
      const array = type.label.startsWith('array');
      const intro = (
        <Text size="sm">
          <Code>data</Code> is {array ? 'an array of objects, each with these fields' : 'an object with these fields'}.
        </Text>
      );
      const table = <ApiFieldTable rows={rows} caption={`Response fields of ${label}`} />;
      return (
        <Stack gap="xs">
          {intro}
          {rows.length <= OPEN_FIELD_ROWS ? (
            table
          ) : (
            <ApiFieldsDisclosure label={`Response fields (${rows.length})`} qualifier={label}>
              {table}
            </ApiFieldsDisclosure>
          )}
        </Stack>
      );
    }
  }
}

/** "GET /v1/me" in monospace, free to wrap after each slash rather than
 * mid-word on a phone. */
export function RoutePath({ route }: { route: RouteDoc }) {
  const parts = route.path.split('/');
  return (
    <Text span inherit ff="monospace" className="ds-break-anywhere">
      {route.method}{' '}
      {parts.map((part, index) => (
        <Fragment key={index}>
          {index > 0 && (
            <>
              /<wbr />
            </>
          )}
          {part}
        </Fragment>
      ))}
    </Text>
  );
}

/** One route of the personal API, from the OpenAPI document. */
export function RouteReference({ route }: { route: RouteDoc }) {
  const headingId = `${route.id}-heading`;
  return (
    <Card withBorder component="section" aria-labelledby={headingId} id={route.id}>
      <Stack gap="sm">
        <SectionTitle order={3} id={headingId}>
          <RoutePath route={route} />
        </SectionTitle>
        <Text>{route.summary}</Text>
        {accessText(route.access)}
        {route.cacheControl && (
          <Text size="sm">
            Cache-Control: <Code>{route.cacheControl}</Code>
          </Text>
        )}
        <Text size="sm">
          Status codes:{' '}
          {route.statuses.map((status, index) => (
            <span key={status}>
              {index > 0 && ', '}
              {status === '200' ? (
                status
              ) : (
                <TextLink href={`#status-${status}`} inline>
                  {status}
                </TextLink>
              )}
            </span>
          ))}
        </Text>
        {route.parameters.length > 0 && (
          <Stack gap={4}>
            <SectionTitle order={4}>Parameters</SectionTitle>
            <Table
              verticalSpacing={6}
              horizontalSpacing="xs"
              layout="fixed"
              aria-label={`Parameters of ${route.method} ${route.path}`}
            >
              <TableThead>
                <TableTr>
                  <TableTh w="40%">Name</TableTh>
                  <TableTh>Description</TableTh>
                </TableTr>
              </TableThead>
              <TableTbody>
                {route.parameters.map((parameter) => (
                  <TableTr key={`${parameter.location}-${parameter.name}`}>
                    <TableTd className="ds-break-anywhere">
                      <Text size="sm" ff="monospace" fw={600}>
                        {parameter.name}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {parameter.location === 'path' ? 'In the path' : 'Query'}
                        {parameter.required ? ', required' : ', optional'}, {parameter.type.label}
                        {parameter.type.nullable && ' or null'}
                        {parameter.defaultValue !== null && `, default ${parameter.defaultValue}`}
                      </Text>
                    </TableTd>
                    <TableTd>
                      {parameter.description && <Text size="sm">{parameter.description}</Text>}
                      {parameter.type.values.length > 0 && <ApiTypeText type={parameter.type} />}
                    </TableTd>
                  </TableTr>
                ))}
              </TableTbody>
            </Table>
          </Stack>
        )}
        <Stack gap={4}>
          <SectionTitle order={4}>Response</SectionTitle>
          <ResponseData route={route} />
        </Stack>
      </Stack>
    </Card>
  );
}
