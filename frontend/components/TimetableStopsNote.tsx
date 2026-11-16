import { Alert, Text } from '@mantine/core';
import { isTimetableOnly } from '@/lib/serviceMode';
import type { PublicTrainState } from '@/lib/types';

/** Why a train page has a note about its stops. One kind today: a train
 * running live that has no timetabled stops at all (added at short notice,
 * so it has no published timetable). A later kind, for stops that come from
 * the live feeds rather than the timetable, adds a member here, a rule in
 * `timetableStopsNoteKind` and its copy in `TIMETABLE_STOPS_NOTES`. */
export type TimetableStopsNoteKind = 'noStops';

/** The copy for each kind, exported so the tests can assert on it without
 * duplicating it. */
export const TIMETABLE_STOPS_NOTES: Record<TimetableStopsNoteKind, { title: string; message: string }> = {
  noStops: {
    title: 'Timetable not available yet',
    message:
      "This train was added at short notice, so we don't have its stops yet. Its live position and delay are still shown.",
  },
};

export type TimetableStopsNoteFields = Pick<
  PublicTrainState,
  'journeyStops' | 'status' | 'trackingPhase' | 'serviceMode' | 'liveTracking'
>;

/** Whether the train has reported running: live, on its way or arrived. A
 * train waiting for its first report, or one that is cancelled, has no live
 * position to show in place of its stops. */
function hasLiveRunning(train: TimetableStopsNoteFields): boolean {
  if (isTimetableOnly(train)) return false;
  return train.trackingPhase === 'live' || train.status === 'en_route' || train.status === 'completed';
}

/** The note a train page shows about its stops, or `null` for none: every
 * train with stops, and every train without live running (its page keeps
 * its own waiting or "not in the timetable" copy). */
export function timetableStopsNoteKind(train: TimetableStopsNoteFields): TimetableStopsNoteKind | null {
  const hasStops = (train.journeyStops?.length ?? 0) > 0;
  if (hasStops || !hasLiveRunning(train)) return null;
  return 'noStops';
}

/** "Timetable not available yet", beside `ProvisionalTimetableNote` on the
 * train page: says why a live train shows no stops. Yellow, as partial data
 * (docs/style-guide.md, "Alerts"); `role="note"`, since it is standing
 * information, not something to announce on every refresh. */
export function TimetableStopsNote({ train }: { train: TimetableStopsNoteFields }) {
  const kind = timetableStopsNoteKind(train);
  if (kind === null) return null;
  const { title, message } = TIMETABLE_STOPS_NOTES[kind];
  return (
    <Alert color="yellow" variant="light" role="note" title={title} data-timetable-stops-note={kind}>
      <Text size="sm">{message}</Text>
    </Alert>
  );
}
