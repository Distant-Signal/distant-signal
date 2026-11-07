import type * as Api from '@/lib/api-types';

/* Every field of the api's generated response types (`lib/api-types.ts`)
 * that a test usually doesn't care about, at its empty value: `null`,
 * `false`, `0` or `[]`. Spread one first into a fixture, then set what the
 * test is about, so a fixture keeps type-checking when the api adds a
 * field. */

/** A `JourneyStop`, less what places it: `crs`, `name`, `kind` and times. */
export const JOURNEY_STOP_DEFAULTS = {
  locationType: null,
  parentCrs: null,
  tiploc: null,
  actualArrival: null,
  actualDeparture: null,
  estimatedArrival: null,
  estimatedDeparture: null,
  estimateSource: null,
  lastEventType: null,
  variationStatus: null,
  delayMinutes: null,
  delayBasis: null,
  stopStatus: 'Unknown',
  skipSource: null,
  platform: null,
  plannedPlatform: null,
  platformChanged: false,
  platformStatus: null,
  bookedPlatform: null,
  platformBasis: null,
  platformSuppressed: false,
  displayPlatform: null,
  status: null,
  lateMinutes: null,
  cancelled: false,
  board: null,
  scheduledArrival: null,
  scheduledDeparture: null,
  publicArrival: null,
  publicDeparture: null,
  workingArrival: null,
  workingDeparture: null,
  workingPass: null,
  canBoard: true,
  canAlight: true,
  requestStop: false,
  passingPoint: false,
} satisfies Partial<Api.JourneyStop>;

/** The live and reason fields shared by `TrackedTrainState` and
 * `PublicTrainResponse`. */
const TRAIN_LIVE_DEFAULTS = {
  trainId: null,
  status: null,
  lastReportedLocation: null,
  lastEventType: null,
  delayMinutes: null,
  delayBasis: null,
  delayProvisional: false,
  nextCallingPoint: null,
  etaNext: null,
  etaSource: null,
  journeyStops: null,
  mayHaveArrived: false,
  predictedStart: null,
  operatorCode: null,
  operatorName: null,
  cancelled: false,
  cancelReasonCode: null,
  cancelReason: null,
  changeOfOriginReasonCode: null,
  changeOfOriginReason: null,
  cancellation: null,
  trackingPhase: null,
  firstReportExpectedAt: null,
  serviceMode: 'train',
  liveTracking: true,
} satisfies Partial<Api.TrackedTrainState & Api.PublicTrainResponse>;

/** A `TrackedTrainState`, less its id, date and pin. */
export const TRACKED_TRAIN_STATE_DEFAULTS = {
  ...TRAIN_LIVE_DEFAULTS,
  pinOriginName: null,
  pinDestinationName: null,
  trainUid: null,
  scheduleDestinationCrs: null,
  scheduleDestinationName: null,
  scheduleCallingPoints: null,
  customName: null,
  sharedGroupCount: 0,
  irishTrain: null,
} satisfies Partial<Api.TrackedTrainState>;

/** A `PublicTrainResponse` (`GET /Train/by-uid/{uid}/{date}`), less its
 * train, date and route. */
export const PUBLIC_TRAIN_DEFAULTS = {
  ...TRAIN_LIVE_DEFAULTS,
  trainsId: 1,
  originName: null,
  destinationName: null,
  scheduledDeparture: null,
  callingPoints: null,
  headcode: null,
  provisional: false,
  provisionalFrom: '2099-01-01',
} satisfies Partial<Api.PublicTrainResponse>;

/** A `TrackedTrainListItem` (`GET /Train/mine`), less its id, date and pin. */
export const TRACKED_TRAIN_LIST_ITEM_DEFAULTS = {
  pinOriginName: null,
  pinDestinationName: null,
  pinScheduledDeparture: null,
  trainUid: null,
  status: null,
  delayMinutes: null,
  delayBasis: null,
  delayProvisional: false,
  trackedAt: '2026-09-01T00:00:00Z',
  departsAt: '2026-09-17T09:00:00Z',
  customName: null,
  sharedGroupCount: 0,
  trackingPhase: null,
  firstReportExpectedAt: null,
  journeyIds: [],
  singleLegJourneyIds: [],
  travelled: false,
  cancellation: null,
  serviceMode: 'train',
  liveTracking: true,
  irishTrain: null,
} satisfies Partial<Api.TrackedTrainListItem>;

/** A `JourneyLegDetailResponse`, less its id, ends, date and kind. */
export const JOURNEY_LEG_DEFAULTS = {
  departAfter: null,
  departBefore: null,
  arriveAfter: null,
  arriveBefore: null,
  matchMode: 'manual',
  windowSearched: false,
  trackedTrainState: null,
  legSkip: null,
  transitMode: null,
  lineName: null,
  plannedDeparture: null,
  plannedArrival: null,
  untrackedStatus: null,
  originStopId: null,
  destinationStopId: null,
  searchFilters: null,
  replacesLegIds: [],
  transitNetwork: null,
  transitLineId: null,
  headsign: null,
  ticket: null,
  delayRepay: null,
} satisfies Partial<Api.JourneyLegDetailResponse>;

