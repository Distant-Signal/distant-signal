import type * as Api from './api-types';

// The api's request and response types, generated from its Rust types
// (lib/api-types.ts; repo-split spec §5.3), under the names the app uses.
export type TrackedTrainState = Api.TrackedTrainState;
export type PublicTrainState = Api.PublicTrainResponse;
export type TrackedTrainListItem = Api.TrackedTrainListItem;
export type JourneyStop = Api.JourneyStop;
export type StopBoard = Api.StopBoard;
export type PredictedStart = Api.PredictedStart;
export type PreviousWorking = Api.PreviousWorking;
export type PredictionConfidence = Api.Confidence;
export type Cancellation = Api.Cancellation;
export type CancellationKind = Api.CancellationKind;
export type CancellationReason = Api.CancellationReason;
export type CancellationReasonSource = Api.ReasonSource;
export type CancellationPlace = Api.CancellationPlace;
export type CancellationStop = Api.CancellationStop;
export type CancelledSection = Api.CancelledSection;
export type ListCancellation = Api.CancellationSummary;
export type DelayBasis = Api.DelayBasis;
export type StopStatus = Api.StopStatus;
export type LiveStopStatus = Api.LiveStopStatus;
export type SkipSource = Api.SkipSource;
export type PlatformStatus = Api.PlatformStatus;
export type PlatformBasis = Api.PlatformBasis;
export type LocationType = Api.LocationType;
export type ServiceMode = Api.ServiceMode;
export type TrackingPhase = Api.TrackingPhase;
export type JourneyDetail = Api.JourneyDetailResponse;
export type JourneyLegDetail = Api.JourneyLegDetailResponse;
export type JourneyListItem = Api.JourneyListItem;
export type LegSkipStatus = Api.LegSkipResponse;
export type SharedVia = Api.SharedVia;
export type FollowedFrom = Api.FollowedFrom;
export type LegTimetable = Api.LegTimetable;
export type LegTimetableCall = Api.TimetabledCall;
export type LegTimetableState = Api.MatchState;
export type LegLiveArrivalsFilter = Api.LiveArrivalsFilter;
export type ConnectionState = Api.ConnectionState;
export type LegConnection = Api.LegConnection;
export type LateDepartureReliance = Api.LateDepartureReliance<string>;
export type TripPlanLateDepartureReliance = Api.LateDepartureReliance<string>;
export type OpenBreakSummary = Api.OpenBreakSummary;
export type JourneyOperatorFilter = Api.JourneyOperatorFilter;
export type LegSearchFilters = Api.LegSearchFilters;
export type UntrackedStatus = Api.UntrackedStatus;
export type TripPlanResponse = Api.TripPlanResponse;
export type TripPlanSegment = Api.TripPlanSegment;
export type TripPlanJourney = Api.TripPlanJourney;
export type TripPlanItinerary = Api.PlannedItinerary;
export type TripPlanLeg = Api.PlannedLeg;
export type TripPlanTransitLeg = Api.TransitLeg;
export type TripPlanTransitStop = Api.TransitLegStop;
export type TripPlanTransitNotice = Api.TransitLegNotice;
export type TripPlanTransitWalk = Api.TransitWalk;
export type TripPlanNetworkNotice = Api.TransitPlanNotice;
export type TripPlanAccessLeg = Api.AccessLeg;
export type TripPlanAccessCandidate = Api.AccessCandidate;
export type TripPlanStopAccess = Api.StopAccess;
export type TripPlanOptionLabel = Api.OptionLabel;
export type TripPlanWaypointSatisfied = Api.WaypointSatisfied;
export type TripPlanViaSatisfied = Api.ViaSatisfied;
export type TripPlanLegLive = Api.LegLive;
export type TripPlanNoResultReason = Api.NoResultReason;
export type TripPlanStationWalks = Api.StationWalks;
export type TripPlanTransitServiceMode = Api.TransitServiceMode;
export type TripPlanAccessBasis = Api.AccessBasis;
export type ResolutionStatus = Api.ResolutionStatus;
export type JourneyStatus = Api.JourneyStatus;
export type EtaSource = Api.EtaSource;
export type JourneyLegKind = Api.JourneyLegKind;
export type TransitMode = Api.TransitMode;
export type BreakCause = Api.BreakCause;
export type BreakFault = Api.BreakFault;

// Field groups the api flattens into many responses, as optional inputs:
// the helpers that read them also take rows of routes not generated yet.
type Loose<T> = { [K in keyof T]?: T[K] | null | undefined };
export type ServiceModeFields = Loose<Pick<Api.TrackedTrainState, 'serviceMode' | 'liveTracking'>>;
export type TrackingPhaseFields = Loose<Pick<Api.TrackedTrainState, 'trackingPhase' | 'firstReportExpectedAt'>>;
export type TimetableCertaintyFields = Loose<Pick<Api.PublicTrainResponse, 'provisional' | 'provisionalFrom'>>;

// Not an api type: the train page's view of a tracked or public train
// (`app/train/[uid]/[date]/page.tsx` maps a public train into it, its
// `scheduledDeparture` as `pinScheduledDeparture`; `GET /Train/{trackingId}`
// sends no pin departure).
export type TrainJourneyState = Omit<
  Api.TrackedTrainState,
  'id' | 'sharedGroupCount' | 'journeyIds' | 'singleLegJourneyIds' | 'notificationsEnabled'
> & { pinScheduledDeparture?: string | null };

export interface ValidityPeriod {
  fromDate: string;
  toDate: string | null;
  isNow: boolean;
}

export interface AffectedRoute {
  from: string;
  to: string;
}

export interface Disruption {
  category: string;
  description: string;
  affectedStops: string[];
  affectedRoutes: AffectedRoute[];
  source: string | null;
  impactType: string | null;
}

export interface IncidentLineRef {
  id: string;
  name: string;
}

export interface IncidentHistoryEntry {
  summary: string;
  description: string;
  operators: string[];
  affectedStations: string[];
  priority: number;
  validityPeriods: ValidityPeriod[];
  isPlanned: boolean;
  isCleared: boolean;
  recordedAt: string; // RFC3339
}

/** `GET /public/incidents/{incidentId}`'s response
 * (`crates/api/src/routes/incidents.rs`). `description` is raw HTML —
 * sanitize with `sanitizeDescription` (`frontend/lib/sanitizeHtml.ts`)
 * before rendering, same as `DisruptionDetail`. `currentlyAffectsLines`
 * is computed fresh per request — can be empty for a cleared or
 * no-longer-matched incident, which is a normal outcome, not an error. */
export interface IncidentDetail {
  incidentId: string;
  summary: string;
  description: string;
  operators: string[];
  affectedStations: string[];
  priority: number;
  validityPeriods: ValidityPeriod[];
  isPlanned: boolean;
  isCleared: boolean;
  firstSeenAt: string; // RFC3339
  fetchedAt: string; // RFC3339
  /** RFC3339: when the Knowledgebase feed last listed an incident it has
   * since stopped listing without clearing it ("Ended"), else `null`. See
   * `incidentState` (`lib/incidents.ts`). Optional only for a bundle served
   * against an api that predates it. */
  sourceRemovedAt?: string | null;
  /** The api's `state`, `startsAt` and `validityEndedAt` (2026-10-20):
   * see `IncidentTiming`. */
  state?: IncidentTiming['state'];
  startsAt?: IncidentTiming['startsAt'];
  validityEndedAt?: IncidentTiming['validityEndedAt'];
  currentlyAffectsLines: IncidentLineRef[];
  history: IncidentHistoryEntry[];
}

/** One row from `GET /public/incidents`. Deliberately lighter than
 * `IncidentDetail` (no description, no validityPeriods, no history, no
 * currentlyAffectsLines) — see
 * docs/superpowers/specs/2026-09-12-incident-archive-design.md Decision 7. */
export interface IncidentSummary {
  incidentId: string;
  summary: string;
  operators: string[];
  /** Always empty in practice: RDM's Knowledgebase Incidents feed carries no
   * station codes, only a free-text route description. Kept on the wire
   * because the column exists and the detail page renders it; `affectedLines`
   * is the field that actually says which railway an incident touches. */
  affectedStations: string[];
  /** Catalogue line ids, as decided by the same matcher that drives the live
   * status pages (`common::matcher`). This is what the Line filter matches
   * on. Empty means "matched no catalogue line" -- which, for a row ingested
   * before the column existed, may just mean "not backfilled yet". Absent
   * from an api that predates the field (a rolling deploy). */
  affectedLines?: string[];
  priority: number;
  isPlanned: boolean;
  isCleared: boolean;
  firstSeenAt: string; // RFC3339
  fetchedAt: string; // RFC3339
  /** See `IncidentDetail.sourceRemovedAt`. */
  sourceRemovedAt?: string | null;
  /** See `IncidentTiming`. */
  state?: IncidentTiming['state'];
  startsAt?: IncidentTiming['startsAt'];
  validityEndedAt?: IncidentTiming['validityEndedAt'];
}

/** Where an incident stands, as the api derives it from RDM's clear flag,
 * the feed's listing and the incident's validity windows (2026-10-20,
 * `queries::IncidentState`; docs/api-changelog.md). Every field is
 * optional on the wire only for a bundle served against an older api,
 * which `incidentState` (`lib/incidents.ts`) falls back from. */
export interface IncidentTiming {
  /** `active`: a validity window covers now; `upcoming`: none has started
   * yet (or now is between two); `ended`: no longer listed by the feed, or
   * every window has finished; `cleared`: RDM cleared it. */
  state: 'active' | 'upcoming' | 'ended' | 'cleared';
  /** RFC3339: when the next window starts, for `upcoming`; else `null`. */
  startsAt: string | null;
  /** RFC3339: when the last window finished, once every window has; else
   * `null`. */
  validityEndedAt: string | null;
}

/** One item of `GET /public/incidents/recently-cleared` (docs/api-changelog.md,
 * 2026-10-12): an incident National Rail has cleared but still lists,
 * cleared since 02:00 today. For information only: it never affects a
 * line's status. */
export interface RecentlyClearedIncident {
  incidentId: string;
  /** The clearing summary as published, often starting "CLEARED:". */
  summary: string;
  /** The clearing text as published (HTML). */
  description: string;
  operators: string[];
  affectedLines: IncidentLineRef[];
  clearedAt: string; // RFC3339
  lastListedAt: string; // RFC3339
  /** The end time the last live text stated, or null. Shown only while it
   * is still in the future. */
  expectedUntil: string | null;
  /** The last live text said "expected until the end of the day". */
  expectedUntilEndOfDay: boolean;
}

export interface IncidentSearchResponse {
  results: IncidentSummary[];
  nextCursor: string | null;
  /** Every match across all pages; first page only, `null` with `after`.
   * Absent from an api older than 2026-10-14. */
  total?: number | null;
}

export interface SampleStats {
  total: number;
  delayed: number;
  cancelled: number;
  skipped: number;
  avgDelayMinutes: number;
}

/** Why `sampleStats` is (or isn't) populated on a given `LineStatus` this
 * cycle -- see `common::SampleAvailability`
 * (`crates/common/src/lib.rs`) and
 * docs/superpowers/specs/2026-09-01-line-status-sample-coverage-design.md
 * Decision 2. Always present, unlike `sampleStats` itself. Read this only
 * through `sampleUnavailableReason`/`formatSampleSummary`
 * (`lib/sampleStats.ts`) -- it is not a meaningful signal on its own for a
 * TfL-quality status (see that module's precedence-order doc comment). */
export type SampleAvailability =
  { state: 'no-coverage' } | { state: 'below-threshold'; observed: number; required: number } | { state: 'available' };

/** Why `fullCoverageStats` is (or isn't) populated on a given `LineStatus`
 * this cycle -- the full-coverage analog of `SampleAvailability`,
 * deliberately a SIBLING type, not a reuse of it (see
 * `common::FullCoverageAvailability`'s own doc comment,
 * `crates/common/src/lib.rs`, and
 * docs/superpowers/specs/2026-09-03-full-coverage-metrics-transition-design.md
 * Decision 1). Always present, like `sampleAvailability`. `'not-enabled'` is
 * the default and, as of this app's current line catalogue, the ONLY value
 * this can take -- nothing sets `full_coverage_enabled` on any line yet, and
 * no producer exists to resolve `'pending'`/`'available'`. */
export type FullCoverageAvailability = { state: 'not-enabled' } | { state: 'pending' } | { state: 'available' };

export interface LineStatus {
  statusSeverity: number;
  statusSeverityDescription: string;
  reason: string;
  dataQuality: 'knowledgebase' | 'ldbws-inferred' | 'trust-inferred' | 'planned' | 'tfl' | 'transit';
  validityPeriods: ValidityPeriod[];
  disruption?: Disruption;
  sampleStats?: SampleStats;
  sampleAvailability: SampleAvailability;
  /** Full-coverage analog of `sampleStats` -- see `FullCoverageAvailability`'s
   * own doc comment. `undefined` for every line today (nothing produces this
   * yet); permanent, additive scaffolding, not a replacement for
   * `sampleStats` -- see the design doc's Decision 3. */
  fullCoverageStats?: SampleStats;
  fullCoverageAvailability: FullCoverageAvailability;
}

