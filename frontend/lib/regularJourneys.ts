import dayjs from 'dayjs';
import { LONDON_TZ, londonToday } from './londonWallClock';
import { operatorFilterParam, setListParams, trainLegsForTracking, type TripPlanQuery } from './tripPlan';
import { itineraryLegsForSaving } from './tripPlanSave';
import type {
  PlanOptions,
  JourneyLegDetail,
  JourneyTemplateListItem,
  TemplateTarget,
  TripPlanItinerary,
  UsualItinerary,
  UsualItineraryLeg,
} from './types';

/** Regular journeys (docs/superpowers/specs/2026-11-06-regular-journeys-design.md):
 * a journey template with a target time, its plan options and the usual
 * train. The UI says "regular journey"; the API keeps `JourneyTemplate`. */

/** Where the pages live (§4.4). `/journeys/templates` redirects here. */
export const REGULAR_JOURNEYS_HREF = '/journeys/regular';
export const NEW_REGULAR_JOURNEY_HREF = '/journeys/regular/new';

export function regularJourneyHref(id: number): string {
  return `${REGULAR_JOURNEYS_HREF}/${id}`;
}

/** "leave after 07:45" or "arrive by 08:30" (a target's own words, lower
 * case, to follow a route). The day after is "arrive by 00:30 the next
 * day". */
export function targetLabel(target: TemplateTarget): string {
  const time = target.time.slice(0, 5);
  const words = target.kind === 'arrive_by' ? `arrive by ${time}` : `leave after ${time}`;
  return target.dayOffset === 1 ? `${words} the next day` : words;
}

/** A London instant as a clock time and the days after `date` it falls. */
function clockOn(instant: dayjs.Dayjs, date: string): { time: string; dayOffset: number } {
  const local = instant.tz(LONDON_TZ);
  const offset = Math.max(0, Math.round(local.startOf('day').diff(dayjs.tz(date, LONDON_TZ), 'day', true)));
  return { time: local.format('HH:mm'), dayOffset: Math.min(offset, 1) };
}

/** `HH:MM` from a planner time (`HH:MM` or `HH:MM:SS`). */
function hhmm(time: string): string {
  return time.slice(0, 5);
}

const ATOC_CODE = /^[A-Z0-9]{2}$/;

/** The chosen itineraries as a usual itinerary (§4.1): each train leg's
 * UID, stations, operator code and booked clock times (the public time,
 * else the working one), with the date it was planned on so the api can
 * check its calls; each Tube, walk, bus or tram leg's mode, places and
 * minutes. The legs are the ones "Track this journey" saves
 * (`itineraryLegsForSaving`), in the same order. */
export function usualItineraryFromPlan(
  itineraries: TripPlanItinerary[],
  nameFor: (code: string) => string | undefined,
): UsualItinerary {
  const bodies = itineraryLegsForSaving(itineraries, nameFor);
  const trains = trainLegsForTracking(itineraries);
  let trainIndex = 0;
  const legs: UsualItineraryLeg[] = [];
  for (const body of bodies) {
    if ('trainUid' in body) {
      const train = trains[trainIndex];
      trainIndex += 1;
      if (!train) continue;
      const departs = train.publicDeparture ?? train.scheduledDeparture;
      const departsOffset = train.publicDeparture ? (train.publicDepartureDayOffset ?? 0) : train.departureDayOffset;
      legs.push({
        kind: 'train',
        trainUid: body.trainUid,
        serviceDate: body.serviceDate,
        atocCode: train.operator && ATOC_CODE.test(train.operator) ? train.operator : null,
        originCrs: body.originCrs ?? null,
        destinationCrs: body.destinationCrs ?? null,
        departs: hhmm(departs),
        departsDayOffset: Math.min(departsOffset, 1),
        arrives: hhmm(train.scheduledArrival),
        arrivesDayOffset: Math.min(train.arrivalDayOffset, 1),
        transitMode: null,
        originName: null,
        destinationName: null,
        lineName: null,
        minutes: null,
      });
      continue;
    }
    const start = dayjs(body.plannedDeparture);
    const end = dayjs(body.plannedArrival);
    const date = start.tz(LONDON_TZ).format('YYYY-MM-DD');
    const departs = clockOn(start, date);
    const arrives = clockOn(end, date);
    legs.push({
      kind: 'untracked',
      trainUid: null,
      serviceDate: null,
      atocCode: null,
      originCrs: null,
      destinationCrs: null,
      departs: departs.time,
      departsDayOffset: departs.dayOffset,
      arrives: arrives.time,
      arrivesDayOffset: arrives.dayOffset,
      transitMode: body.transitMode,
      originName: body.originName ?? null,
      destinationName: body.destinationName ?? null,
      lineName: body.lineName ?? null,
      minutes: Math.max(0, Math.round(end.diff(start, 'minute', true))),
    });
  }
  return { legs };
}

/** The usual itinerary's train legs, in order. */
export function usualTrainLegs(itinerary: UsualItinerary | null | undefined): UsualItineraryLeg[] {
  return (itinerary?.legs ?? []).filter((leg) => leg.kind === 'train');
}

/** "07:48 Woking to London Waterloo" for the usual itinerary's first
 * train (`lib/trainName.ts`'s naming), or `null` without one. */
export function usualTrainSummary(
  itinerary: UsualItinerary | null | undefined,
  nameFor: (code: string) => string | undefined,
): string | null {
  const first = usualTrainLegs(itinerary)[0];
  if (!first?.departs) return null;
  const place = (code: string | null | undefined) => (code ? (nameFor(code) ?? code) : null);
  const from = place(first.originCrs);
  const to = place(usualTrainLegs(itinerary).at(-1)?.destinationCrs ?? null);
  return [first.departs.slice(0, 5), from && to ? `${from} to ${to}` : (from ?? to)].filter(Boolean).join(' ');
}