/** A `JourneyDetailResponse`, less its id and legs. */
export const JOURNEY_DETAIL_DEFAULTS = {
  customName: null,
  createdAt: '2026-09-01T00:00:00Z',
  isOwner: true,
  shareLink: null,
  openBreak: null,
  revisionCount: 0,
  sourceTemplateId: null,
  regularPlan: null,
  stationBufferMinutes: null,
  leaveBy: null,
} satisfies Partial<Api.JourneyDetailResponse>;

/** A `JourneyListItem` (`GET /Journeys/mine`), less its ids, current leg
 * and date. */
export const JOURNEY_LIST_ITEM_DEFAULTS = {
  customName: null,
  createdAt: '2026-09-01T00:00:00Z',
  originName: null,
  destinationName: null,
  firstOriginCrs: null,
  firstOriginName: null,
  lastDestinationCrs: null,
  lastDestinationName: null,
  legCount: 1,
  matchMode: 'manual',
  trainSubscriptionId: null,
  resolutionStatus: null,
  status: null,
  delayMinutes: null,
  delayBasis: null,
  delayProvisional: false,
  kind: 'train',
  transitMode: null,
  lineName: null,
  plannedDeparture: null,
  plannedArrival: null,
  untrackedStatus: null,
  trackingPhase: null,
  firstReportExpectedAt: null,
  trainLegCount: 1,
  travelled: false,
  departsAt: null,
  cancelledLegCount: 0,
  unmatchedLegCount: 0,
  finishedLegCount: 0,
  startedLegCount: 0,
  finalArrivalDelayMinutes: null,
  finalArrivalDelayProvisional: false,
  openBreakId: null,
  cancellation: null,
  irishTrain: null,
  sourceTemplateId: null,
  stationBufferMinutes: null,
  leaveBy: null,
} satisfies Partial<Api.JourneyListItem>;

/** A regular journey's fields (`JourneyTemplateListItem` and the detail),
 * for a template without a target. */
export const TEMPLATE_TARGET_DEFAULTS = {
  originCrs: null,
  originName: null,
  destinationCrs: null,
  destinationName: null,
  target: null,
  pairedTemplateId: null,
  nextDate: null,
  skippedDates: [],
  skipBankHolidays: true,
  nextSkips: [],
  upcomingDates: [],
} satisfies Partial<Api.JourneyTemplateListItem>;

/** A train leg of a trip plan, less its train, ends and times. */
export const PLANNED_TRAIN_LEG_DEFAULTS = {
  departureDayOffset: 0,
  arrivalDayOffset: 0,
  workingDepartureDayOffset: 0,
  workingArrivalDayOffset: 0,
  bookedDeparturePlatform: null,
  bookedArrivalPlatform: null,
  publicDeparture: null,
  publicArrival: null,
  publicDepartureDayOffset: null,
  publicArrivalDayOffset: null,
  operator: null,
  headcode: null,
  serviceMode: 'train',
  liveTracking: true,
} satisfies Partial<Extract<Api.PlannedLeg, { kind: 'train' }>>;

/** A `PlannedItinerary`, less its legs and counts. */
export const ITINERARY_DEFAULTS = {
  accessChangeCount: 0,
  continuesPreviousTrain: false,
} satisfies Partial<Api.PlannedItinerary>;

/** A `TripPlanSegment`, less its ends and itineraries. */
export const SEGMENT_DEFAULTS = {
  cappedByMaxChanges: false,
  departAfter: null,
  arriveBy: null,
  noResultReason: null,
} satisfies Partial<Api.TripPlanSegment>;

/** A `TripPlanResponse` (`GET /Trips/plan`), less its segments. */
export const TRIP_PLAN_DEFAULTS = {
  results: 'fastest',
  maxChanges: 2,
  arriveBy: null,
  departAfter: null,
  serviceDates: [],
  avoid: [],
  avoidStop: [],
  avoidChange: [],
  via: [],
  stationGroups: {},
  operator: [],
  avoidOperator: [],
  preferOperator: [],
  operatorGroups: {},
  operatorsNotRunning: [],
  journeys: [],
  provisional: false,
  provisionalFrom: '2099-01-01',
} satisfies Partial<Api.TripPlanResponse>;

type PlannedTrainLeg = Extract<Api.PlannedLeg, { kind: 'train' }>;

/** A train leg of a trip plan: its working times default to the
 * timetabled ones. */
export function plannedTrainLeg(
  leg: Pick<
    PlannedTrainLeg,
    'trainUid' | 'serviceDate' | 'originCrs' | 'destinationCrs' | 'scheduledDeparture' | 'scheduledArrival'
  > &
    Partial<PlannedTrainLeg>,
): PlannedTrainLeg {
  return {
    ...PLANNED_TRAIN_LEG_DEFAULTS,
    workingDeparture: leg.scheduledDeparture,
    workingArrival: leg.scheduledArrival,
    ...leg,
    kind: 'train',
  };
}