/** One of a line's `upcoming` notes (docs/api-changelog.md, 2026-10-06):
 * a disruption announced for the line that has not started yet. Never part
 * of `lineStatuses` or a severity. `to` is exclusive; `null` means no
 * stated end. */
export interface UpcomingDisruption {
  from: string;
  to: string | null;
  summary: string;
  incidentId: string;
}

export interface LineStatusReport {
  $type: string;
  id: string;
  name: string;
  modeName: string;
  operators: string[];
  lineStatuses: LineStatus[];
  computedAt: string;
  /** Present only for a line with a TfL counterpart merged into it (see
   * docs/superpowers/specs/2026-08-22-tfl-service-metrics-v2-design.md
   * Area 1 -- Elizabeth line today). The counterpart's own current
   * statuses, rendered separately from `lineStatuses` on the line detail
   * page rather than merged into it, since only this report's own
   * `lineStatuses` carries real `sampleStats`. */
  tflStatus?: LineStatus[];
  /** Soonest first. Optional: absent from history entries and from an api
   * older than 2026-10-06. */
  upcoming?: UpcomingDisruption[];
}

export type LineStatusHistoryEntry = LineStatusReport;

/** One operator's row from `GET /public/stations/{crs}/sample-stats`
 * (`crates/api/src/routes/station_stats.rs`) --
 * docs/superpowers/specs/2026-09-03-per-station-stats-design.md Decision 9,
 * extended per
 * docs/superpowers/specs/2026-09-04-per-station-full-coverage-stats-design.md
 * Decision 3. `sampleAvailability.state` is never `'no-coverage'` through
 * this route (a documented invariant of the route handler, not
 * type-enforced). `fullCoverageAvailability` is always present, like
 * `LineStatus`'s own field of the same name -- `'not-enabled'` for every
 * real operator today, since no line has `full_coverage_enabled` set. */
export interface StationOperatorSampleStats {
  operator: string;
  sampleAvailability: SampleAvailability;
  sampleStats?: SampleStats;
  fullCoverageStats?: SampleStats;
  fullCoverageAvailability: FullCoverageAvailability;
}

/** `GET /public/stations/{crs}/accessibility`'s response -- a filtered
 * passthrough of `stations.accessibility` (see
 * docs/superpowers/specs/2026-09-12-station-accessibility-design.md
 * Decision 1 for the exact key allowlist). Every value is `unknown`, not a
 * nested interface, because this codebase has never recorded the RDM
 * feed's field-level shape for any of these keys (design spec
 * Correction 2) -- typing them more precisely here would be inventing a
 * contract this app cannot actually verify. Keys are present only when
 * non-null in the source data; a key with no data is simply absent, not
 * `null`. Deliberately keeps the `accessibility`-named wire vocabulary
 * despite the WCAG "accessibility" naming collision this codebase also
 * uses elsewhere (Correction 4) -- see that section for why this isn't
 * renamed. */
export interface StationAccessibilityData {
  stationAccessibility?: unknown;
  staffAssistance?: unknown;
  toiletsAndChanging?: unknown;
  lifts?: unknown;
  transportLinks?: unknown;
  cycling?: unknown;
  carParks?: unknown;
  dropOffPickUp?: unknown;
  platformFacilities?: unknown;
  stationFacilities?: unknown;
  helpAndSupport?: unknown;
  loungesAndWaiting?: unknown;
}

/** `GET /Line/{id}/Stats/{from}/to/{to}`'s per-day response shape.
 * `delayRate`/`cancellationRate`/`skipRate` are fractions (0-1) computed
 * server-side from stored sums over DISTINCT trains, deduped by Darwin
 * `service_id` via the aggregator's `dedup::dedup_new_sample_stats` -- see
 * `crates/aggregator/src/queries.rs`'s `record_daily_stats` doc comment --
 * not a share of poll cycles. Each train is counted once per day, using its
 * status the FIRST time it was observed that day; if it's still dwelling in
 * view and its status changes later (e.g. on-time becomes delayed), that
 * later state is never recorded, so these rates can under-report delays
 * that develop mid-visit. `sampleCycles` is the coverage signal the
 * sparse-data gap-rendering in `TrendsResults.tsx` depends on -- render it,
 * don't discard it. */
export interface LineDailyStats {
  day: string; // "YYYY-MM-DD", Europe/London calendar day
  sampleCycles: number;
  total: number;
  delayed: number;
  cancelled: number;
  skipped: number;
  avgDelayMinutes: number;
  delayRate: number;
  cancellationRate: number;
  skipRate: number;
}

/** `GET /Line/{id}/Stats/HalfHourly/{from}/to/{to}`'s per-bucket response
 * shape -- half-hourly sibling of `LineDailyStats`. `halfHourStart` is an
 * RFC3339 UTC instant (the start of the 30-minute bucket -- :00 or :30),
 * not a calendar day -- always render it through
 * `frontend/lib/dateFormat.ts`'s `formatTime` before display, same
 * convention `LineDailyStats.day` follows for its own rendering. Same
 * dedup/attribution caveat as `LineDailyStats` applies, reworded for "that
 * half hour" instead of "that day". Originally `LineHourlyStats` with an
 * `hourStart` field (1-hour buckets); renamed when the trend chart's
 * granularity was doubled -- see git history for the hourly-era version. */
export interface LineHalfHourlyStats {
  halfHourStart: string; // RFC3339 UTC instant, start of the 30-minute bucket
  sampleCycles: number;
  total: number;
  delayed: number;
  cancelled: number;
  skipped: number;
  avgDelayMinutes: number;
  delayRate: number;
  cancellationRate: number;
  skipRate: number;
}

/** `GET /Line/{id}/Stats/Hourly/{from}/to/{to}`'s per-bucket response shape
 * -- same fields as `LineHalfHourlyStats`, but `bucketStart` in place of
 * `halfHourStart`: this is the start of a 1-hour bucket, derived at READ
 * time by grouping `line_status_half_hourly_stats` rows
 * (`crates/api/src/data/queries.rs`'s `sub_daily_stats_for_range`) --
 * reusing "halfHourStart" for a 1-hour bucket would be a misleading field
 * name. Always an RFC3339 UTC instant; render it through
 * `frontend/lib/dateFormat.ts`'s `formatTime` before display, same
 * convention `LineHalfHourlyStats.halfHourStart` follows. */
export interface LineHourlyStats {
  bucketStart: string; // RFC3339 UTC instant, start of the 1-hour bucket
  sampleCycles: number;
  total: number;
  delayed: number;
  cancelled: number;
  skipped: number;
  avgDelayMinutes: number;
  delayRate: number;
  cancellationRate: number;
  skipRate: number;
}

/** `GET /Line/{id}/Stats/SixHourly/{from}/to/{to}`'s per-bucket response
 * shape -- identical to `LineHourlyStats` except the bucket is 6 hours
 * wide, not 1. */
export interface LineSixHourlyStats {
  bucketStart: string; // RFC3339 UTC instant, start of the 6-hour bucket
  sampleCycles: number;
  total: number;
  delayed: number;
  cancelled: number;
  skipped: number;
  avgDelayMinutes: number;
  delayRate: number;
  cancellationRate: number;
  skipRate: number;
}

/** `GET /public/operators/{code}/stats/...` and `GET /public/network/stats/...`
 * share the exact same per-bucket response shape the per-line routes
 * already use -- `LineDailyStats` etc. carry no line-specific field, so
 * these are plain aliases for readability at the new call sites, not new
 * structural types. See
 * docs/superpowers/plans/2026-09-22-operator-overview-phase4-historical-views-plan.md. */
export type OperatorDailyStats = LineDailyStats;
export type OperatorHalfHourlyStats = LineHalfHourlyStats;
export type OperatorHourlyStats = LineHourlyStats;
export type OperatorSixHourlyStats = LineSixHourlyStats;
export type NetworkDailyStats = LineDailyStats;
export type NetworkHalfHourlyStats = LineHalfHourlyStats;
export type NetworkHourlyStats = LineHourlyStats;
export type NetworkSixHourlyStats = LineSixHourlyStats;

/** `GET /Line/{id}/Stats/Coverage/{from}/to/{to}`'s per-day response shape --
 * the full-coverage sibling of `LineDailyStats` (`resolvedWindows` in place
 * of `sampleCycles`). Rates shown cover every scheduled service on the
 * line, cross-referenced against real train-movement data -- not a sample
 * of live departures at a handful of stations. `resolvedWindows` is the
 * coverage/gap-rendering signal here, the full-coverage analog of
 * `sampleCycles` -- how many cycles this day saw a genuinely resolved
 * (not pending) population, not merely "any raw coverage at all". Always
 * an empty array today: no full-coverage producer exists yet to populate
 * the underlying table. See
 * docs/superpowers/specs/2026-09-03-full-coverage-metrics-transition-design.md
 * Decision 4. */
export interface LineDailyCoverageStats {
  day: string; // "YYYY-MM-DD", Europe/London calendar day
  resolvedWindows: number;
  total: number;
  delayed: number;
  cancelled: number;
  skipped: number;
  avgDelayMinutes: number;
  delayRate: number;
  cancellationRate: number;
  skipRate: number;
}

/** `GET /Line/{id}/Stats/Coverage/HalfHourly/{from}/to/{to}`'s per-bucket
 * response shape -- half-hourly sibling of `LineDailyCoverageStats`, same
 * relationship `LineHalfHourlyStats` already has to `LineDailyStats`. */
export interface LineHalfHourlyCoverageStats {
  halfHourStart: string; // RFC3339 UTC instant, start of the 30-minute bucket
  resolvedWindows: number;
  total: number;
  delayed: number;
  cancelled: number;
  skipped: number;
  avgDelayMinutes: number;
  delayRate: number;
  cancellationRate: number;
  skipRate: number;
}

export interface Preferences {
  pinnedLines: string[];
  pinnedStations: string[];
  pinnedOperators: string[];
  /** Of `pinnedLines`, those whose status changes are not pushed
   * (`PUT /preferences/pinned-lines/{id}/alerts`). Absent from an older
   * backend. */
  silentPinnedLines?: string[];
}

export interface LineSummary {
  id: string;
  name: string;
  category: string;
  operators: string[];
  source: 'catalogue' | 'custom' | 'tfl';
}

/** `GET /public/operators`'s per-item response shape (+ `GET
 * /public/operators/{code}`'s single-item shape) --
 * `crates/api/src/data/operators.rs`'s `OperatorRollup`, hand-serialized
 * camelCase by `crates/api/src/routes/operators.rs`'s `operator_rollup_json`.
 * `code` is either a real ATOC code (`tocs.atoc_code`) or the literal
 * synthetic string `"TfL"`. `lineIds` is the exact "which lines does this
 * operator run" set the rollup was computed from -- reusable by a future
 * per-operator detail/history view without a second request. `sampleStats`
 * is absent when no matching line had a representative status carrying
 * stats yet (always the case for the `"TfL"` row, which never carries
 * sample stats per-line either) -- render with
 * `lib/operatorStats.ts`'s `formatOperatorSampleSummary`, not
 * `lib/sampleStats.ts`'s `formatSampleSummary` (this type has no
 * `sampleAvailability`/`dataQuality` to satisfy `SampleStatsCarrier` with —
 * see docs/superpowers/plans/2026-09-22-operator-overview-phase3-operators-list-and-pinning-plan.md's
 * Judgment Call 3 for why). `computedAt` is `null` only in the
 * (never-constructed-in-practice) case of a rollup with zero matching
 * lines. */
export interface OperatorSummary {
  code: string;
  name: string;
  lineIds: string[];
  worstSeverity: number;
  reason: string;
  /** The id/name of the specific line whose status `worstSeverity`/`reason`
   * above came from -- lets a card/page say WHICH of an operator's lines is
   * driving its rollup ("Worst of 4 lines · LNER East Coast Main Line")
   * instead of presenting one line's reason as the whole operator's status
   * with no scope (2026-09-22 UX review [OH] §2.3/I11).
   * `crates/api/src/data/operators.rs`'s `OperatorRollup.worst_line_id`/
   * `worst_line_name`. Optional (rather than always required) so a payload
   * from a server that hasn't rolled this field out yet still satisfies
   * this type -- a caller must treat their absence as "no known worst
   * line" and fall back accordingly, not assume they're always present the
   * way `reason` is. */
  worstLineId?: string;
  worstLineName?: string;
  sampleStats?: SampleStats;
  computedAt: string | null;
}

