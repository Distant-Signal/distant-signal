import { Stack, VisuallyHidden } from '@mantine/core';
import { LastUpdated } from '@/components/LastUpdated';
import { ServiceListNotice, ServiceRowList } from '@/components/ServiceRow';
import { describeFailure } from '@/lib/failure';
import { departureRows, type IrelandBoard } from '@/lib/ireland';
import { delayLabel, type DelayTone } from '@/lib/serviceStatus';
import classes from './ServiceRow.module.css';

const TONE_CLASS: Record<DelayTone, string | undefined> = {
  late: classes.late,
  early: classes.early,
  onTime: classes.onTime,
};

/** An Iarnród Éireann station's live board, laid out like the line pages'
 * service rows: the time it is expected to leave, where it goes and how
 * late it is, then a dimmed line with the timetabled time (when different),
 * where it started and its train code. No row links anywhere: there is no
 * train page for an Irish train. The feed's own status words ("En Route")
 * are left out; the delay says the same in our words.
 *
 * `board` is `null` when the station has no live board, and `'failed'`
 * when it couldn't be loaded. A board says when it was polled, once,
 * above its rows. */
export function IrelandDepartureBoard({ board }: { board: IrelandBoard | null | 'failed' }) {
  if (board === 'failed') {
    return <ServiceListNotice>{describeFailure('load', 'departures')}</ServiceListNotice>;
  }
  if (board === null) {
    return <ServiceListNotice>We don&apos;t have live departures for this station.</ServiceListNotice>;
  }
  const rows = departureRows(board.departures);
  const updated = board.polledAt ? <LastUpdated timestamp={board.polledAt} /> : null;
  if (rows.length === 0) {
    return (
      <Stack gap="xs">
        {updated}
        <ServiceListNotice>No departures listed right now.</ServiceListNotice>
      </Stack>
    );
  }
  return (
    <Stack gap="xs">
      {updated}
      <ServiceRowList aria-label="Live departures">
        {rows.map((row) => {
          const delay = delayLabel(row.lateMinutes);
          const details = [
            row.scheduled ? `Timetabled ${row.scheduled}` : null,
            row.origin ? `From ${row.origin}` : null,
            row.trainCode ? `Train code ${row.trainCode}` : null,
          ]
            .filter(Boolean)
            .join(' · ');
          return (
            <li key={row.key} data-train-code={row.trainCode}>
              <div className={classes.row} data-details={details ? true : undefined}>
                <span className={classes.time}>{row.time}</span>{' '}
                <span className={classes.dest}>
                  <VisuallyHidden>to </VisuallyHidden>
                  {row.destination}
                </span>{' '}
                <span className={`${classes.status} ${TONE_CLASS[delay.tone] ?? ''}`}>{delay.text}</span>{' '}
                {details && (
                  <>
                    <VisuallyHidden>. </VisuallyHidden>
                    <span className={classes.details}>{details}</span>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ServiceRowList>
    </Stack>
  );
}