/** What "Make this a regular journey" on /plan hands the form: the route,
 * the time bound, the plan's options and the picked itinerary. Kept in
 * this tab's session storage for the one navigation (no account data). */
export interface RegularJourneyDraft {
  originCrs: string;
  destinationCrs: string;
  target: TemplateTarget;
  planOptions: PlanOptions | null;
  usualItinerary: UsualItinerary;
  /** The usual train as the form shows it. */
  usualSummary: string | null;
}

const DRAFT_KEY = 'ds:regular-journey-draft';

export function saveRegularJourneyDraft(draft: RegularJourneyDraft): boolean {
  try {
    window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

/** The draft, once: reading it removes it. `null` when there is none or
 * storage is unavailable. */
export function takeRegularJourneyDraft(): RegularJourneyDraft | null {
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY);
    if (raw === null) return null;
    window.sessionStorage.removeItem(DRAFT_KEY);
    const draft = JSON.parse(raw) as RegularJourneyDraft;
    return typeof draft.originCrs === 'string' && Array.isArray(draft.usualItinerary.legs) ? draft : null;
  } catch {
    return null;
  }
}

/** The list's cards, in the list's order: a pair once, where its earlier
 * template comes, as `[outbound, return]` (the outbound is the one made
 * first); anything else alone. */
export function regularJourneyCards(
  templates: JourneyTemplateListItem[],
): ([JourneyTemplateListItem] | [JourneyTemplateListItem, JourneyTemplateListItem])[] {
  const byId = new Map(templates.map((template) => [template.id, template]));
  const placed = new Set<number>();
  const cards: ([JourneyTemplateListItem] | [JourneyTemplateListItem, JourneyTemplateListItem])[] = [];
  for (const template of templates) {
    if (placed.has(template.id)) continue;
    const pair = template.pairedTemplateId === null ? undefined : byId.get(template.pairedTemplateId);
    placed.add(template.id);
    if (pair?.pairedTemplateId === template.id && !placed.has(pair.id)) {
      placed.add(pair.id);
      cards.push(template.id < pair.id ? [template, pair] : [pair, template]);
    } else {
      cards.push([template]);
    }
  }
  return cards;
}

/** A search's options as a regular journey keeps them (`planOptions`,
 * `/Trips/plan`'s own parameters, via `setListParams` and
 * `operatorFilterParam`), or `null` when it has none. */
export function planOptionsFromQuery(query: TripPlanQuery): PlanOptions | null {
  const params = new URLSearchParams();
  setListParams(params, query);
  const operator = operatorFilterParam(query);
  const options: PlanOptions = {
    ...(params.get('waypoints') ? { waypoints: params.get('waypoints') } : {}),
    ...(params.get('via') ? { via: params.get('via') } : {}),
    ...(params.get('avoid') ? { avoid: params.get('avoid') } : {}),
    ...(params.get('avoidStop') ? { avoidStop: params.get('avoidStop') } : {}),
    ...(params.get('avoidChange') ? { avoidChange: params.get('avoidChange') } : {}),
    ...(query.maxChanges !== undefined ? { maxChanges: query.maxChanges } : {}),
    ...(operator ? { [operator[0]]: operator[1] } : {}),
  };
  return Object.keys(options).length > 0 ? options : null;
}

/** A regular journey's options back as a search's (the inverse of
 * [`planOptionsFromQuery`]), for "Find trains". */
export function queryOptionsFromPlan(options: PlanOptions | null | undefined): Partial<TripPlanQuery> {
  if (!options) return {};
  const list = (value: string | null | undefined) => (value ? value.split(',').filter(Boolean) : undefined);
  const operator =
    options.operator != null
      ? (['only', options.operator] as const)
      : options.avoidOperator != null
        ? (['avoid', options.avoidOperator] as const)
        : options.preferOperator != null
          ? (['prefer', options.preferOperator] as const)
          : null;
  const query: Partial<TripPlanQuery> = {};
  const waypoints = list(options.waypoints);
  if (waypoints) query.waypointCrs = waypoints;
  const via = list(options.via);
  if (via) query.viaCrs = via;
  const avoid = list(options.avoid);
  if (avoid) query.avoidCrs = avoid;
  const avoidStop = list(options.avoidStop);
  if (avoidStop) query.avoidStopCrs = avoidStop;
  const avoidChange = list(options.avoidChange);
  if (avoidChange) query.avoidChangeCrs = avoidChange;
  if (options.maxChanges != null) query.maxChanges = options.maxChanges;
  if (operator) {
    query.operatorMode = operator[0];
    query.operators = operator[1].split(',').filter(Boolean);
  }
  return query;
}

/** Whether a journey has set off, as far as its page can tell: a leg
 * dated before London's today, a train on its way or arrived, or an
 * untracked leg whose planned departure has passed. The api decides for
 * certain ("Skip" answers 409 once it has started). */
export function regularOccurrenceStarted(
  legs: readonly Pick<JourneyLegDetail, 'serviceDate' | 'plannedDeparture' | 'trackedTrainState'>[],
  now: Date,
): boolean {
  const today = londonToday();
  return legs.some(
    (leg) =>
      leg.serviceDate < today ||
      leg.trackedTrainState?.status === 'en_route' ||
      leg.trackedTrainState?.status === 'completed' ||
      (leg.plannedDeparture !== null && Date.parse(leg.plannedDeparture) <= now.getTime()),
  );
}