export interface CustomLineDetail {
  id: string;
  name: string;
  operators: string[];
  stations: string[];
  headcodePrefixes: string[];
  destinationCrsFilter: string[];
  /** Whether the CALLER owns this line. A `200` from
   * `GET /public/lines/{id}` used to prove ownership by itself; custom-line
   * group sharing made that false (a granted group member gets the same
   * full detail), so every edit/delete affordance must gate on this flag
   * rather than on "the fetch succeeded". The backend is still the
   * authority -- `PUT`/`DELETE` remain owner-only and grant-blind -- this
   * is what stops the UI offering a control that can only ever 404. */
  isOwner: boolean;
  /** Every group this line is currently shared into. Populated ONLY when
   * `isOwner` is true; always `[]` for a granted non-owner, so a fellow
   * group member never learns which other groups the owner shared it
   * into. */
  sharedWithGroups: LineGroupRef[];
}

export interface LineDefinitionSummary {
  stations: string[];
  operators: string[];
}

export interface DataFreshness {
  stations: string | null;
  tocs: string | null;
  incidents: string | null;
  tfl: string | null;
  // Deliberately snake_case, unlike every other field in this file's
  // camelCase types: `crates/api/src/routes/freshness.rs`'s `DataFreshness`
  // has no `#[serde(rename_all = ...)]`, so this field serializes on the
  // wire as literally `schedule_feed` -- when a CIF SCHEDULE feed delivery
  // was last recorded by `schedule-ingest` (its direct write to
  // `schedule_feed_ingests`, since ingest phase 5).
  schedule_feed: string | null;
  // Also snake_case on the wire, for the same reason: the `delivered_at`
  // (the delivered file's own mtime) of the newest Network Rail CORPUS
  // extract `schedule-ingest` loaded (directly, since ingest phase 5)
  // (`MAX(corpus_deliveries.delivered_at)`). `null` until the first load.
  // Optional only for deploy skew: an api older than this field omits it,
  // which `DataFreshnessInfo` renders the same as `null`.
  corpus?: string | null;
}

/** `GET /public/history-retention`'s response: how many days of
 * `line_status_history` the backend actually keeps, echoed from the
 * aggregator's own `HISTORY_RETENTION_DAYS` (see
 * `crates/api/src/routes/history_retention.rs`). Used by the
 * `/lines/[id]/history` page to tell a genuinely-pruned range apart from a
 * genuinely-quiet line.
 *
 * `dailyStatsRetentionDays`/`halfHourlyStatsRetentionHours` (Decision 8 of
 * docs/superpowers/specs/2026-09-05-configurable-trend-granularity-design.md)
 * extend this same echo to the two other retention ceilings the Trends
 * tab's `GranularityControl` needs -- see `frontend/lib/history.ts`'s
 * `GranularityRetentionCeilings`/`availableGranularities`/
 * `resolveGranularity`. */
export interface HistoryRetention {
  historyRetentionDays: number;
  dailyStatsRetentionDays: number;
  halfHourlyStatsRetentionHours: number;
}

/** A code/name pair from the `/public/stations` and `/public/tocs`
 * type-ahead endpoints — CRS codes for stations, ATOC codes for
 * operators. */
export interface Suggestion {
  code: string;
  name: string;
  // Only on a `?stops=true` station search's bus stops and ferry terminals,
  // whose `code` is `tiploc:TIPLOC` and `name` already says `(bus)` or
  // `(ferry)`.
  kind?: 'bus' | 'ferry';
  parentCrs?: string;
  /** A TfL stop's modes and lines (`Tube: Northern, Victoria`), shown after
   * its name in the dropdown (`searchTflStops`). */
  detail?: string;
  /** Only on `/stations`' merged search (`searchStationsAndStops`): a stop
   * that is not a National Rail station, and where picking it leads. Its
   * `code` is then a key (`tfl:940GZZLUUXB`), never a CRS. */
  place?: StationPlace;
}

/** A non-National Rail stop in `/stations`' search: a TfL Tube, DLR or tram
 * stop (no page of its own yet), or a served transit network's stop
 * (`/transit/{network}/stops/{stopId}`). */
export type StationPlace = { kind: 'tfl'; stop: TflStop } | { kind: 'transit'; network: string; stopId: string };

/** One line at a TfL stop. */
export interface TflStopLine {
  id: string;
  name: string;
}

/** A TfL Tube, DLR or tram stop (`GET /public/tfl/stops`,
 * `crates/api/src/data/tfl_stops.rs::TflStopSummary`). `id` is its NaPTAN
 * id, what an untracked leg stores as `originStopId`/`destinationStopId`. */
export interface TflStop {
  id: string;
  name: string;
  modes: string[];
  lines: TflStopLine[];
}

/** A National Rail station at a TfL stop. `name` is null when the
 * station has no reference row. */
export interface TflStopRailStation {
  crs: string;
  name: string | null;
}

/** `GET /public/tfl/stops/{id}` (`crates/api/src/routes/tfl_stop_page.rs`):
 * a stop with the National Rail stations at it, best first. */
export interface TflStopDetail extends TflStop {
  railStations: TflStopRailStation[];
}

/** One live prediction at a TfL stop. */
export interface TflArrival {
  /** TfL's prediction ID, stable across refreshes. */
  id: string;
  destination: string;
  /** RFC 3339. */
  expectedArrival: string;
  /** From when the api answered; never negative. */
  timeToStationSecs: number;
  currentLocation?: string;
}

/** The predictions at one platform of one line, soonest first. */
export interface TflArrivalGroup {
  lineId: string;
  lineName: string;
  /** "Westbound - Platform 1"; may be empty. */
  platformName: string;
  direction?: string;
  arrivals: TflArrival[];
}

/** `GET /public/tfl/stops/{id}/arrivals`. */
export interface TflStopArrivals {
  stopId: string;
  /** When TfL was asked (the api caches for about 30 s). */
  fetchedAt: string;
  groups: TflArrivalGroup[];
}

/** A code/name pair from `GET /public/stations/nearby` --
 * (`crates/api/src/data/reference.rs`'s `NearbyStation`), like `Suggestion`
 * but for a "near me" physical-distance lookup rather than text search, and
 * carrying the great-circle distance from the caller's supplied point, in
 * kilometres. Stations with no recorded coordinates never appear in this
 * response at all (the backend excludes them), so there is no nullable
 * distance case to render here. */
export interface NearbyStation {
  code: string;
  name: string;
  distanceKm: number;
}

/** `GET /public/auth/session`'s response — always 200, never 401 (an
 * anonymous visitor gets `authenticated: false` with everything else
 * `null`, not an error). `id`/`name`/`username` can all be `null` even when
 * `authenticated` is `true`, depending on what the OIDC provider actually
 * sent back. `username` is the user's own `preferred_username`; the app
 * does not request or store email addresses. */
export interface SessionInfo {
  authenticated: boolean;
  id: string | null;
  name: string | null;
  username: string | null;
  /** The account's "Help improve Distant Signal" choice (DS-190); false
   * when logged out. Optional: an older api leaves it out, which reads as
   * off. */
  analyticsOptIn?: boolean;
}

/** The fields an untracked leg adds to a journey leg or list row, `null`
 * (or absent) on a train leg. Its place names are the leg's own
 * `originName`/`destinationName`. */
export interface UntrackedLegFields {
  kind?: JourneyLegKind;
  transitMode?: TransitMode | null;
  lineName?: string | null;
  plannedDeparture?: string | null; // RFC3339
  plannedArrival?: string | null; // RFC3339
  untrackedStatus?: UntrackedStatus | null;
  /** The TfL stops its places were picked from, `null` for free text. */
  originStopId?: string | null;
  destinationStopId?: string | null;
  /** A timetabled leg's network ride (DS-237): its network (`tfl`,
   * `metrolink`), its line's local id (`victoria`) and its headsign.
   * `null` on other legs; absent from an older backend. */
  transitNetwork?: string | null;
  transitLineId?: string | null;
  headsign?: string | null;
}
export type ScheduleCallingPointKind = 'Origin' | 'Intermediate' | 'Terminate';

/** One calling point of a `schedule_matched` pin's matched service, as
 * snapshotted at match time (`crates/api/src/data/schedule_matching.rs`'s
 * `ScheduleCallingPointDto`) -- already camelCase on the wire, unlike the
 * Rust `schedule_query::CallingPoint` type it's derived from. */
export interface ScheduleCallingPoint {
  tiploc: string;
  kind: ScheduleCallingPointKind;
  bookedArrival: string | null; // "HH:MM:SS"
  bookedDeparture: string | null;
  isHalfMinuteArrival: boolean;
  isHalfMinuteDeparture: boolean;
  // CIF booked (timetabled) platform -- `null` when the CIF field is blank;
  // absent on a row stored before the API started carrying it.
  platform?: string | null;
}

export type JourneyStopKind = 'Origin' | 'Intermediate' | 'Terminate';

/** One subsequent calling point of a live departure-board row
 * (`GET /public/stations/{crs}/departures`'s `callingPoints`, from LDBWS
 * `subsequentCallingPoints`; `crates/api/src/render.rs`'s
 * `board_calling_point_json`). `st`/`et`/`at` are LDBWS's own strings:
 * `"HH:MM"` London local time, or for `et` a status word ("On time",
 * "Delayed", "Cancelled"). */
export interface BoardCallingPoint {
  crs: string;
  locationName: string | null;
  st: string | null;
  et: string | null;
  at: string | null;
  isCancelled: boolean;
}

/** `GET /public/trains/resolve`'s 200 body
 * (`crates/api/src/routes/trains.rs`'s `get_trains_resolve`): a live
 * departure-board row resolved to the `(trainUid, serviceDate)` key of
 * `GET /Train/by-uid/{uid}/{date}` (`href`). `serviceDate` is the CIF
 * service date, which is the day BEFORE the board's date for a train that
 * started before midnight. 404/409 are plain text, not this shape. */
export interface TrainResolveResult {
  trainUid: string;
  serviceDate: string; // "YYYY-MM-DD"
  // "rsid": the full retail service ID matched; "rsidPrefix": only its
  // first 6 characters; "timetable": time plus destination/operator.
  matchedOn: 'rsid' | 'rsidPrefix' | 'timetable';
  href: string;
}

/** `common::TimeWindow` on the wire -- `crates/common/src/lib.rs`. Both
 * fields `"HH:MM:SS" | null`. */
export interface TimeWindow {
  after: string | null;
  before: string | null;
}

/* Mid-journey changes (docs/superpowers/specs/2026-10-22-mid-journey-changes-design.md
 * §7, §8, §17.6): breaks, suggestions and the plan's revisions. */

/** What the planner was asked: `cause` of `GET .../alternatives`. */
export type AlternativesCause = 'missed' | 'cancelled' | 'connection' | 'choice';

/** How a suggestion fits the traveller's ticket. */
export type SuggestionFit = 'covered' | 'coveredIfCancelled' | 'check' | 'likelyNewTicket';

/** Why a suggestion is one of the picked cards. */
export type SuggestionPick = 'recommended' | 'fastest' | 'fewestChanges' | 'sameOperator' | 'noTube' | 'rejoin';

/** One leg of a suggestion: a train, or a Tube ride, bus or walk. */
export type ReplanSuggestionLeg =
  | {
      kind: 'train';
      trainUid: string;
      serviceDate: string;
      originCrs: string | null;
      originName: string | null;
      destinationCrs: string | null;
      destinationName: string | null;
      departure: string;
      arrival: string;
      scheduledDeparture: string;
      scheduledArrival: string;
      operator: string | null;
      operatorName: string | null;
      platform: string | null;
      cancelled: boolean;
      /** The change onto this train works only because it is running late
       * (DS-141). Absent otherwise. */
      reliesOnLateDeparture?: LateDepartureReliance;
    }
  | {
      kind: 'untracked';
      transitMode: string;
      originName: string | null;
      destinationName: string | null;
      lineName: string | null;
      originStopId: string | null;
      destinationStopId: string | null;
      plannedDeparture: string;
      plannedArrival: string;
    };

/** One way to carry on. */
export interface ReplanSuggestion {
  /** "s1": unique within its set. */
  id: string;
  departure: string;
  arrival: string;
  changeCount: number;
  /** Minutes later than the booked arrival (negative is earlier). */
  delayMinutes: number | null;
  /** The first leg of the plan this replaces. */
  throughLegId: number;
  /** The later leg of the plan this joins back onto, if any. */
  rejoinsLegId: number | null;
  legs: ReplanSuggestionLeg[];
  cost: number;
  fit: SuggestionFit | null;
  /** The fit badge's words ("Usually covered by your ticket"). */
  fitLabel: string | null;
  /** Why, in a sentence, shown on tap. */
  fitReason: string | null;
  picks: SuggestionPick[];
  /** The pick badges' words ("Recommended", "Fastest"). */
  pickLabels: string[];
  /** One of the (at most three) cards; otherwise under "More options". */
  card: boolean;
  /** The journey's "prefer" operator filter's own route (2026-10-31): its
   * operators, for an "LNER only" badge. Absent otherwise. */
  operatorOnly?: string[];
  /** The journey's operator filter left no route, so this, the best one
   * without it, uses other operators (2026-10-31). Absent otherwise. */
  outsideOperatorFilter?: boolean;
}

/** The leg a set of suggestions starts from. */
export interface SuggestionTrigger {
  legId: number;
  departure: string | null;
  originName: string | null;
  destinationName: string | null;
  trainDestinationName: string | null;
}

