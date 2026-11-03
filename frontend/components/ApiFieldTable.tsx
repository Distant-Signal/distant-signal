import { Fragment } from 'react';
import { Code, Table, TableTbody, TableTd, TableTh, TableThead, TableTr, Text } from '@mantine/core';
import type { FieldRow, TypeInfo } from '@/lib/apiReference';

/** "string or null", with the values a string can take under it. */
export function ApiTypeText({ type }: { type: TypeInfo }) {
  return (
    <>
      <Text size="sm">
        {type.label}
        {type.nullable && ' or null'}
      </Text>
      {type.values.length > 0 && (
        <Text size="xs" c="dimmed" className="ds-break-anywhere">
          One of:{' '}
          {type.values.map((value, index) => (
            <span key={value}>
              {index > 0 && ', '}
              <Code>{value}</Code>
            </span>
          ))}
        </Text>
      )}
    </>
  );
}

/** A response's fields (`lib/apiReference.ts`'s `fieldRows`): each by its
 * whole path, the part above it dimmed, so a nested field reads in
 * context on a phone without indenting. A long path wraps after a dot.
 * Server-rendered. */
export function ApiFieldTable({ rows, caption }: { rows: readonly FieldRow[]; caption: string }) {
  return (
    <Table verticalSpacing={6} horizontalSpacing="xs" layout="fixed" aria-label={caption}>
      <TableThead>
        <TableTr>
          <TableTh w="55%">Field</TableTh>
          <TableTh>Type</TableTh>
        </TableTr>
      </TableThead>
      <TableTbody>
        {rows.map((row) => (
          <TableTr key={row.path}>
            <TableTd className="ds-break-anywhere">
              <Text size="sm" ff="monospace">
                {row.parent && (
                  <Text span inherit c="dimmed">
                    {row.parent.split('.').map((part, index) => (
                      <Fragment key={index}>
                        {index > 0 && (
                          <>
                            .<wbr />
                          </>
                        )}
                        {part}
                      </Fragment>
                    ))}
                  </Text>
                )}
                <Text span inherit fw={600}>
                  {row.name}
                </Text>
              </Text>
            </TableTd>
            <TableTd>
              <ApiTypeText type={row.type} />
              {!row.required && (
                <Text size="xs" c="dimmed">
                  May be left out
                </Text>
              )}
            </TableTd>
          </TableTr>
        ))}
      </TableTbody>
    </Table>
  );
}