/** A `DelayRepayEstimate`, less its band: `scheme`, `bandMinutes`,
 * `percentage` and `disclaimer`. */
export const DELAY_REPAY_ESTIMATE_DEFAULTS = {
  fareBasis: 'single',
  ticketKind: 'unknown',
  roomSupplementPercentage: null,
  borderline: false,
  thresholdMinutes: null,
  provisional: false,
} satisfies Partial<Api.DelayRepayEstimate>;

/** The Delay Repay fields of `GET .../delay-repay` and
 * `GET /Train/tickets/mine`, less `claimUrl` and `disclaimer`. */
export const DELAY_REPAY_DEFAULTS = {
  delayMinutes: null,
  provisional: false,
  delayBasis: null,
  measuredAtCrs: null,
  measuredAtName: null,
  outcome: null,
  ownScheme: false,
  schemeOperator: null,
  estimate: null,
  rulesCheckedOn: '2026-10-07',
} satisfies Partial<Api.DelayRepayFields>;

/** A leg's `LegDelayRepay`, less `claimUrl` and `disclaimer`. */
export const LEG_DELAY_REPAY_DEFAULTS = {
  ...DELAY_REPAY_DEFAULTS,
  serviceMode: 'train',
  liveTracking: true,
  unmeasurableReason: null,
  ticketKnown: false,
} satisfies Partial<Api.LegDelayRepay>;

/** A `ReliabilityJourney`, less its journey, date and delay. */
export const RELIABILITY_JOURNEY_DEFAULTS = {
  ...DELAY_REPAY_DEFAULTS,
  customName: null,
  destinationCrs: 'YRK',
  destinationName: 'York',
  bookedArrival: null,
  actualArrival: null,
  againstBookedPlan: false,
  differentDestination: false,
  claimUrl: 'https://example.test/claim',
  disclaimer: 'A rough estimate.',
} satisfies Partial<Api.ReliabilityJourney>;

/** A `ReliabilityTrain`, less its journey, leg, date and delay. */
export const RELIABILITY_TRAIN_DEFAULTS = {
  trainUid: 'W12345',
  originCrs: 'KGX',
  destinationCrs: 'YRK',
  destinationName: 'York',
  cancelled: false,
  recorded: true,
  replacedBecause: null,
} satisfies Partial<Api.ReliabilityTrain>;

/** The live fields a `GroupTrain` (and `SharedTrain`) adds to its pin. */
export const GROUP_TRAIN_DEFAULTS = {
  delayBasis: null,
  delayProvisional: false,
  serviceMode: 'train',
  liveTracking: true,
  trackingPhase: null,
  firstReportExpectedAt: null,
  irishTrain: null,
} satisfies Partial<Api.GroupTrain>;

/** A `GroupJourney` (and `SharedJourney`) summarising a train leg, less
 * the journey and its pin. */
export const GROUP_JOURNEY_DEFAULTS = {
  firstOriginCrs: null,
  firstOriginName: null,
  lastDestinationCrs: null,
  lastDestinationName: null,
  delayBasis: null,
  delayProvisional: false,
  trackingPhase: null,
  firstReportExpectedAt: null,
  kind: 'train',
  transitMode: null,
  plannedDeparture: null,
  plannedArrival: null,
  untrackedStatus: null,
  following: false,
  irishTrain: null,
} satisfies Partial<Api.GroupJourney>;

/** An earlier plan's leg's untracked stops and network ride. */
export const REVISION_LEG_DEFAULTS = {
  originStopId: null,
  destinationStopId: null,
  transitNetwork: null,
  transitLineId: null,
  headsign: null,
} satisfies Partial<Api.RevisionLeg>;

/** An incident in effect: the api's `state`, `startsAt` and
 * `validityEndedAt` for one whose validity window covers now. */
export const INCIDENT_TIMING_DEFAULTS = {
  state: 'active',
  startsAt: null,
  validityEndedAt: null,
} satisfies Partial<Api.IncidentTiming>;

/** An operator rollup, less the operator and its status. */
export const OPERATOR_SUMMARY_DEFAULTS = {
  worstLineId: null,
  worstLineName: null,
  computedAt: null,
} satisfies Partial<Api.OperatorSummary>;

/** A train search row, less the train (`uid`, `scheduled`, `stationCrs`,
 * `serviceDate`). */
export const TRAIN_SEARCH_ROW_DEFAULTS = {
  originCrs: null,
  originName: null,
  destinationCrs: null,
  destinationName: null,
  destinationArrival: null,
  destinationArrivalDayOffset: 0,
  publicDeparture: null,
  publicDestinationArrival: null,
  workingDeparture: null,
  workingDestinationArrival: null,
  operator: null,
  identity: null,
  live: null,
  serviceMode: 'train',
  liveTracking: true,
} satisfies Partial<Api.TrainSearchResult>;