/** A set of suggestions: cards first, then the rest, by cost. */
export interface SuggestionSet {
  generatedAt: string;
  fingerprint: string;
  fromLegId: number;
  originCrs: string;
  originName: string | null;
  destinationCrs: string;
  destinationName: string | null;
  departAfter: string;
  bookedArrival: string | null;
  /** A one-line note under the list. */
  hint: string | null;
  trigger: SuggestionTrigger | null;
  suggestions: ReplanSuggestion[];
  stale: boolean;
}

/** A break, with its stored (or fresh) suggestions. */
export interface BreakResponse {
  id: number;
  journeyId: number;
  cause: BreakCause;
  fault: BreakFault;
  severity: number;
  status: string;
  triggerLegId: number | null;
  detectedAt: string;
  openedVia: 'push' | 'in_app' | null;
  faultNote: string | null;
  suggestions: SuggestionSet | null;
  stale: boolean;
}

/** The answer to accepting a suggestion, replacing legs or reverting. */
export interface ReplanResult {
  journeyId: number;
  revisionNo: number;
  newLegIds: number[];
  /** The revision Undo goes back to, `null` when there is none. */
  undoRevisionNo: number | null;
}

/** What became of a leg of an earlier plan. */
export type RevisionLegFate = 'planned' | 'travelled' | 'missed' | 'cancelled' | 'part_cancelled' | 'not_used';

/** One leg of a revision. */
export interface RevisionLeg {
  position: number;
  sourceLegId: number | null;
  kind: 'train' | 'untracked';
  trainUid: string | null;
  serviceDate: string | null;
  atocCode: string | null;
  originCrs: string | null;
  originName: string | null;
  destinationCrs: string | null;
  destinationName: string | null;
  bookedDeparture: string | null;
  bookedArrival: string | null;
  transitMode: string | null;
  originPlace: string | null;
  destinationPlace: string | null;
  lineName: string | null;
  plannedDeparture: string | null;
  plannedArrival: string | null;
  ticketIds: number[];
  fate: RevisionLegFate;
}

/** One plan the journey has had. */
export interface Revision {
  revisionNo: number;
  createdAt: string;
  reason: 'booked' | 'replace' | 'auto_shift' | 'revert';
  cause: string | null;
  fault: string | null;
  breakId: number | null;
  actor: string;
  isCompensationBaseline: boolean;
  canRevert: boolean;
  legs: RevisionLeg[];
}

/** `GET /Journeys/{id}/revisions`, newest first. */
export interface RevisionsResponse {
  revisions: Revision[];
}

/** Quiet hours: `HH:MM` local times in an IANA `timezone`; `end` may be
 * before `start` (through midnight). */
export interface QuietHours {
  start: string;
  end: string;
  timezone: string;
}

/** `GET /preferences/notifications` (and the `PUT`'s answer): a switch per
 * kind of push, the delay threshold (`null`: the default, 15 minutes) and
 * the quiet hours (`null`: none). The fields after `journeySuggestions`
 * are absent from an older backend. */
export interface NotificationPreferences {
  journeySuggestions: boolean;
  lineStatus?: boolean;
  trainDelay?: boolean;
  trainCancel?: boolean;
  predictedStart?: boolean;
  stationSkip?: boolean;
  templateAttention?: boolean;
  delayThresholdMinutes?: 5 | 10 | 15 | 30 | null;
  quietHours?: QuietHours | null;
  /** Notifications are paused (held, as in quiet hours) until this time;
   * `null` when not paused. At most a week ahead. */
  snoozedUntil?: string | null;
}

/** A `PUT /preferences/notifications` body: only the fields sent change. */
export type NotificationPreferencesUpdate = Partial<NotificationPreferences>;

/** One of `GET /notifications/devices`: a browser push goes to. */
export interface PushDevice {
  id: number;
  /** "Chrome on Android", or null when it could not be worked out. */
  label: string | null;
  createdAt: string;
  lastUsedAt: string;
  /** Hex SHA-256 of the push endpoint: hash this browser's to find it. */
  endpointSha256: string;
}

/** Body for `POST /Journeys/{journeyId}/legs` (multi-leg chaining, spec
 * §3) -- two of the three shapes `POST /Journeys` already sends for a
 * journey's first leg (no `pin` mode -- spec §3 only offers a direct
 * known-train pick or an open time-window search for "add a leg"),
 * discriminated by `mode` exactly like the backend's own
 * `AddJourneyLegRequest` (`crates/api/src/routes/journeys.rs`).
 *
 * `knownTrain`'s `originCrs`/`destinationCrs` are OPTIONAL overrides for
 * this leg's own boarding/alighting point -- distinct from the matched
 * train's own full route. Omitting both reproduces the historical
 * pin-derived backend behavior (`origin_crs`/`destination_crs` read back
 * off `train_subscriptions.pin_origin_crs`/`pin_destination_crs`, which is
 * itself copied from the train's own full working, start to end);
 * supplying either overrides just that one field, the other still falls
 * back to the pin. `PlanTripFlow.tsx`'s commit step is the one caller that
 * sets them today, using the real per-leg origin/destination already on
 * each `TripPlanLeg` (e.g. boarding a Birmingham->Glasgow service at
 * Crewe, alighting at Preston). `AddJourneyLegButton.tsx` deliberately
 * never sets them -- the origin/destination-override plan's Judgment Call 2:
 * its `knownTrain` mode
 * only ever asks for a train UID + service date, so it has no real
 * per-leg origin/destination of its own to send that would differ from
 * the pin-derived value it's always relied on. */
export type NewJourneyLegRequest =
  | {
      mode: 'knownTrain';
      trainUid: string;
      serviceDate: string; // "YYYY-MM-DD"
      originCrs?: string;
      destinationCrs?: string;
    }
  | {
      mode: 'window';
      originCrs: string;
      destinationCrs: string;
      serviceDate: string; // "YYYY-MM-DD"
      departWindow?: TimeWindow;
      arriveWindow?: TimeWindow;
      /** The Between stations filters saved with the leg (DS-215).
       * `POST /Journeys/{id}/legs` only. */
      filters?: LegSearchFilters;
    }
  | UntrackedLegRequest;

/** An untracked leg for `POST /Journeys` (`leg`) or `POST
 * /Journeys/{id}/legs` (spec 2026-10-20 §2.4). Places and line are
 * optional; both times are RFC3339 instants. */
export interface UntrackedLegRequest {
  mode: 'untracked';
  transitMode: TransitMode;
  originName?: string;
  destinationName?: string;
  /** A TfL stop picked for the place (`TflStop.id`); Tube, DLR and tram only. */
  originStopId?: string;
  destinationStopId?: string;
  lineName?: string;
  plannedDeparture: string;
  plannedArrival: string;
}

/** `POST /Journeys/{journeyId}/legs`'s response
 * (`crates/api/src/routes/journeys.rs::AddLegResponse`). `trackingId` is
 * `null` for a `window`-mode leg -- no train bound yet, same convention as
 * `CreateJourneyResponse.trackingId`. */
export interface AddJourneyLegResponse {
  legId: number;
  trackingId: number | null;
}

/** `POST /Journeys`'s response
 * (`crates/api/src/routes/journeys.rs::CreateJourneyResponse`). */
export interface CreateJourneyResponse {
  journeyId: number;
  legId: number;
  trackingId: number | null;
  resolutionStatus: string | null;
}

/** One row of `GET /JourneyTemplates/mine`
 * (`crates/api/src/data/journey_templates.rs::JourneyTemplateListItem`,
 * camelCase). Summarized the same way `app/journeys/[id]/page.tsx`'s
 * `defaultJourneyTitle` computes a journey's own fallback title —
 * first leg's origin to last leg's destination — but computed
 * server-side, since a list row has no per-leg detail to derive it from
 * client-side. `leg_count` can be `0` only for a hand-edited row; every
 * template this app's own UI creates has at least one leg. `active`/
 * `daysOfWeek` are round-tripped for Phase C but unused by anything in
 * this app today — Phase B never sets `daysOfWeek` and every template's
 * `active` is always `true`. */
export interface JourneyTemplateListItem {
  id: number;
  customName: string | null;
  createdAt: string;
  legCount: number;
  firstOriginCrs: string | null;
  firstOriginName: string | null;
  lastDestinationCrs: string | null;
  lastDestinationName: string | null;
  active: boolean;
  daysOfWeek: number | null;
}

/** One leg of `GET /JourneyTemplates/{id}`'s response
 * (`crates/api/src/routes/journey_templates.rs::JourneyTemplateLegDetailResponse`).
 * No `serviceDate`/`matchMode`/`trackedTrainState` — a template leg is
 * date-less and never itself bound to a train; contrast with
 * `JourneyLegDetail`. */
export interface JourneyTemplateLegDetail {
  id: number;
  originCrs: string | null;
  originName: string | null;
  destinationCrs: string | null;
  destinationName: string | null;
  departAfter: string | null;
  departBefore: string | null;
  arriveAfter: string | null;
  arriveBefore: string | null;
}

/** `GET /JourneyTemplates/{id}`'s full response. `daysOfWeek`/`active`/
 * `startsOn`/`endsOn`/`defaultMatchMode`/`autoCommitRule` are real,
 * round-tripped fields (Phase C scaffolding, per
 * docs/superpowers/plans/2026-09-22-reusable-journeys-phaseB-durable-templates-plan.md) —
 * this app's own Phase B UI reads none of them for anything beyond
 * display; see `app/journeys/templates/[id]/page.tsx`'s own scope note. */
export interface JourneyTemplateDetail {
  id: number;
  customName: string | null;
  createdAt: string;
  updatedAt: string;
  daysOfWeek: number | null;
  active: boolean;
  startsOn: string | null;
  endsOn: string | null;
  defaultMatchMode: 'manual' | 'auto';
  autoCommitRule: 'earliest' | 'nearest_to_now' | null;
  legs: JourneyTemplateLegDetail[];
}

/** One leg in a `POST /JourneyTemplates` (`mode: 'manual'`) or
 * `PUT /JourneyTemplates/{id}` request body
 * (`crates/api/src/routes/journey_templates.rs::TemplateLegRequest`). No
 * `serviceDate` — see `JourneyTemplateLegDetail`'s own comment. */
export interface TemplateLegRequest {
  originCrs: string;
  destinationCrs: string;
  departWindow?: TimeWindow;
  arriveWindow?: TimeWindow;
}

/** `POST /JourneyTemplates`'s two mutually-exclusive request shapes
 * (`crates/api/src/routes/journey_templates.rs::CreateJourneyTemplateRequest`).
 * This app's own frontend only ever sends `fromJourney` (see
 * `components/SaveAsTemplateButton.tsx`) — `manual` exists on the wire for
 * a future "start from nothing" UI this plan does not build (see that
 * plan's Judgment Call 5), and because `PUT`'s body needs the identical
 * `TemplateLegRequest` shape regardless. */
export type CreateJourneyTemplateRequest =
  | {
      mode: 'manual';
      customName?: string;
      legs: TemplateLegRequest[];
    }
  | {
      mode: 'fromJourney';
      customName?: string;
      journeyId: number;
    };

/** `PUT /JourneyTemplates/{id}`'s request body — full-resource replace,
 * not a per-field patch (see the Phase B plan's Judgment Calls 1/4).
 * `daysOfWeek`/`active`/`startsOn`/`endsOn`/`defaultMatchMode`/
 * `autoCommitRule` are REQUIRED on every request (Phase C's backend task
 * made them non-optional, with no server-side default) — mirror
 * `JourneyTemplateDetail`'s own field types exactly. */
export interface PutJourneyTemplateRequest {
  customName?: string;
  legs: TemplateLegRequest[];
  daysOfWeek: number | null;
  active: boolean;
  startsOn: string | null;
  endsOn: string | null;
  defaultMatchMode: 'manual' | 'auto';
  autoCommitRule: 'earliest' | 'nearest_to_now' | null;
}

/** `POST /JourneyTemplates`'s response
 * (`crates/api/src/routes/journey_templates.rs::CreateJourneyTemplateResponse`). */
export interface CreateJourneyTemplateResponse {
  templateId: number;
}

/** `POST /JourneyTemplates/{id}/materialize`'s request body — always
 * explicit, never defaulted server-side; the "Run now" button's own date
 * field (`components/RunTemplateNowButton.tsx`) defaults to today
 * client-side and lets the caller change it first. */
export interface MaterializeTemplateRequest {
  serviceDate: string; // "YYYY-MM-DD"
}

/** `POST /JourneyTemplates/{id}/materialize`'s response
 * (`crates/api/src/routes/journey_templates.rs::MaterializeTemplateResponse`).
 * `journeyId` is where `RunTemplateNowButton` navigates on success — the
 * same `/journeys/{id}` detail page any other freshly-created journey
 * lands on. */
export interface MaterializeTemplateResponse {
  journeyId: number;
  legIds: number[];
}

