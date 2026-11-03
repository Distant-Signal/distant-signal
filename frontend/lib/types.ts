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
export type GroupRole = Api.GroupRole;
export type GroupSummary = Api.GroupSummary;
export type GroupIdentityResponse = Api.GroupIdentityResponse;
export type GroupDetail = Api.GroupDetailResponse;
export type GroupMember = Api.GroupMember;
export type GroupInviteLink = Api.InviteLink;
export type GroupJoinPreview = Api.JoinPreview;
export type GroupTrain = Api.GroupTrain;
export type SharedGroupTrain = Api.SharedTrain;
export type GroupJourney = Api.GroupJourney;
export type SharedGroupJourney = Api.SharedJourney;
export type GroupCustomLine = Api.GroupCustomLine;
export type SharedGroupCustomLine = Api.SharedCustomLine;
export type LineGroupRef = Api.LineGroupRef;
export type JourneyShareLink = Api.ShareLinkResponse;
export type TicketSource = Api.TicketSource;
export type TrackedTrainTicket = Api.TrackedTrainTicket;
export type TicketCreatedResponse = Api.TicketCreatedResponse;
export type AttachTicketResponse = Api.AttachTicketResponse;
export type PartialTicket = Api.PartialTicket;
export type JourneyLegProposal = Api.JourneyLegProposal;
export type DelayRepayEstimate = Api.DelayRepayEstimate;
export type TicketKind = Api.TicketKind;
export type DelayRepayOutcome = Api.Outcome;
export type DelayRepayEstimateResponse = Api.DelayRepayEstimateResponse;
export type DelayRepayFields = Api.DelayRepayFields;
export type TicketListItem = Api.TicketListItem;
export type JourneyTemplateListItem = Api.JourneyTemplateListItem;
export type JourneyTemplateDetail = Api.JourneyTemplateDetailResponse;
export type JourneyTemplateLegDetail = Api.JourneyTemplateLegDetailResponse;
export type CreateJourneyTemplateResponse = Api.CreateJourneyTemplateResponse;
export type MaterializeTemplateResponse = Api.MaterializeTemplateResponse;
export type SuggestionFit = Api.Fit;
export type SuggestionPick = Api.Pick;
export type ReplanSuggestionLeg = Api.ReplanSuggestionLeg;
export type ReplanSuggestion = Api.ReplanSuggestion;
export type SuggestionTrigger = Api.TriggerTrain;
export type SuggestionSet = Api.SuggestionSet;
export type BreakResponse = Api.BreakResponse;
export type SuggestionStaleResponse = Api.SuggestionStaleResponse;
export type ReplanResult = Api.ReplaceResponse;
export type RevisionLegFate = Api.RevisionLegFate;
export type RevisionLeg = Api.RevisionLeg;
export type Revision = Api.RevisionResponse;
export type RevisionsResponse = Api.RevisionsResponse;
export type ValidityPeriod = Api.ValidityPeriod;
export type AffectedRoute = Api.AffectedRoute;
export type Disruption = Api.Disruption;
export type IncidentLineRef = Api.IncidentLineRef;
export type IncidentHistoryEntry = Api.IncidentHistoryEntry;
export type IncidentDetail = Api.IncidentDetail;
export type IncidentSummary = Api.IncidentSummary;
export type IncidentTiming = Api.IncidentTiming;
export type RecentlyClearedIncident = Api.RecentlyClearedIncident;
export type IncidentSearchResponse = Api.IncidentSearchResponse;
export type SampleStats = Api.SampleStats;
export type SampleAvailability = Api.SampleAvailability;
export type FullCoverageAvailability = Api.FullCoverageAvailability;
export type LineStatus = Api.LineStatus;
export type UpcomingDisruption = Api.UpcomingDisruption;
export type LineStatusReport = Api.LineStatusReport;
export type LineDailyStats = Api.DailyStats;
export type LineHalfHourlyStats = Api.HalfHourlyStats;
export type LineHourlyStats = Api.SubDailyStats;
export type LineSixHourlyStats = Api.SubDailyStats;
export type LineDailyCoverageStats = Api.DailyCoverageStats;
export type LineHalfHourlyCoverageStats = Api.HalfHourlyCoverageStats;
export type OperatorSummary = Api.OperatorSummary;
export type StationOperatorSampleStats = Api.StationOperatorSampleStats;
export type StationAccessibilityData = Api.StationAccessibility;
export type NearbyStation = Api.NearbyStation;
export type BoardCallingPoint = Api.BoardCallingPoint;
export type TrainResolveResult = Api.TrainResolveResult;
export type LineSummary = Api.LineSummary;
export type CustomLineDetail = Api.CustomLineDetail;
export type LineDefinitionSummary = Api.LineDefinitionSummary;
export type LineTrainCallingPointKind = Api.CallingPointKind;
export type LineTrainCallingPoint = Api.LineTrainCallingPoint;
export type LineTrainLiveStatus = Api.LineTrainLiveStatus;
export type LineTrainEntry = Api.LineTrainEntry;
export type LineTrainScope = Api.LineTrainScope;
export type LineDirection = Api.LineDirection;
export type LineTime = Api.LineTime;
export type LineTrainStop = Api.LineTrainStop;
export type LineStationRef = Api.LineStationRef;
export type LineTrainSummaryLive = Api.LineTrainSummaryLive;
export type LineTrainSummary = Api.LineTrainSummary;
export type LineCatalogueStation = Api.LineCatalogueStation;
export type LineTrainsSummary = Api.LineTrainsSummary;
export type LineTimetableTrain = Api.LineTimetableTrain;
export type LineTimetablePage = Api.LineTimetablePage;
export type TrainSearchResult = Api.TrainSearchResult;
export type TrainSearchPage = Api.TrainSearchPage;
export type TrainArrivalResult = Api.TrainArrivalResult;
export type TrainArrivalsPage = Api.TrainArrivalsPage;
export type TrainHeadcodePage = Api.TrainHeadcodePage;
export type TrainSearchOperator = Api.TrainSearchOperator;
export type TrainSearchOperators = Api.TrainSearchOperators;
export type TrainSearchDates = Api.TrainSearchDates;

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

export type LineStatusHistoryEntry = LineStatusReport;

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

export interface Preferences {
  pinnedLines: string[];
  pinnedStations: string[];
  pinnedOperators: string[];
  /** Of `pinnedLines`, those whose status changes are not pushed
   * (`PUT /preferences/pinned-lines/{id}/alerts`). Absent from an older
   * backend. */
  silentPinnedLines?: string[];
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
 * operators — plus what the app's own merged searches add. */
export type Suggestion = Api.Suggestion & {
  /** A TfL stop's modes and lines (`Tube: Northern, Victoria`), shown after
   * its name in the dropdown (`searchTflStops`). */
  detail?: string;
  /** Only on `/stations`' merged search (`searchStationsAndStops`): a stop
   * that is not a National Rail station, and where picking it leads. Its
   * `code` is then a key (`tfl:940GZZLUUXB`), never a CRS. */
  place?: StationPlace;
};

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
  /** Whether personal API tokens are on, so the account menu can offer
   * "Revoke all API tokens". Optional: an older api leaves it out, which
   * reads as off. */
  personalTokensEnabled?: boolean;
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

/** `POST /JourneyTemplates/{id}/materialize`'s request body — always
 * explicit, never defaulted server-side; the "Run now" button's own date
 * field (`components/RunTemplateNowButton.tsx`) defaults to today
 * client-side and lets the caller change it first. */
export interface MaterializeTemplateRequest {
  serviceDate: string; // "YYYY-MM-DD"
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
