import { Stack, Table, TableTbody, TableTd, TableTh, TableThead, TableTr, Text, VisuallyHidden } from '@mantine/core';
import { CheckIcon } from './CheckIcon';
import { NationalRailCredit } from './NationalRailCredit';
import { SectionTitle } from './SectionTitle';
import { TextLink } from './TextLink';
import { WarningIcon } from './WarningIcon';
import { boardView, type BoardPlatform, type BoardStatus, type BoardTime } from '@/lib/stationBoard';
import { stationDeparturesHref } from '@/lib/stationDepartures';
import type { StationBoard as StationBoardData } from '@/lib/types';
import classes from './StationBoard.module.css';

function ClockIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      data-icon="clock"
      className={classes.statusIcon}
    >
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15 14" />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      data-icon="cross"
      className={classes.statusIcon}
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function StatusIcon({ kind }: { kind: BoardStatus['kind'] }) {
  // The wrappers give the shared icons the row's alignment; each is
  // decorative, the words beside it carry the meaning.
  switch (kind) {
    case 'onTime':
      return (
        <span className={classes.statusIcon}>
          <CheckIcon />
        </span>
      );
    case 'delayed':
      return (
        <span className={classes.statusIcon}>
          <WarningIcon />
        </span>
      );
    case 'cancelled':
      return <CrossIcon />;
    case 'booked':
      return <ClockIcon />;
  }
}

function Time({ time }: { time: BoardTime }) {
  return (
    <>
      {time.text}
      {time.marker && (
        <>
          <span className={classes.nextDay} aria-hidden="true">
            {time.marker.short}
          </span>
          <VisuallyHidden> ({time.marker.spoken})</VisuallyHidden>
        </>
      )}
    </>
  );
}

function PlatformCell({ platform }: { platform: BoardPlatform }) {
  if (platform.kind === 'platform') {
    return (
      <>
        <span className={`${classes.platformBox} ${classes[platform.status]}`} aria-hidden="true">
          {platform.label}
        </span>
        <VisuallyHidden>{platform.spoken}</VisuallyHidden>
        {platform.note && (
          <span className={classes.platformNote} aria-hidden="true">
            {platform.note}
          </span>
        )}
      </>
    );
  }
  if (platform.kind === 'toBeAnnounced') {
    return (
      <Text size="xs" c="dimmed" component="span">
        {platform.text}
      </Text>
    );
  }
  return (
    <>
      <span aria-hidden="true">-</span>
      <VisuallyHidden>{platform.spoken}</VisuallyHidden>
    </>
  );
}

function StatusCell({ status }: { status: BoardStatus }) {
  const negative = status.kind === 'delayed' || status.kind === 'cancelled';
  return (
    <div className={classes.status}>
      <StatusIcon kind={status.kind} />
      <div>
        <span className={negative ? classes.statusNegative : undefined}>
          {status.text === status.spoken ? (
            status.text
          ) : (
            <>
              <span aria-hidden="true">{status.text}</span>
              <VisuallyHidden>{status.spoken}</VisuallyHidden>
            </>
          )}
        </span>
        {status.reason !== null && (
          <Text size="xs" c="dimmed" component="span" display="block">
            {status.reason}
          </Text>
        )}
      </div>
    </div>
  );
}

/** A station's next departures, from the api's board. A real table: the
 * time, the destination (its operator beneath it on a phone, a column of
 * its own from `sm`), the platform in a box, and the status in words with
 * an icon. Server-rendered; `AutoRefresh` re-requests it with the page. */
export function StationBoard({
  board,
  crs,
  fallbackName,
}: {
  board: StationBoardData;
  crs: string;
  fallbackName: string;
}) {
  const view = boardView(board, fallbackName);
  const headingId = 'station-board-heading';
  const credits = view.attribution.filter((text) => !text.includes('NationalRail'));
  return (
    <Stack gap="xs" id="board" component="section" aria-labelledby={headingId}>
      <SectionTitle id={headingId}>{view.heading}</SectionTitle>
      {view.rows.length === 0 ? (
        <Text c="dimmed">No more departures listed for today.</Text>
      ) : (
        <Table className={classes.table} aria-label={view.heading}>
          <TableThead>
            <TableTr>
              <TableTh scope="col">Time</TableTh>
              <TableTh scope="col">Destination</TableTh>
              <TableTh scope="col" className={classes.operatorColumn}>
                Operator
              </TableTh>
              <TableTh scope="col">Platform</TableTh>
              <TableTh scope="col">Status</TableTh>
            </TableTr>
          </TableThead>
          <TableTbody>
            {view.rows.map((row) => (
              <TableTr key={row.key}>
                <TableTd className={classes.time}>
                  <span className={row.struck ? classes.struck : undefined}>
                    <Time time={row.scheduled} />
                  </span>
                  {row.expected !== null && (
                    <span className={classes.expected}>
                      <span aria-hidden="true">Exp </span>
                      <VisuallyHidden>Expected </VisuallyHidden>
                      <Time time={row.expected} />
                    </span>
                  )}
                </TableTd>
                <TableTd className={classes.destination}>
                  {row.destination}
                  {row.operator !== null && (
                    <span className={`${classes.operator} ${classes.operatorInline}`}>{row.operator}</span>
                  )}
                </TableTd>
                <TableTd className={classes.operatorColumn}>
                  {row.operator !== null && <span className={classes.operator}>{row.operator}</span>}
                </TableTd>
                <TableTd>
                  <PlatformCell platform={row.platform} />
                </TableTd>
                <TableTd>
                  <StatusCell status={row.status} />
                </TableTd>
              </TableTr>
            ))}
          </TableTbody>
        </Table>
      )}
      <TextLink href={stationDeparturesHref(crs)}>Later trains</TextLink>
      <Text size="xs" c="dimmed">
        {view.updated}
      </Text>
      <NationalRailCredit />
      {credits.map((text) => (
        <Text key={text} size="xs" c="dimmed">
          {text}
        </Text>
      ))}
    </Stack>
  );
}