/** `POST /Train/track`'s request body (`common::TrackPinRequest`). Plain
 * snake_case on the wire -- unlike every other type in this file, which
 * mirrors `crates/api`'s camelCase public JSON, this one matches
 * `crates/common`'s internal-wire-type convention instead. Sent only from
 * `components/TrackTrainForm.tsx`, via the same-origin `/api/Train/track`
 * proxy (`app/api/[...path]/route.ts`). */
export interface TrackPinRequest {
  service_date: string; // "YYYY-MM-DD"
  origin_crs: string;
  scheduled_departure: string; // RFC3339
  destination_crs?: string;
  operator?: string;
  // CRS codes Darwin's own live departure board reported as skipped today
  // for the specific service being pinned (`DepartureRow.skippedStations`,
  // `TrackTrainForm.tsx`) -- carries that signal past the moment the
  // picker's own live board result expires, so it can end up on the
  // journey timeline's per-stop `skipSource` once a `trains` row exists.
  // Omitted (never sent as `[]`) when there's no such signal to carry --
  // the CIF-picker or manual-entry path, which has no live board at all.
  // See `common::TrackPinRequest.skipped_stations`'s own doc comment.
  skipped_stations?: string[];
  // Same idea as `skipped_stations` immediately above, for Darwin's
  // platform signal instead (`DepartureRow.platform`/`plannedPlatform`) --
  // carries the picked row's platform snapshot through so the journey
  // page's origin stop can show it once a `trains` row exists. See
  // `common::TrackPinRequest.platform`/`planned_platform`'s own doc
  // comments.
  platform?: string;
  planned_platform?: string;
}

/** `POST /Train/track`'s response body -- camelCase, like every other
 * `crates/api` public JSON response (only the request body above is
 * snake_case). `resolutionStatus` is `'pending'` unless a synchronous
 * schedule match succeeded at creation time, in which case it's
 * `'schedule_matched'` -- see
 * docs/superpowers/specs/2026-09-05-schedule-first-train-tracking-design.md
 * Decision 3. */
export interface TrackPinResponse {
  trackingId: number;
  resolutionStatus: ResolutionStatus;
}

export type TicketSource = 'manual' | 'pkpass-semantics' | 'pkpass-heuristic' | 'pdf-heuristic';

/** `GET /Train/{trackingId}/tickets`'s per-item response shape
 * (`crates/api/src/data/train_tracking.rs`'s `TrackedTrainTicket`,
 * camelCase). Never includes `userId` -- same posture as
 * `TrackedTrainState`. Nothing caps a tracked train at one ticket; multiple
 * tickets per tracked train are a real, supported case (see
 * `components/TicketPanel.tsx`). `trackedTrainId` is `number | null` --
 * `null` for a STANDALONE ticket (uploaded/entered before a tracked train
 * exists for it, per the upload-first flow) that hasn't been attached to
 * one yet. Every row `GET /Train/{trackingId}/tickets` itself returns is
 * always attached (that route is scoped BY a `tracked_train_id`), so this
 * only ever reads `null` when the same wire shape is reused for a ticket
 * fetched a different way (e.g. `get_ticket_owned`, used internally by the
 * attach flow) -- callers of THIS route can treat it as always non-null in
 * practice, but the type stays honest about the shape. */
export interface TrackedTrainTicket {
  id: number;
  trackedTrainId: number | null;
  operator: string | null;
  ticketType: string | null;
  originCrs: string | null;
  destinationCrs: string | null;
  // Joined on THIS ticket's own origin/destination, not the pin route --
  // see `lib/stationLabel.ts`'s fallback.
  originName: string | null;
  destinationName: string | null;
  // The ticket's own claimed departure INSTANT (RFC3339), when the source
  // format carried one -- currently only ever populated from a `.pkpass`'s
  // `semantics.currentDepartureDate`. A best-effort HINT for
  // `GET /Train/tickets/{ticketId}/journey-leg-proposal`
  // (`CreateJourneyLegFromTicketButton.tsx`), never a hard pin -- see
  // `crates/api/src/data/ticket_extraction.rs::PartialTicket::current_departure_date`'s
  // own doc comment. `null` for every ticket saved before this feature
  // existed, every PDF-sourced ticket, and any `.pkpass` whose `semantics`
  // dictionary doesn't populate this key.
  currentDepartureDate: string | null;
  source: TicketSource;
  createdAt: string; // RFC3339
  // User-authored display label, or `null` for the computed default -- see
  // `TicketSummary.tsx`. Never inferred from an uploaded `.pkpass`/PDF.
  customName: string | null;
}

/** `POST /Train/{trackingId}/tickets`'s request body
 * (`common::TicketEntryRequest`) -- snake_case, matching `TrackPinRequest`'s
 * own internal-wire-type convention (unlike every other type in this file,
 * which mirrors `crates/api`'s camelCase public JSON). `source` is not
 * optional on this type even though the backend defaults it to `'manual'`
 * -- `components/TicketEntryForm.tsx` always sends it explicitly, since it
 * needs to track the current provenance of the fields it's submitting
 * regardless of which tab produced them. Also the request body for
 * `POST /Train/tickets` (no `trackingId` in the path at all) -- the
 * upload-first, standalone-ticket-creation route; the body shape is
 * identical, only the URL and the resulting ticket's `trackedTrainId`
 * differ. */
export interface TicketEntryRequest {
  operator?: string;
  ticket_type?: string;
  origin_crs?: string;
  destination_crs?: string;
  // See `TrackedTrainTicket.currentDepartureDate`'s own comment -- same
  // value, carried through unedited from whichever upload preview (if any)
  // produced it. RFC3339.
  current_departure_date?: string;
  source: TicketSource;
}

export interface TicketCreatedResponse {
  ticketId: number;
}

/** `POST /Train/tickets/{ticketId}/attach`'s request/response shapes --
 * attaches an existing standalone ticket (one created via
 * `POST /Train/tickets`, still `trackedTrainId: null`) to a tracked train
 * the caller owns, once they've found or created the one it's actually
 * for. `404` (ticket or tracked train doesn't exist / isn't the caller's --
 * this app's universal "never 403" convention) and `409` (the ticket is
 * already attached to something) are both real, distinct outcomes a caller
 * needs to handle -- see `components/AttachTicketAction.tsx`. */
export interface AttachTicketRequest {
  trackingId: number;
}

export interface AttachTicketResponse {
  ticketId: number;
  trackedTrainId: number;
}

/** `POST .../tickets/pkpass` and `POST .../tickets/pdf`'s shared response
 * shape -- every field independently nullable; "not found in this file" is
 * expected, not an error. Never persisted to the database by either upload
 * route -- this is only ever a preview
 * (`components/TicketEntryForm.tsx` pre-fills the manual-entry fields from
 * it and requires a second, separate submit to actually save anything). */
export interface PartialTicket {
  operator: string | null;
  ticketType: string | null;
  originCrs: string | null;
  destinationCrs: string | null;
  // See `TrackedTrainTicket.currentDepartureDate`'s own comment -- same
  // field, RFC3339, absent (not just `null`) from the wire whenever the
  // parse didn't recover one (`#[serde(skip_serializing_if = "Option::is_none")]`
  // on the Rust side).
  currentDepartureDate?: string;
  source: TicketSource;
}

/** Present only inside a non-null `DelayRepayEstimateResponse.estimate`.
 * `disclaimer` here is a DIFFERENT string from
 * `DelayRepayEstimateResponse.disclaimer` (the top-level field) -- see
 * `components/DelayRepayEstimate.tsx`, which renders only the top-level
 * one. */
export interface DelayRepayEstimate {
  /** `HX` is Heathrow Express's own scheme (25% / 50% of the ticket for
   * more than 30 / 60 minutes). */
  scheme: 'DR15' | 'DR30' | 'HX';
  /** 15, 30, 60 or 120 (`HX`: 30 or 60, meaning "more than"). */
  bandMinutes: number;
  /** `null` exactly when `borderline`: the band could go either way, so no
   * figure is shown. */
  percentage: number | null;
  /** Which fare `percentage` is of: `single` below 120 minutes and for a
   * single ticket at 120+, `return` at 120+ for a return or a ticket of
   * unknown kind (see `ticketKind`), `ticket` for Heathrow Express.
   * Optional: absent from an older backend (read as `single`). */
  fareBasis?: 'single' | 'return' | 'ticket';
  /** What the ticket's type clearly says it is. */
  ticketKind?: TicketKind;
  /** Caledonian Sleeper: the percentage of the room supplement; else `null`. */
  roomSupplementPercentage?: number | null;
  /** `true` while provisional and the projection is less than 3 minutes
   * above `thresholdMinutes`. */
  borderline?: boolean;
  thresholdMinutes?: number | null;
  /** `true` while the train has not reached the ticket's destination: the
   * band is a projection and `disclaimer` says so. */
  provisional?: boolean;
  disclaimer: string;
}

/** What a ticket's free-text type clearly says it is. */
export type TicketKind = 'single' | 'return' | 'unknown';

/** Whether the train got to the ticket's destination: `arrived` (final),
 * `departedOnly` (final, measured on its departure there: the station
 * reports departures only), `notReached` (cancelled, terminated short or
 * ran through it). `null` while not known yet. */
export type DelayRepayOutcome = 'arrived' | 'departedOnly' | 'notReached';

/** The Delay Repay fields shared by `GET .../delay-repay` and
 * `GET /Train/tickets/mine` (2026-10-07). All optional: absent from an older
 * backend. */
export interface DelayRepayExtraFields {
  /** `measuredAtCrs`'s station name, when known. */
  measuredAtName?: string | null | undefined;
  outcome?: DelayRepayOutcome | null | undefined;
  /** The operator runs its own compensation scheme: no percentage. */
  ownScheme?: boolean | undefined;
  /** The scheme's operator name, when it is one the rules know. */
  schemeOperator?: string | null | undefined;
  /** When the rules were last checked, `YYYY-MM-DD`. */
  rulesCheckedOn?: string | undefined;
}

/** `GET .../tickets/{ticketId}/delay-repay`'s response. `claimUrl` and the
 * top-level `disclaimer` are ALWAYS populated, independent of `estimate` --
 * this route never returns a bare percentage with no caveat and no link.
 * `estimate` is `null` whenever any of three things is true (no operator on
 * the ticket, no delay data on the train yet, or a real delay that just
 * didn't clear the matched scheme's lowest band) -- the response gives no
 * signal which of the three applied; see
 * `components/DelayRepayEstimate.tsx` for how this is rendered honestly
 * without inventing a reason the API doesn't give. */
export interface DelayRepayEstimateResponse extends DelayRepayExtraFields {
  /** Against the PUBLIC arrival at `measuredAtCrs` (the ticket's
   * destination): final once the train has arrived there, projected before
   * (`provisional`). */
  delayMinutes: number | null;
  provisional?: boolean | undefined;
  delayBasis?: DelayBasis | null | undefined;
  measuredAtCrs?: string | null | undefined;
  estimate: DelayRepayEstimate | null;
  claimUrl: string;
  disclaimer: string;
  /** What the ticket's service is; a bus or ferry has no measurable delay. */
  serviceMode?: ServiceMode | null;
  liveTracking?: boolean | null;
  /** Why there is no delay at all (a bus or ferry leg); `null` for a train. */
  unmeasurableReason?: string | null;
}

/** `GET /Train/tickets/mine`'s per-item response shape
 * (`crates/api/src/data/train_tracking.rs`'s `TicketListItem`, camelCase).
 * The last four fields are deliberately shaped identically to
 * `DelayRepayEstimateResponse` so a `TicketListItem` can be passed
 * straight into `<DelayRepayEstimate>` with no adapter -- see
 * docs/superpowers/specs/2026-08-31-tickets-list-design.md's Finding 7 /
 * Decision 1.
 *
 * `trackedTrainId` and every train-context field (`serviceDate`,
 * `pinOriginCrs`, `pinDestinationCrs`, `pinScheduledDeparture`,
 * `resolutionStatus`, `trainUid`, `status`) are now nullable -- all `null`
 * together for a STANDALONE ticket (uploaded/entered before a tracked
 * train exists for it) that hasn't been attached to one yet. `estimate`/
 * `delayMinutes` are already nullable and stay `null` for the same row, by
 * construction (no train means no delay data to estimate against) --
 * `claimUrl`/`disclaimer` stay unconditionally populated regardless, same
 * invariant as an attached ticket whose train hasn't reported a delay yet. */
export interface TicketListItem extends DelayRepayExtraFields {
  id: number;
  trackedTrainId: number | null;
  operator: string | null;
  ticketType: string | null;
  originCrs: string | null;
  destinationCrs: string | null;
  // See `TrackedTrainTicket.originName`'s comment -- same contract.
  originName: string | null;
  destinationName: string | null;
  source: TicketSource;
  createdAt: string; // RFC3339 -- list ordering key
  serviceDate: string | null; // "YYYY-MM-DD"
  pinOriginCrs: string | null;
  pinDestinationCrs: string | null;
  pinScheduledDeparture: string | null; // RFC3339
  resolutionStatus: ResolutionStatus | null;
  trainUid: string | null;
  status: JourneyStatus | null;
  /** See `DelayRepayEstimateResponse.delayMinutes`. */
  delayMinutes: number | null;
  provisional?: boolean;
  delayBasis?: DelayBasis | null;
  measuredAtCrs?: string | null;
  estimate: DelayRepayEstimate | null;
  claimUrl: string;
  disclaimer: string;
  // See `TrackedTrainTicket.customName`'s comment -- same contract.
  customName: string | null;
}

