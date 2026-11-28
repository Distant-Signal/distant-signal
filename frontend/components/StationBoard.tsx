import Link from 'next/link';
import {
  Button,
  Group,
  NativeSelect,
  Stack,
  Table,
  TableTbody,
  TableTd,
  TableTh,
  TableThead,
  TableTr,
  Text,
  VisuallyHidden,
} from '@mantine/core';
import { CheckIcon } from './CheckIcon';
import { NationalRailCredit } from './NationalRailCredit';
import { SectionTitle } from './SectionTitle';
import { TextLink } from './TextLink';
import { WarningIcon } from './WarningIcon';
import {
  boardView,
  showOperatorFilter,
  statusIcon,
  type BoardKind,
  type BoardPlatform,
  type BoardStatus,
  type BoardTime,
  type OperatorOption,
} from '@/lib/stationBoard';
import { stationArrivalsHref, stationDeparturesHref } from '@/lib/stationDepartures';
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

/** 30 minutes or more late: an octagon with an exclamation mark, a different
 * shape from the milder delays' triangle. */
function SevereIcon() {
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
      data-icon="severe"
      className={classes.statusIcon}
    >
      <polygon points="8.5 2.5 15.5 2.5 21.5 8.5 21.5 15.5 15.5 21.5 8.5 21.5 2.5 15.5 2.5 8.5" />
      <line x1="12" y1="7" x2="12" y2="13" />
      <line x1="12" y1="16.5" x2="12.01" y2="16.5" />
    </svg>
  );
}

function StatusIcon({ status }: { status: BoardStatus }) {
  // The wrappers give the shared icons the row's alignment; each is
  // decorative, the words beside it carry the meaning.
  switch (statusIcon(status)) {
    case 'check':
      return (
        <span className={classes.statusIcon}>
          <CheckIcon />
        </span>
      );
    case 'warning':
      return (
        <span className={classes.statusIcon}>
          <WarningIcon />
        </span>
      );
    case 'severe':
      return <SevereIcon />;
    case 'cross':
      return <CrossIcon />;
    case 'clock':
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
  const plain = status.spoken === status.text && status.marker === null;
  return (
    <div className={classes.status} data-tone={status.tone}>
      <span className={classes.statusLine}>
        <StatusIcon status={status} />
        {plain ? (
          status.text
        ) : (
          <>
            <span aria-hidden="true">
              {status.text}
              {status.marker && <span className={classes.nextDay}>{status.marker.short}</span>}
            </span>
            <VisuallyHidden>{status.spoken}</VisuallyHidden>
          </>
        )}
      </span>
      {status.detail !== null && (
        <span
          className={
            status.kind === 'cancelled' ? `${classes.statusDetail} ${classes.statusReason}` : classes.statusDetail
          }
        >
          {status.detail}
        </span>
      )}
    </div>
  );
}

/** The page address of one board: `?board=arrivals` for arrivals, none for
 * departures (the default), keeping the operator filter. */
function boardHref(crs: string, kind: BoardKind, operator: string | null): string {
  const params = new URLSearchParams();
  if (operator !== null) params.set('operator', operator);
  if (kind === 'arrivals') params.set('board', 'arrivals');
  const query = params.toString();
  return `/stations/${crs}${query === '' ? '' : `?${query}`}#board`;
}

/** Departures or arrivals: two real links, so it works without JavaScript. */
function BoardSwitch({ crs, kind, operator }: { crs: string; kind: BoardKind; operator: string | null }) {
  const options: { kind: BoardKind; label: string }[] = [
    { kind: 'departures', label: 'Departures' },
    { kind: 'arrivals', label: 'Arrivals' },
  ];
  return (
    <nav aria-label="Board type" className={classes.switch}>
      {options.map((option) => (
        <Link
          key={option.kind}
          href={boardHref(crs, option.kind, operator)}
          className={classes.switchLink}
          aria-current={option.kind === kind ? 'page' : undefined}
        >
          {option.label}
        </Link>
      ))}
    </nav>
  );
}

/** A station's next departures or arrivals, from the api's board. A real table: the
 * time, the destination (its operator beneath it on a phone, a column of
 * its own from `sm`), the platform in a box, and the status in words with
 * an icon. Server-rendered; `AutoRefresh` re-requests it with the page. */
export function StationBoard({
  board,
  crs,
  fallbackName,
  operator = null,
  operators = [],
}: {
  board: StationBoardData;
  crs: string;
  fallbackName: string;
  /** The ATOC code the board is filtered to, if any. */
  operator?: string | null;
  /** The operators the visitor can pick from (see `operatorOptions`). */
  operators?: OperatorOption[];
}) {
  const operatorLabel = operator === null ? null : (operators.find((o) => o.value === operator)?.label ?? operator);
  const view = boardView(board, fallbackName, operatorLabel);
  const headingId = 'station-board-heading';
  const credits = view.attribution.filter((text) => !text.includes('NationalRail'));
  return (
    <Stack gap="xs" id="board" component="section" aria-labelledby={headingId}>
      <SectionTitle id={headingId}>{view.heading}</SectionTitle>
      <BoardSwitch crs={crs} kind={view.kind} operator={operator} />
      {showOperatorFilter(operators, operator) && (
        // A plain GET form, so it works without JavaScript.
        <form method="get" action={`/stations/${crs}#board`}>
          {view.kind === 'arrivals' && <input type="hidden" name="board" value="arrivals" />}
          <Group align="flex-end" gap="xs" wrap="nowrap">
            <NativeSelect
              name="operator"
              label="Operator"
              data={[{ value: '', label: 'All operators' }, ...operators]}
              defaultValue={operator ?? ''}
              classNames={{ root: classes.filterField, input: classes.filterControl }}
            />
            <Button type="submit" variant="default" className={classes.filterControl}>
              Show
            </Button>
          </Group>
        </form>
      )}
      {view.rows.length === 0 ? (
        <Text c="dimmed">{view.empty}</Text>
      ) : (
        <Table className={classes.table} aria-label={view.heading}>
          <TableThead>
            <TableTr>
              <TableTh scope="col">Time</TableTh>
              <TableTh scope="col">{view.kind === 'arrivals' ? 'From' : 'Destination'}</TableTh>
              <TableTh scope="col" className={classes.operatorColumn}>
                Operator
              </TableTh>
              <TableTh scope="col">Platform</TableTh>
              <TableTh scope="col">Status</TableTh>
            </TableTr>
          </TableThead>
          <TableTbody>
            {view.rows.map((row) => (
              <TableTr key={row.key} className={row.status.kind === 'cancelled' ? classes.rowCancelled : undefined}>
                <TableTd className={classes.time}>
                  <span className={row.struck ? classes.struck : undefined}>
                    <Time time={row.scheduled} />
                  </span>
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
                <TableTd className={classes.statusCell}>
                  <StatusCell status={row.status} />
                </TableTd>
              </TableTr>
            ))}
          </TableTbody>
        </Table>
      )}
      <TextLink href={view.kind === 'arrivals' ? stationArrivalsHref(crs) : stationDeparturesHref(crs)}>
        Later trains
      </TextLink>
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
