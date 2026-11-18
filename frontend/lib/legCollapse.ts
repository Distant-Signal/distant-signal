import { isUntrackedLeg, untrackedLegPlaceNames } from './untrackedLeg';
import { transferLegMode } from './displayLabels';
import { isTriggerLeg } from './publicId';
import type { JourneyLegDetail, TripPlanLeg } from './types';

/** One row of a leg list once inert legs are folded away: a leg shown as it
 * is, or a run of consecutive inert legs behind one disclosure (DS-590). */
export type LegGroup<T> = { kind: 'leg'; leg: T; index: number } | { kind: 'collapsed'; legs: T[]; startIndex: number };

/** Folds each run of consecutive collapsible legs into one `collapsed`
 * group, in order, and leaves every other leg as a `leg` group. `index` and
 * `startIndex` are positions in `legs`.
 *
 * A list with no leg to show (every leg collapsible, say a journey of one
 * walk) is never folded: hiding the whole journey behind a disclosure would
 * leave nothing on the page, so each leg stays a `leg` group. */
export function groupCollapsibleLegs<T>(
  legs: readonly T[],
  isCollapsible: (leg: T, index: number) => boolean,
): LegGroup<T>[] {
  const flags = legs.map((leg, index) => isCollapsible(leg, index));
  if (flags.every(Boolean)) return legs.map((leg, index) => ({ kind: 'leg', leg, index }));
  const groups: LegGroup<T>[] = [];
  legs.forEach((leg, index) => {
    const last = groups.at(-1);
    if (!flags[index]) {
      groups.push({ kind: 'leg', leg, index });
    } else if (last?.kind === 'collapsed') {
      last.legs.push(leg);
    } else {
      groups.push({ kind: 'collapsed', legs: [leg], startIndex: index });
    }
  });
  return groups;
}

/** The open break's trigger leg ids, as `isTriggerLeg` reads them. */
interface BreakTrigger {
  triggerLegId: number | null;
  triggerLegPublicId: string | null;
}

/** A saved journey leg that is only a walk or a transfer, with nothing for
 * the traveller to act on, so the journey page folds it away.
 *
 * Collapsible: an untracked leg whose mode is `walk` or `transfer`. Not
 * collapsible, so always shown: a leg with a ticket or a Delay Repay claim,
 * a leg with a timetable (a ride, not a walk), a leg in progress (the one
 * the traveller is on now), and the open break's trigger leg. Train legs,
 * open (unmatched) window legs and every other untracked mode (Tube, bus,
 * tram, ferry, taxi, cycle, a train not tracked) stay shown too. */
export function isInertWalkLeg(leg: JourneyLegDetail, openBreak: BreakTrigger | null = null): boolean {
  if (!isUntrackedLeg(leg)) return false;
  if (leg.transitMode !== 'walk' && leg.transitMode !== 'transfer') return false;
  if (leg.ticket || leg.delayRepay || leg.timetable) return false;
  if (leg.untrackedStatus === 'inProgress') return false;
  if (openBreak && isTriggerLeg(leg, openBreak)) return false;
  return true;
}

/** Whole minutes between two ISO instants, or `null` when either is
 * missing or the leg runs backwards. */
function legMinutes(leg: Pick<JourneyLegDetail, 'plannedDeparture' | 'plannedArrival'>): number | null {
  if (!leg.plannedDeparture || !leg.plannedArrival) return null;
  const ms = Date.parse(leg.plannedArrival) - Date.parse(leg.plannedDeparture);
  return Number.isNaN(ms) || ms < 0 ? null : Math.round(ms / 60000);
}

/** The words for a run of walks and transfers: "Walk", "Transfer" or "Walk
 * and transfer". */
function modesPhrase(modes: readonly (string | null)[]): string {
  const walks = modes.some((mode) => mode === 'walk');
  const transfers = modes.some((mode) => mode !== 'walk');
  if (walks && transfers) return 'Walk and transfer';
  return walks ? 'Walk' : 'Transfer';
}

/** The collapsed row's label: "Walk to Victoria, 6 min". The place and the
 * minutes are left out when not known. */
export function collapsedLegsLabel({
  modes,
  to,
  minutes,
}: {
  modes: readonly (string | null)[];
  to: string | null;
  minutes: number | null;
}): string {
  const place = to ? ` to ${to}` : '';
  const time = minutes === null ? '' : `, ${minutes} min`;
  return `${modesPhrase(modes)}${place}${time}`;
}

/** The label for a run of folded journey legs. `neighbours` are the legs
 * either side of the run, which say what kind of station the last leg's end
 * is when two names read alike. The minutes are the legs' planned times
 * added up, left out when any leg has none. */
export function journeyCollapsedLabel(
  legs: readonly JourneyLegDetail[],
  neighbours: { previous?: JourneyLegDetail | undefined; next?: JourneyLegDetail | undefined } = {},
): string {
  const last = legs.at(-1);
  const to = last
    ? (untrackedLegPlaceNames(last, { previous: legs.at(-2) ?? neighbours.previous, next: neighbours.next })
        .destinationName ?? null)
    : null;
  const each = legs.map(legMinutes);
  const minutes = each.every((value): value is number => value !== null)
    ? each.reduce((sum, value) => sum + value, 0)
    : null;
  return collapsedLegsLabel({ modes: legs.map((leg) => leg.transitMode), to, minutes });
}

type TransferLeg = Extract<TripPlanLeg, { kind: 'transfer' }>;

/** A planner leg that is only a walk or a transfer between stations (or a
 * change within one), which an option card folds away: a `transfer` leg
 * whose mode, a Tube hop's included, is `WALK` or `TRANSFER`. A Tube, DLR or
 * other ride, an access leg to a TfL stop, and every train, tram or bus
 * leg stay shown. */
export function isInertTransfer(leg: TripPlanLeg): leg is TransferLeg {
  if (leg.kind !== 'transfer' || leg.access) return false;
  const mode = transferLegMode(leg).toUpperCase();
  return mode === 'WALK' || mode === 'TRANSFER';
}

/** The label for a run of folded planner legs: "Walk to Euston, 6 min".
 * `stationNames` resolves a CRS to its name (the code stands in when it
 * has none). */
export function transferRunLabel(allLegs: readonly TripPlanLeg[], stationNames: ReadonlyMap<string, string>): string {
  const legs = allLegs.filter((leg): leg is TransferLeg => leg.kind === 'transfer');
  const last = legs.at(-1);
  const code = last?.destinationCrs ?? null;
  const to = code ? (stationNames.get(code) ?? code) : (last?.destinationStop?.name ?? null);
  return collapsedLegsLabel({
    modes: legs.map((leg) => (transferLegMode(leg).toUpperCase() === 'WALK' ? 'walk' : 'transfer')),
    to,
    minutes: legs.reduce((sum, leg) => sum + leg.minutes, 0),
  });
}