/** `GET /Train/tickets/{ticketId}/journey-leg-proposal`'s response
 * (`crates/api/src/data/journey_leg_proposal.rs::JourneyLegProposal`,
 * camelCase). A read-only, propose-and-confirm PREVIEW derived from an
 * already-saved ticket's own fields -- never anything this route itself
 * creates. `originCrs`/`destinationCrs` are echoed back exactly as the
 * ticket stored them (unnormalized); `serviceDate`/`departAfter`/
 * `departBefore` are `null` together whenever the ticket has no
 * `currentDepartureDate` at all (no honest calendar day to propose without
 * one) -- see `CreateJourneyLegFromTicketButton.tsx`, the one caller of
 * this type, for how the non-null fields become a `/track?...` deep link
 * into the EXISTING window-mode leg-creation form (`TrackTrainForm.tsx`),
 * which the caller must still explicitly review and submit. No
 * `arriveAfter`/`arriveBefore` -- a ticket's departure date/time never
 * implies an arrival window, so there's nothing non-guessed to propose
 * there (see the Rust type's own doc comment). */
export interface JourneyLegProposal {
  originCrs: string | null;
  destinationCrs: string | null;
  serviceDate: string | null; // "YYYY-MM-DD"
  departAfter: string | null; // "HH:MM:SS"
  departBefore: string | null; // "HH:MM:SS"
}

// ---------------------------------------------------------------------------
// Chat (embedded-chatbot-option-b-client-side-tokens plan) -- ChatPanel's
// own browser-side tool-calling loop, not a server-side orchestrator
// (that was removed, see that plan's Task 5).
// ---------------------------------------------------------------------------

/** Mirrors `distant-signal-mcp`'s own `StationRef`
 * (`src/tools/plan-journey.ts`) -- ported here (not imported: a separate
 * repository, no shared package) only as far as `ChatPanel` actually needs
 * for the "track this leg" deep-link. */
export interface RenderedStationRef {
  tiploc: string;
  name: string | null;
  crs: string | null;
}

/** Ported from `distant-signal-mcp`'s own `RenderedTrainLeg`
 * (`src/tools/plan-journey.ts:160-179`, per the chatbot MCP-integration
 * research doc's own citation) -- only the fields `ChatPanel`'s "track
 * this leg" card actually reads. A `plan_journey` tool-result's
 * `structuredContent` carries the full shape (including `RenderedTransferLeg`
 * siblings this app never renders a card for); this type is intentionally
 * a subset, not a 1:1 port of every field distant-signal-mcp defines. */
export interface RenderedTrainLeg {
  kind: 'train';
  from: RenderedStationRef;
  to: RenderedStationRef;
  departure: string;
  arrival: string;
  departureAt: string | null;
  arrivalAt: string | null;
  operator: string | null;
  uid: string;
}

// Shared groups -- see
// docs/superpowers/specs/2026-09-11-shared-groups-design.md. Mirrors
// crates/api/src/data/groups.rs's own wire shapes exactly.

export type GroupRole = 'owner' | 'admin' | 'member';

/** `token` is only ever non-null in the `POST .../invite-link` response
 * that just minted it: tokens are stored hashed server-side (2026-09-26
 * review, L14), so `GroupDetail.inviteLink` can say a link is active and
 * when it expires, but can never hand its token back. */
export interface GroupInviteLink {
  token: string | null;
  expiresAt: string; // RFC3339
}

/** `POST /Journeys/{id}/share-link`'s (and `.../share-link/extend`'s)
 * response, and the `shareLink` field embedded on `JourneyDetail` for the
 * owner only. `expiresAt` is set on every link minted since the 2026-09-26
 * review's L17 fix (30-day TTL, extendable); still typed nullable because
 * the column itself is nullable for other resource types. */
export interface JourneyShareLink {
  /** Non-null only in the `POST` response that minted it -- see
   * `GroupInviteLink.token`: tokens are hashed at rest, so an existing
   * link's URL can't be shown again. */
  token: string | null;
  expiresAt: string | null;
}

export interface GroupSummary {
  id: string;
  name: string;
  role: GroupRole;
  memberCount: number;
}

export interface GroupDetail {
  id: string;
  name: string;
  ownerId: string;
  /** Same contract as `GroupMember.displayName`: the owner's own name, or
   * `null` -- never their email address. */
  ownerName: string | null;
  /** Same contract as `GroupMember.displayTag`. */
  ownerTag: string | null;
  memberCount: number;
  role: GroupRole;
  // `null` for a plain `member` -- the invite link is only ever included
  // for an `admin`/`owner` caller (see `routes::groups::get_group`'s own
  // doc comment).
  inviteLink: GroupInviteLink | null;
}

export interface GroupMember {
  userId: string;
  /** The member's own name, or `null` when their identity provider has no
   * name on file for them -- never their email address (the backend
   * deliberately doesn't fall back to one: `crates/api/src/data/users.rs`'s
   * `display_label`). Render `null` as a generic placeholder -- via
   * `lib/memberLabel.ts`'s `memberLabel`, which also appends `displayTag`. */
  displayName: string | null;
  /** Six hex characters that distinguish this member from the other
   * placeholder-rendered members of the same group, and `null` whenever
   * `displayName` is set (a real name is never suffixed). Derived from
   * `userId` and never from an email address -- see
   * `crates/api/src/data/users.rs`'s `MemberDisplay`. Without it, an
   * identity provider whose username claim is the user's email by design
   * (Entra ID's UPN) renders every single member of a group as the same
   * indistinguishable "A member". */
  displayTag: string | null;
  role: GroupRole;
  joinedAt: string; // RFC3339
}

/** A train shared into a group -- deliberately carries no ticket field and
 * no `notificationsEnabled`/exact-`trackedAt` field (spec §4's "Never
 * shown" list is a hard constraint on the backend response this mirrors).
 * `serviceMode`/`liveTracking` and `trackingPhase`/`firstReportExpectedAt`
 * are the same as on the owner's own `TrackedTrainListItem` (2026-10-20),
 * so the badge reads the same on every page. Optional: absent from an
 * older backend. */
export interface GroupTrain extends ServiceModeFields, TrackingPhaseFields {
  trainSubscriptionId: number;
  pinOriginCrs: string | null;
  pinDestinationCrs: string | null;
  pinOriginName: string | null;
  pinDestinationName: string | null;
  pinScheduledDeparture: string | null; // RFC3339
  serviceDate: string; // "YYYY-MM-DD"
  resolutionStatus: string;
  trainUid: string | null;
  status: string | null;
  delayMinutes: number | null;
  /** What `delayMinutes` was measured against: `public` (TRUST's own public
   * time), `publicSchedule` (the timetable's public time) or `working` (no
   * public time known). Optional: absent from an older backend. */
  delayBasis?: DelayBasis | null;
  /** `true` while `delayMinutes` is a forecast (the train has not reached
   * the stop it is measured at yet). */
  delayProvisional?: boolean;
  customName: string | null;
  addedBy: string;
  /** Same contract as `GroupMember.displayName`: the sharer's own name, or
   * `null` -- never their email address. */
  addedByName: string | null;
  /** Same contract as `GroupMember.displayTag`, for the sharer. */
  addedByTag: string | null;
}

/** `GET /public/groups/shared-trains`'s per-item shape
 * (`crates/api/src/data/groups.rs`'s `SharedTrain`): a `GroupTrain` plus
 * the group it was shared into, since this route's rows come from every
 * group the caller belongs to at once rather than one named group.
 *
 * One item per (group, train) pair -- a train shared into two of the
 * caller's groups arrives twice, once per group, so no attribution is
 * lost on the wire; `/journeys` merges those back into a single row
 * carrying both group tags. Never includes the caller's OWN tracked
 * trains (those are `TrackedTrainListItem`s already), and carries the same
 * "never shown" privacy constraint `GroupTrain` does -- no tickets, no
 * notification state, no exact tracked-at timestamp. */
export interface SharedGroupTrain extends GroupTrain {
  groupId: string;
  groupName: string;
}

/** A custom line granted into a group by its OWNER
 * (`crates/api/src/data/groups.rs`'s `GroupCustomLine`) -- identity and
 * attribution only. The line's definition and live status are read through
 * the ordinary `/lines/{id}` and `/Line/{ids}/Status` routes, which the
 * grant widens for every member of the group, rather than being duplicated
 * onto this shape.
 *
 * A grant conveys READ access only: no group member other than the owner
 * can ever edit, delete, or re-share the line. */
export interface GroupCustomLine {
  lineId: string;
  lineName: string;
  grantedBy: string;
  /** Same contract as `GroupMember.displayName`/`GroupTrain.addedByName`:
   * the sharer's own name, or `null` -- never their email address. */
  grantedByName: string | null;
  /** Same contract as `GroupTrain.addedByTag`: set only when
   * `grantedByName` is `null`, so a group whose IdP can name nobody can
   * still tell one member's shared line from another's. Render through
   * `memberLabel`, never on its own. */
  grantedByTag: string | null;
}

/** `GET /public/groups/shared-custom-lines`'s per-item shape
 * (`crates/api/src/data/groups.rs`'s `SharedCustomLine`): a
 * `GroupCustomLine` plus the group it was granted into, since this route's
 * rows come from every group the caller belongs to at once.
 *
 * One item per (group, line) pair -- a line granted into two of the
 * caller's groups arrives twice, so no attribution is lost on the wire;
 * `lib/sharedCustomLines.ts` merges those back into a single row carrying
 * both group tags. Never includes the caller's OWN custom lines. */
export interface SharedGroupCustomLine extends GroupCustomLine {
  groupId: string;
  groupName: string;
}

/** A journey shared into a group -- `crates/api/src/data/groups.rs`'s
 * `GroupJourney`. Carries the journey's own identity plus its FIRST leg's
 * identity/live-status fields (not a full multi-leg rollup -- see this
 * feature's plan, Judgment Call 2) and a `legCount` so a multi-leg journey
 * at least signals "there's more". Same "never shown" privacy constraint
 * `GroupTrain` documents: no ticket field, no notification state, no
 * exact `addedAt`.
 *
 * The row summarises the journey's first TRAIN leg, else its first leg.
 * `kind` and the untracked fields say which (`kind: 'untracked'` means the
 * journey has no train legs); `trackingPhase` and `serviceMode` describe
 * that leg's train, and are absent when it has none picked yet. All
 * optional: absent from an older backend (2026-10-20). */
export interface GroupJourney extends ServiceModeFields, TrackingPhaseFields, Omit<UntrackedLegFields, 'lineName'> {
  journeyId: number;
  customName: string | null;
  legCount: number;
  pinOriginCrs: string | null;
  pinDestinationCrs: string | null;
  pinOriginName: string | null;
  pinDestinationName: string | null;
  pinScheduledDeparture: string | null; // RFC3339
  /** The journey's own ends, from its legs rather than the first leg's
   * train: the first leg's origin and the last leg's destination. What
   * names the row (`lib/journeyName.ts`). Optional: absent from an older
   * backend. */
  firstOriginCrs?: string | null;
  firstOriginName?: string | null;
  lastDestinationCrs?: string | null;
  lastDestinationName?: string | null;
  /** The FIRST leg's service date. */
  serviceDate: string; // "YYYY-MM-DD"
  resolutionStatus: string | null;
  trainUid: string | null;
  status: string | null;
  delayMinutes: number | null;
  /** What `delayMinutes` was measured against: `public` (TRUST's own public
   * time), `publicSchedule` (the timetable's public time) or `working` (no
   * public time known). Optional: absent from an older backend. */
  delayBasis?: DelayBasis | null;
  /** `true` while `delayMinutes` is a forecast (the train has not reached
   * the stop it is measured at yet). */
  delayProvisional?: boolean;
  addedBy: string;
  /** Same contract as `GroupMember.displayName`: the sharer's own name, or
   * `null` -- never their email address. */
  addedByName: string | null;
  /** Same contract as `GroupMember.displayTag`, for the sharer. */
  addedByTag: string | null;
  /** Whether the caller follows this journey (DS-146). Optional: absent
   * from an older backend. */
  following?: boolean;
}

/** `GET /public/groups/shared-journeys`'s per-item shape
 * (`crates/api/src/data/groups.rs`'s `SharedJourney`): a `GroupJourney`
 * plus the group it was shared into. The Journeys page lists these beside
 * the caller's own rows (DS-124: a tracked train is shared as its one-leg
 * journey). */
export interface SharedGroupJourney extends GroupJourney {
  groupId: string;
  groupName: string;
}

