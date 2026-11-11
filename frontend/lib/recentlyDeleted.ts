import { relativeTime } from './relativeTime';
import type { RecentlyDeletedJourney, RestoredLeg } from './types';

/** `delegated_deletions.client` of the visitor's own delete (ds-api's
 * `data::recently_deleted::WEB`); any other value is a connected app. */
export const OWN_DELETE_CLIENT = 'web';

/** The path of the Recently deleted page. */
export const RECENTLY_DELETED_HREF = '/journeys/recently-deleted';

/** "Deleted 2 days ago", "Deleted by a connected app 3 hr ago". */
export function deletedLine(item: RecentlyDeletedJourney, now: Date): string {
  const when = relativeTime(new Date(item.deletedAt), now);
  return item.client === OWN_DELETE_CLIENT ? `Deleted ${when}.` : `Deleted by a connected app ${when}.`;
}

/** What "Save again" could not bring back, one sentence per leg that needs
 * the visitor (ds-api's `routes::recently_deleted`). A leg that came back
 * as it was says nothing. */
export function restoreNotes(legs: readonly RestoredLeg[]): string[] {
  const notes: string[] = [];
  for (const { leg, outcome, reason } of legs) {
    const name = `Leg ${leg}`;
    if (outcome === 'without_train') {
      switch (reason) {
        case 'train_gone':
          notes.push(`${name}'s train is no longer available, so pick a train for it.`);
          break;
        case 'train_changed':
          notes.push(`${name}'s train no longer stops at those stations, so pick another.`);
          break;
        case 'too_far_ahead':
          notes.push(`${name}'s train is too far ahead to track yet, so pick it nearer the day.`);
          break;
        default:
          notes.push(`${name} has no train yet, so pick one.`);
      }
    } else if (outcome === 'left_out') {
      notes.push(
        reason === 'too_old'
          ? `${name} was more than a week ago, so it was left out.`
          : `${name} couldn't be saved again, so it was left out.`,
      );
    }
  }
  return notes;
}
