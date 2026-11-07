import { addCalendarDays, londonToday } from './londonWallClock';
import { formatDate, formatTime } from './dateFormat';
import type { ItineraryLegBody } from './tripPlanSave';
import type { RegularPlan, RegularPlanOption } from './types';

/** One planned option as the suggestion card names it: "08:12 Woking to
 * London Waterloo", with its arrival and changes. */
export interface PlanOptionSummary {
  /** The first leg's booked departure, "08:12". */
  departs: string;
  arrives: string;
  from: string;
  to: string;
  changes: number;
}

export function summarisePlanOption(option: RegularPlanOption): PlanOptionSummary {
  const first = option.legs[0];
  const last = option.legs[option.legs.length - 1];
  const from = first ? (first.kind === 'train' ? (first.originName ?? first.originCrs) : first.originName) : null;
  const to = last
    ? last.kind === 'train'
      ? (last.destinationName ?? last.destinationCrs)
      : last.destinationName
    : null;
  return {
    departs: formatTime(option.departure),
    arrives: formatTime(option.arrival),
    from: from ?? 'your station',
    to: to ?? 'your destination',
    changes: option.changeCount,
  };
}

/** "08:12 Woking to London Waterloo". */
export function planOptionTitle(summary: PlanOptionSummary): string {
  return `${summary.departs} ${summary.from} to ${summary.to}`;
}

/** "Arrives 08:45", then ", 1 change" when it has any. */
export function planOptionDetail(summary: PlanOptionSummary): string {
  const changes = summary.changes === 0 ? '' : `, ${summary.changes} change${summary.changes === 1 ? '' : 's'}`;
  return `Arrives ${summary.arrives}${changes}`;
}

/** "today", "tomorrow" or "on 10 Nov 2026": the journey's date as the card
 * says it. */
export function planDayPhrase(serviceDate: string, today: string = londonToday()): string {
  if (serviceDate === today) return 'today';
  if (serviceDate === addCalendarDays(today, 1)) return 'tomorrow';
  return `on ${formatDate(`${serviceDate}T12:00:00Z`)}`;
}

/** Whether the card has something to offer: a suggestion that hasn't been
 * taken yet. */
export function showsSuggestion(plan: RegularPlan | null | undefined): plan is RegularPlan & {
  choice: RegularPlanOption;
} {
  return plan?.status === 'suggested' && plan.choice !== null;
}

/** A planned option's legs as `POST /Journeys/itinerary` (and `POST
 * /Journeys/{id}/move`) take them, leaving out what is unknown. */
export function planOptionLegBodies(option: RegularPlanOption): ItineraryLegBody[] {
  return option.legs.map((leg): ItineraryLegBody => {
    if (leg.kind === 'train') {
      return {
        trainUid: leg.trainUid,
        serviceDate: leg.serviceDate,
        ...(leg.originCrs ? { originCrs: leg.originCrs } : {}),
        ...(leg.destinationCrs ? { destinationCrs: leg.destinationCrs } : {}),
      };
    }
    return {
      kind: 'untracked',
      transitMode: leg.transitMode,
      ...(leg.originName ? { originName: leg.originName } : {}),
      ...(leg.destinationName ? { destinationName: leg.destinationName } : {}),
      ...(leg.lineName ? { lineName: leg.lineName } : {}),
      ...(leg.originStopId ? { originStopId: leg.originStopId } : {}),
      ...(leg.destinationStopId ? { destinationStopId: leg.destinationStopId } : {}),
      plannedDeparture: leg.plannedDeparture,
      plannedArrival: leg.plannedArrival,
    };
  });
}