/** One group a custom line is shared into, as its OWNER sees it on their
 * own edit page. Only ever populated for the owner -- see
 * `CustomLineDetail.sharedWithGroups`. */
export interface LineGroupRef {
  id: string;
  name: string;
}

export interface GroupJoinPreview {
  groupId: string;
  groupName: string;
  memberCount: number;
}

export type LineTrainCallingPointKind = 'Origin' | 'Intermediate' | 'Terminate';

/** One calling point inside a `GET /public/lines/{id}/trains?date=` entry's
 * `callingPoints` array (`crates/api/src/routes/lines.rs`'s `get_line_trains`,
 * rendered by `crates/api/src/render.rs`'s `line_train_json`). NOT the same
 * shape as `ScheduleCallingPoint` above (that one is fully camelCase,
 * backed by a different Rust type, `schedule_matching::ScheduleCallingPointDto`).
 * `line_train_json` passes the population entry's `calling_points` array
 * through UNPROCESSED -- only the outer `callingPoints` envelope key is
 * camelCase; see `render.rs`'s own
 * `line_train_json_with_no_live_row_passes_the_population_entry_through_and_nulls_live_status`
 * test, which asserts `json["callingPoints"] == entry["calling_points"]`
 * verbatim. Field names below are therefore this crate's usual accidental
 * exception, not a typo: the real `schedule_query::CallingPoint` snake_case
 * names, the same documented wart `get_line_schedule`'s own doc comment
 * accepts for this identical underlying data. */
export interface LineTrainCallingPoint {
  tiploc: string;
  kind: LineTrainCallingPointKind;
  booked_arrival: string | null; // "HH:MM:SS", CIF/UK-local, no date component
  booked_departure: string | null;
  is_half_minute_arrival: boolean;
  is_half_minute_departure: boolean;
  day_offset: number;
}

/** The `liveStatus` field of a `GET /public/lines/{id}/trains?date=` entry
 * -- `null` whenever no live `trains`/`train_current_state` row exists yet
 * for this UID on this date (an expected, honest gap: this route never
 * triggers a `find_or_create_train` upsert the way
 * `GET /Train/by-uid/{uid}/{date}` does -- see `get_line_trains`'s own doc
 * comment). Deliberately its own type, not a reuse of `PublicTrainState`:
 * `line_train_json` (`render.rs`) includes only these 21 fields
 * inside `liveStatus`, explicitly omitting `journeyStops`/`callingPoints`/
 * `trainUid`/`serviceDate`/`mayHaveArrived` -- confirmed by that file's
 * `line_train_json_with_a_live_row_attaches_live_status_in_camel_case`
 * test, which asserts all five omitted fields are absent. */
export interface LineTrainLiveStatus {
  trainsId: number;
  trainId: string | null;
  originCrs: string | null;
  originName: string | null;
  destinationCrs: string | null;
  destinationName: string | null;
  scheduledDeparture: string | null; // RFC3339
  status: JourneyStatus | null;
  lastReportedLocation: string | null;
  lastEventType: string | null; // "ARRIVAL" | "DEPARTURE" | "PASS"
  /** Against the PUBLIC timetable at the passenger's own stop (a tracked
   * train's pin destination; on the public train page, the latest call the
   * train reported at). */
  delayMinutes: number | null;
  /** What `delayMinutes` was measured against: `public` (TRUST's own public
   * time), `publicSchedule` (the timetable's public time) or `working` (no
   * public time known). Optional: absent from an older backend. */
  delayBasis?: DelayBasis | null;
  /** `true` while `delayMinutes` is a forecast (the train has not reached
   * the stop it is measured at yet). */
  delayProvisional?: boolean;
  nextCallingPoint: string | null;
  etaNext: string | null; // RFC3339
  etaSource: EtaSource | null;
  // See `TrainJourneyState.operatorCode`.
  operatorCode?: string | null;
  operatorName?: string | null;
  // See `TrainJourneyState.cancelled` and the reason fields after it.
  cancelled?: boolean;
  cancelReasonCode?: string | null;
  cancelReason?: string | null;
  changeOfOriginReasonCode?: string | null;
  changeOfOriginReason?: string | null;
}

/** One `GET /public/lines/{id}/trains?date=` response entry
 * (`crates/api/src/routes/lines.rs`'s `get_line_trains`) -- every scheduled
 * UID on one line for one rail day, paired with live status where one
 * already exists. See that route's own doc comment and
 * docs/superpowers/specs/2026-09-09-mcp-schedule-data-follow-up-design.md
 * §5.3. The full response is `LineTrainEntry[]`, not wrapped in an
 * envelope -- unlike `GET /public/trains/search`, this route has no cursor
 * of its own; it always returns the whole day's population in one call. */
export interface LineTrainEntry extends ServiceModeFields {
  uid: string;
  callingPoints: LineTrainCallingPoint[] | null;
  /** The schedule side's own origin/destination -- the first and last
   * `callingPoints` entries' TIPLOCs, resolved server-side to a CRS and
   * name (`crates/api/src/render.rs`'s `ScheduleRouteEndpoints`). Present
   * (though any individual field may still be `null`) on every entry,
   * regardless of `liveStatus` coverage -- unlike `liveStatus.originCrs`
   * etc., which is `null` whenever a live record has no schedule match of
   * its own. Added so `LineTrainsResults` can always name a route from the
   * schedule when the live side can't (2026-09-22 UX review §4.1). */
  scheduleOriginCrs: string | null;
  scheduleOriginName: string | null;
  scheduleDestinationCrs: string | null;
  scheduleDestinationName: string | null;
  liveStatus: LineTrainLiveStatus | null;
}

/** A train's membership of a line (docs/superpowers/specs/2026-10-06-line-membership-design.md):
 * `line` one of its own trains, `shared` another route's train running a
 * stretch of it, `touch` only touching it (a hub call). */
export type LineTrainScope = 'line' | 'shared' | 'touch';

/** Direction along the line's catalogue station order: `down` from the
 * first station towards the last, `up` the reverse, `loop` back to where
 * the run started. */
export type LineDirection = 'up' | 'down' | 'loop';

/** A time on the line: `"HH:MM"` UK local time, `dayOffset` days after
 * the service date. */
export interface LineTime {
  time: string;
  dayOffset: number;
}

/** One public call at one of the line's stations. */
export interface LineTrainStop extends LineTime {
  crs: string;
}

export interface LineStationRef {
  crs: string;
  name: string | null;
}

/** The compact live status of `GET /public/lines/{id}/trains?view=summary`. */
export interface LineTrainSummaryLive {
  status: string | null;
  delayMinutes: number | null;
  delayProvisional: boolean;
  cancelled: boolean;
  /** The cancellation's Network Rail reason text while `cancelled`
   * (DS-181). Optional: absent from an older backend. */
  cancelReason?: string | null;
  lastReportedLocation: string | null;
}

/** One train of the summary view (`crates/api/src/routes/line_trains_summary.rs`). */
export interface LineTrainSummary {
  uid: string;
  operator: string | null;
  /** `schedule_services`' mode, else from the CIF Train Status; see
   * `lib/serviceMode.ts`. */
  serviceMode: ServiceMode;
  /** `false` exactly when `serviceMode` is not `train`. */
  liveTracking?: boolean | null;
  scope: LineTrainScope | null;
  direction: LineDirection | null;
  /** The first public call on the line: the row's time and sort key. */
  lineDue: LineTime | null;
  origin: LineStationRef | null;
  /** Never null when the train calls on the line. */
  destination: LineStationRef | null;
  onLineStops: LineTrainStop[];
  live: LineTrainSummaryLive | null;
}

/** A catalogue station of the line, with its `role`
 * (`terminus`/`major`/`minor`/`junction`, lines/SCHEMA.md). */
export interface LineCatalogueStation {
  crs: string;
  name: string | null;
  role: string;
}

/** `GET /public/lines/{id}/trains?view=summary` (2026-10-06). */
export interface LineTrainsSummary {
  lineId: string;
  date: string;
  /** `false` for a population published before train membership: nothing
   * was filtered and `scope`/`direction` are null. */
  scopeApplied: boolean;
  scopes: LineTrainScope[];
  /** `"HH:MM"`, hours past 23 for the next morning. */
  window: { from: string; to: string } | null;
  at: string | null;
  directions: LineDirection[] | null;
  stations: LineCatalogueStation[];
  /** Trains in the window per scope, then per direction (`none` when a
   * train has none), before the direction filter. */
  counts: Partial<Record<string, Partial<Record<string, number>>>>;
  truncated: boolean;
  trains: LineTrainSummary[];
  /** Trains on the line at `at` (only when `at` was given). */
  running: LineTrainSummary[] | null;
}

/** One train of `GET /public/lines/{id}/timetable`: the summary row, plus
 * the time it is listed at and its arrival at `to`. */
export interface LineTimetableTrain extends LineTrainSummary {
  /** Departure from `from` when given, else `lineDue`. */
  time: LineTime;
  /** Arrival at `to`, when `to` was given. */
  arrival: LineTime | null;
}

/** `GET /public/lines/{id}/timetable` (2026-10-07): one page of the line's
 * full-day timetable (`crates/api/src/routes/line_timetable.rs`). */
export interface LineTimetablePage {
  lineId: string;
  date: string;
  scopeApplied: boolean;
  scopes: LineTrainScope[];
  directions: LineDirection[] | null;
  from: string | null;
  to: string | null;
  at: string | null;
  stations: LineCatalogueStation[];
  /** The day's trains under `scope`/`from`/`to`, per scope then direction
   * (`none` when a train has none), before `dir`, `at` and the cursor. */
  counts: Partial<Record<string, Partial<Record<string, number>>>>;
  trains: LineTimetableTrain[];
  /** Pass back as `after`; `null` on the last page. */
  nextCursor: string | null;
}

/** One row of `GET /public/trains/search` (`render::calling_point_departure_json`).
 * The one wire type for this route (the station board, `/trains` and the
 * line page's station-pair search all read it). */
export interface TrainSearchResult extends ServiceModeFields {
  uid: string;
  /** The departure at `stationCrs`, `HH:MM`: the public time, else the
   * working one. Working (WTT) from an older backend. */
  scheduled: string | null;
  /** The public (timetable) departure, shown in place of `scheduled` (for
   * an older backend). `null`/absent until the next schedule publish. */
  publicDeparture?: string | null;
  /** The working-timetable departure and its `dayOffset`; absent from an
   * older backend. */
  workingDeparture?: string | null;
  workingDayOffset?: number;
  /** The searched calling point, echoed back on every row. */
  stationCrs: string;
  /** The schedule's TRUE origin and destination; either can be
   * unresolved for a real published schedule. */
  originCrs: string | null;
  destinationCrs: string | null;
  /** Names resolved from the codes; `null` when unresolved, absent from a
   * backend that predates the field. */
  originName?: string | null;
  destinationName?: string | null;
  /** Public arrival at the destination, else the working one. */
  destinationArrival: string | null;
  /** Calendar days past the service date `destinationArrival` falls on. */
  destinationArrivalDayOffset: number;
  publicDestinationArrival?: string | null;
  workingDestinationArrival?: string | null;
  /** The row's service date, `"YYYY-MM-DD"`: the searched date, or with
   * `across_midnight` the day before (a train of that date still running
   * after its midnight). The row's train page and every day offset on it
   * are of this date. Absent from an older backend: the searched date. */
  serviceDate?: string;
  /** Days after the row's service date the departure from `stationCrs`
   * falls on. Moves the calendar day only, never the service date, so a
   * row's link keeps its service date. Absent from an older backend: read
   * as 0. */
  dayOffset?: number;
  /** The operating ATOC code, `null` when unknown. */
  operator?: string | null;
  /** The CIF Train Identity (headcode, e.g. `1S00`), `null` when blank or
   * not yet published; absent from an older backend. */
  identity?: string | null;
  /** The same headcode under the train payloads' older name, read when
   * `identity` is absent (as `PublicTrainState` does). */
  headcode?: string | null;
  /** The line summary's compact live status, `null` when the train has
   * none; absent from an older backend. Either way the row reads
   * "Scheduled". */
  live?: LineTrainSummaryLive | null;
  /** Only when the search set `stops_at`: the public arrival (`HH:MM`) at
   * the earliest call at `stops_at` the filter accepted, `null` when
   * unknown. Absent without `stops_at` and from an older backend. */
  stopsAtArrival?: string | null;
  /** Days after the searched date `stopsAtArrival` falls on; `null` with it. */
  stopsAtArrivalDayOffset?: number | null;
  /** The working-timetable arrival at that call (what
   * `arrival_from`/`arrival_to` compare), `HH:MM`, and its day offset. */
  stopsAtWorkingArrival?: string | null;
  stopsAtWorkingArrivalDayOffset?: number | null;
}

export interface TrainSearchPage extends TimetableCertaintyFields {
  results: TrainSearchResult[];
  nextCursor: string | null;
  /** The service date searched, `"YYYY-MM-DD"`: the whole train day of it,
   * its after-midnight departures (`dayOffset` 1) included. Absent from an
   * older backend. */
  serviceDate?: string;
  /** The time window as applied, each bound `{time, dayOffset}` (`from`
   * holds the "from now" default when none was given), `null` where
   * unbounded. Absent from an older backend. */
  window?: {
    from: { time: string; dayOffset: number };
    to: { time: string; dayOffset: number } | null;
    arrivalFrom: { time: string; dayOffset: number } | null;
    arrivalTo: { time: string; dayOffset: number } | null;
  };
  /** Whether the search asked for the previous date's late trains too
   * (`across_midnight=true`). Absent from an older backend. */
  acrossMidnight?: boolean;
  /** Every service date the rows can be of, earliest first. Absent from an
   * older backend. */
  serviceDates?: string[];
}

/** One `GET /public/trains/arrivals` row: a search row whose `stationCrs`
 * is the board's station, plus the arrival there. `scheduled`/`dayOffset`
 * are the departure onward: `scheduled` is `null`, and `dayOffset` absent,
 * for a train that terminates here. */
export interface TrainArrivalResult extends TrainSearchResult {
  /** The arrival, `HH:MM`: the public time, else the working one. */
  arrival: string;
  /** Days after `serviceDate` the arrival falls on. */
  arrivalDayOffset: number;
  /** Whether the train ends at this station. */
  terminates: boolean;
}

/** `GET /public/trains/arrivals`: a station's arrivals, one page. */
export interface TrainArrivalsPage extends TimetableCertaintyFields {
  results: TrainArrivalResult[];
  nextCursor: string | null;
  serviceDate?: string;
}

/** `GET /public/trains/by-headcode`: the trains running under one
 * headcode on a date, each a search row at its origin. */
export interface TrainHeadcodePage extends TimetableCertaintyFields {
  results: TrainSearchResult[];
  serviceDate?: string;
}

/** One `GET /public/trains/search/operators` entry: an ATOC code the
 * search's `operator` takes, with its name, `null` for a code the
 * timetable carries that the operator reference list does not name. */
export interface TrainSearchOperator {
  code: string;
  name: string | null;
}

/** `GET /public/trains/search/dates` (`crates/api/src/routes/trains.rs`'s
 * `get_trains_search_dates`): the `date` range the search accepts
 * (`from`/`to`, inclusive) and the range the timetable holds rows for
 * (`publishedFrom`/`publishedTo`, `null` when it holds none). All
 * `"YYYY-MM-DD"`. `provisionalFrom` is the first provisional date (see
 * `TimetableCertaintyFields`); optional, absent from an older backend. */
export interface TrainSearchDates {
  from: string;
  to: string;
  publishedFrom: string | null;
  publishedTo: string | null;
  provisionalFrom?: string;
}

// --- Transit networks (`/public/transit/...`, crates/api/src/routes/transit.rs;
// docs/api-changelog.md 2026-10-14). Scheduled data only: no live fields.

/** A served transit network (`GET /public/transit/networks`). */
export interface TransitNetwork {
  id: string;
  name: string;
  mode: string;
  attribution: { licence: string; text: string };
  feedVersion: string;
  horizonFrom: string | null;
  horizonTo: string | null;
  timetableAsOf: string | null;
  situationsAsOf: string | null;
  /** The trip planner can route over this network's stations. */
  tripPlanning?: boolean;
}

/** A transit line: `id` is public (`metrolink:blue`), `lineId` the path
 * segment (`blue`). */
export interface TransitLine {
  id: string;
  lineId: string;
  name: string;
  colour: string | null;
  /** The line's own mode (`tube`, `dlr`, `tram`), else its network's. */
  mode?: string;
  /** The `line_status` id its status comes from, and what a pin of it
   * stores: `id`, or TfL's own line (`tfl-victoria`) for the TfL network. */
  statusLineId?: string;
}

/** Where a network's line status comes from: TfL's own line status
 * (`tfl`, no disruptions list) or the network's published disruptions. */
export type TransitStatusSource = 'tfl' | 'situations';

/** A National Rail catalogue line a transit network's operator also runs
 * (the TfL network's Overground lines and Elizabeth line). */
export interface TransitNationalRailLine {
  id: string;
  name: string;
}

/** One band of a direction's frequency summary. */
export interface TransitFrequencyBand {
  band: 'early' | 'morning-peak' | 'daytime' | 'evening-peak' | 'evening' | 'late';
  /** `HH:MM`, the band's start and end (`00:00` for midnight). */
  from: string;
  to: string;
  departures: number;
  minGapMinutes: number | null;
  maxGapMinutes: number | null;
}

/** A line's frequency summary for a date, each direction at its busiest
 * station. */
export interface TransitLineFrequency {
  date: string;
  outsideHorizon: boolean;
  directions: {
    direction: TransitDirection;
    station: TransitStationRef;
    first: string;
    last: string;
    bands: TransitFrequencyBand[];
  }[];
}

/** How fresh a network's disruptions are: `current` (under 30 minutes
 * old), `unavailable` (older; nothing listed) or `none` (the network has
 * no disruptions feed: show no status at all). */
export type TransitStatusState = 'current' | 'unavailable' | 'none';

/** One status of a tram line, worst first; the first is the headline. */
export interface TransitStatusEntry {
  /** A severity number, as `statusSeverity` (27 is "No Reported Disruption"). */
  severity: number;
  description: string;
  reason: string;
  situationId: string | null;
}

/** A tram line's status (`docs/api-changelog.md`, transit disruptions). */
export interface TransitLineStatus {
  state: TransitStatusState;
  asOf: string | null;
  statuses: TransitStatusEntry[];
  upcoming: { from: string; to: string | null; summary: string; situationId: string }[];
}

/** A published disruption. `description` is plain text: render it as text. */
export interface TransitSituation {
  id: string;
  summary: string;
  description: string | null;
  infoUrl: string | null;
  planned: boolean;
  reason: string | null;
  scope: 'line' | 'stop' | 'network';
  /** Public line ids. */
  lines: string[];
  /** Station ids. */
  stops: string[];
  advice: string[];
  validity: { start: string; end: string | null }[];
  /** An upcoming situation's next start. */
  starts: string | null;
}

/** `GET /public/transit/{network}/situations/{id}`: one disruption, for
 * its own page (docs/api-changelog.md, 2026-10-31). */
export interface TransitSituationDetail extends TransitSituation {
  /** `ended`: no longer published, or every validity period is over. */
  state: 'active' | 'upcoming' | 'ended';
  /** When the feed stopped listing it. */
  endedAt: string | null;
  /** For one still listed but ended: when its last validity period ended. */
  validityEndedAt: string | null;
  /** Its worst status on the lines it affects; 26 (Information) when it
   * changes none. */
  severity: number;
  severityDescription: string;
  /** The lines whose status it changes, worst first. */
  affects: { id: string; name: string; severity: number; description: string }[];
  firstSeenAt: string;
  updatedAt: string;
  status: { state: TransitStatusState; asOf: string | null };
}

/** `GET /public/transit/{network}/situations`, and a line's `situations`. */
export interface TransitSituations {
  state: TransitStatusState;
  asOf: string | null;
  current: TransitSituation[];
  upcoming: TransitSituation[];
}

/** `GET /public/transit/{network}`. */
export interface TransitNetworkDetail extends TransitNetwork {
  lines: (TransitLine & { status?: TransitLineStatus })[];
  status?: { state: TransitStatusState; asOf: string | null };
  statusSource?: TransitStatusSource;
  nationalRailLines?: TransitNationalRailLine[];
}

export interface TransitStationRef {
  id: string;
  name: string;
}

export type TransitDirection = 'outbound' | 'inbound';

/** `GET /public/transit/{network}/lines/{line}`. */
export interface TransitLineDetail extends TransitLine {
  directions: { direction: TransitDirection; headsign: string | null; stations: TransitStationRef[] }[];
  status?: TransitLineStatus;
  situations?: TransitSituations;
  statusSource?: TransitStatusSource;
  frequency?: TransitLineFrequency | null;
  /** The runs of stations the line's trips make, each way. */
  branches?: TransitLineBranch[];
}

/** A branch of a line (`Edgware to Morden via Bank`): a run of stations a
 * share of one direction's trips make. */
export interface TransitLineBranch {
  /** `outbound-1`: the timetable's `branch`. */
  id: string;
  direction: TransitDirection;
  name: string;
  stations: TransitStationRef[];
  sharePercent: number;
}

export interface TransitRailLink {
  crs: string;
  tiploc: string;
  kind: 'interchange' | 'nearby';
  note: string | null;
  /** The National Rail station's name, when known. */
  stationName?: string | null;
}

/** A tram stop linked to a National Rail station (`GET /public/transit/rail-links?crs=`). */
export interface TransitStationLink {
  network: string;
  networkName: string;
  stopId: string;
  stopName: string;
  kind: 'interchange' | 'nearby';
  note: string | null;
}

/** A station (`GET /public/transit/{network}/stops`). */
export interface TransitStop {
  id: string;
  name: string;
  lat: number | null;
  lon: number | null;
  /** Public line ids. */
  lines: string[];
  railLinks: TransitRailLink[];
}

/** `GET /public/transit/{network}/stops/{stop}`. */
export interface TransitStopDetail extends TransitStop {
  platforms: { id: string; indicator: string | null }[];
  /** Current disruptions naming this stop (a lift out of service). */
  notices?: TransitSituation[];
  /** The stop's first and last departures of the day, per line and way. */
  firstLast?: TransitStopFirstLast[];
}

/** A stop's first and last departures on one line, one way. */
export interface TransitStopFirstLast {
  line: TransitLine;
  direction: TransitDirection;
  towards: string | null;
  /** `HH:MM`. */
  first: string;
  last: string;
}

/** One scheduled departure. */
export interface TransitDeparture {
  /** RFC 3339, UK time. */
  scheduledDeparture: string;
  tripId: string;
  line: TransitLine | null;
  destination: string;
  platformId: string;
  platform: string | null;
  replacementBus: boolean;
}

/** `GET /public/transit/{network}/stops/{stop}/departures`. */
export interface TransitBoard {
  date: string;
  departures: TransitDeparture[];
  nextCursor: string | null;
  outsideHorizon: boolean;
  realtime: false;
  kind: 'scheduled';
}

/** `GET /public/transit/{network}/lines/{line}/timetable`. */
export interface TransitLineTimetable {
  date: string;
  direction: TransitDirection;
  /** The branch shown (`TransitLineBranch.id`), or null for the whole
   * direction. */
  branch?: string | null;
  stations: TransitStationRef[];
  trips: { tripId: string; headsign: string | null; times: (string | null)[] }[];
  outsideHorizon: boolean;
  realtime: false;
  kind: 'scheduled';
}

/** A delegated-access scope a connected app may hold
 * (`crates/api/src/auth/delegated.rs::Scope`). */
export type ConnectedAppScope = 'journeys:read' | 'journeys:write' | 'journeys:delete' | 'preferences:read';

/** One app the user connected (`GET /public/account/connected-apps`,
 * `crates/api/src/routes/connected_apps.rs::GrantView`). */
export interface ConnectedAppGrant {
  client: string;
  displayName: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt: string | null;
  /** `false` while Distant Signal has turned the app off. */
  clientEnabled: boolean;
}

/** An app the user could connect. */
export interface ConnectableApp {
  name: string;
  displayName: string;
  scopes: string[];
}

/** One journey a connected app deleted (kept 30 days). */
export interface ConnectedAppDeletion {
  id: number;
  client: string;
  journeyId: number;
  deletedAt: string;
  summary: {
    customName?: string | null;
    legs?: {
      serviceDate?: string | null;
      originCrs?: string | null;
      destinationCrs?: string | null;
      trainUid?: string | null;
      /** An untracked leg's fields (spec 2026-10-20 §2.4), absent from a
       * deletion recorded before them. */
      kind?: JourneyLegKind | null;
      transitMode?: TransitMode | null;
      originName?: string | null;
      destinationName?: string | null;
      lineName?: string | null;
      plannedDeparture?: string | null;
    }[];
  };
}

export interface ConnectedAppsData {
  grants: ConnectedAppGrant[];
  available: ConnectableApp[];
  recentDeletions: ConnectedAppDeletion[];
}

/** `GET /public/account/connected-apps/{client}/consent`. */
export interface ConnectAppConsent {
  client: ConnectableApp;
  username: string | null;
  name: string | null;
  confirmationToken: string;
  expiresAt: string;
  existingGrant: ConnectedAppGrant | null;
}

/** `GET /Trips/operators` (2026-10-31): what the planner's operator picker
 * offers. `operators` are the ATOC codes the published timetable runs
 * from today on (`name` `null` when nobody names the code); `groups` the
 * named groups (`group:GTR`); `dsOperators` the operators with no ATOC
 * code (`ds:DLR`). */
export interface PlannerOperatorCatalogue {
  operators: { code: string; name: string | null }[];
  groups: { code: string; name: string; members: string[] }[];
  dsOperators: { code: string; name: string }[];
}
