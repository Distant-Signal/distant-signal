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
export type LegTicket = Api.LegTicket;
export type LegTicketType = Api.LegTicketType;
export type LegTicketRequest = Api.LegTicketRequest;
export type LegTicketPrefill = Api.LegTicketPrefill;
export type LegDelayRepay = Api.LegDelayRepay;
export type DelayRepayEstimate = Api.DelayRepayEstimate;
export type TicketKind = Api.TicketKind;
export type DelayRepayOutcome = Api.Outcome;
export type DelayRepayFields = Api.DelayRepayFields;
export type ReliabilityResponse = Api.ReliabilityResponse;
export type ReliabilityTrain = Api.ReliabilityTrain;
export type ReliabilityJourney = Api.ReliabilityJourney;
export type JourneyTemplateListItem = Api.JourneyTemplateListItem;
export type JourneyTemplateDetail = Api.JourneyTemplateDetailResponse;
export type JourneyTemplateLegDetail = Api.JourneyTemplateLegDetailResponse;
export type CreateJourneyTemplateResponse = Api.CreateJourneyTemplateResponse;
export type MaterializeTemplateResponse = Api.MaterializeTemplateResponse;
export type TemplateTarget = Api.TemplateTarget;
export type PlanOptions = Api.PlanOptions;
export type UsualItinerary = Api.UsualItinerary;
export type UsualItineraryLeg = Api.UsualItineraryLeg;
export type DayOverride = Api.DayOverride;
export type DayOverrideRequest = Api.DayOverrideRequest;
export type DayOverrideSummary = Api.DayOverrideSummary;
export type SetTemplateActiveResponse = Api.SetTemplateActiveResponse;
export type SkipTemplateDateResponse = Api.SkipTemplateDateResponse;
export type UpcomingDate = Api.UpcomingDate;
export type PreviewDatesRequest = Api.PreviewDatesRequest;
export type PreviewDatesResponse = Api.PreviewDatesResponse;
export type TimeAwayPeriod = Api.TimeAwayPeriod;
export type TimeAwayRequest = Api.TimeAwayRequest;
export type TimeAwayResponse = Api.TimeAwayResponse;
export type SetTemplatePausedUntilRequest = Api.SetTemplatePausedUntilRequest;
export type AddTemplateExtraDateRequest = Api.AddTemplateExtraDateRequest;
export type RegularPlan = Api.RegularPlan;
export type RegularPlanOption = Api.RegularPlanOption;
export type JourneyRepeat = Api.JourneyRepeatResponse;
export type JourneyRepeatUnsupported = Api.JourneyRepeatUnsupported;
export type MoveJourneyRequest = Api.MoveJourneyRequest;
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
export type LegCandidate = Api.LegCandidate;
export type LegCandidatesResponse = Api.LegCandidatesResponse;

// Field groups the api flattens into many responses, as optional inputs:
// the helpers that read them also take rows of routes not generated yet.
type Loose<T> = { [K in keyof T]?: T[K] | null | undefined };
export type Preferences = Api.Preferences;
export type BankHolidayDivision = Api.BankHolidayDivision;
export type NextSkip = Api.NextSkip;
export type DataFreshness = Api.DataFreshness;
export type HistoryRetention = Api.HistoryRetention;
export type TflStopLine = Api.TflStopLine;
export type TflStop = Api.TflStopSummary;
export type TflStopRailStation = Api.TflStopRailStation;
export type TflStopDetail = Api.TflStopDetail;
export type TflArrival = Api.TflArrival;
export type TflArrivalGroup = Api.TflArrivalGroup;
export type TflStopArrivals = Api.TflStopArrivals;
export type SessionInfo = Api.SessionInfo;
export type TimeWindow = Api.TimeWindow;
export type QuietHours = Api.QuietHours;
export type NotificationPreferences = Api.NotificationPreferences;
export type NotificationPreferencesUpdate = Api.NotificationPreferencesUpdate;
export type PushDevice = Api.PushDevice;
export type NewJourneyLegRequest = Api.NewJourneyLegRequest;
export type UntrackedLegRequest = Extract<Api.NewJourneyLegRequest, { mode: 'untracked' }>;
export type AddJourneyLegResponse = Api.AddJourneyLegResponse;
export type CreateJourneyResponse = Api.CreateJourneyResponse;
export type ItineraryRequest = Api.ItineraryRequest;
export type TemplateLegRequest = Api.TemplateLegRequest;
export type CreateJourneyTemplateRequest = Api.CreateJourneyTemplateRequest;
export type PutJourneyTemplateRequest = Api.PutJourneyTemplateRequest;
export type MaterializeTemplateRequest = Api.MaterializeTemplateRequest;
export type SetTemplateActiveRequest = Api.SetTemplateActiveRequest;
export type SkipTemplateDateRequest = Api.SkipTemplateDateRequest;
export type LeaveBy = Api.LeaveBy;
export type StationBufferRequest = Api.StationBufferRequest;
export type StationBufferResponse = Api.StationBufferResponse;
export type StationBufferPrefill = Api.StationBufferPrefill;
export type RegularPlanAcceptRequest = Api.RegularPlanAcceptRequest;
export type TrackPinRequest = Api.TrackPinRequest;
export type TrackPinResponse = Api.TrackPinResponse;
export type TransitNetwork = Api.TransitNetwork;
export type TransitLine = Api.TransitLine;
export type TransitStatusSource = Api.TransitStatusSource;
export type TransitNationalRailLine = Api.TransitNationalRailLine;
export type TransitFrequencyBand = Api.TransitFrequencyBand;
export type TransitLineFrequency = Api.TransitLineFrequency;
export type TransitStatusState = Api.TransitStatusState;
export type TransitStatusEntry = Api.TransitStatusEntry;
export type TransitLineStatus = Api.TransitLineStatus;
export type TransitSituation = Api.TransitSituation;
export type TransitSituationDetail = Api.TransitSituationDetail;
export type TransitSituations = Api.TransitSituations;
export type TransitNetworkDetail = Api.TransitNetworkDetail;
export type TransitStationRef = Api.TransitStationRef;
export type TransitDirection = Api.TransitDirection;
export type TransitLineDetail = Api.TransitLineDetail;
export type TransitLineBranch = Api.TransitLineBranch;
export type TransitRailLink = Api.TransitRailLink;
export type TransitStationLink = Api.TransitStationLink;
export type TransitStop = Api.TransitStop;
export type TransitStopDetail = Api.TransitStopDetail;
export type TransitStopFirstLast = Api.TransitStopFirstLast;
export type TransitDeparture = Api.TransitDeparture;
export type TransitBoard = Api.TransitBoard;
export type TransitLineTimetable = Api.TransitLineTimetable;
export type ConnectedAppScope = Api.ConnectedAppScope;
export type ConnectedAppGrant = Api.ConnectedAppGrant;
export type ConnectableApp = Api.ConnectableApp;
export type ConnectedAppDeletion = Api.ConnectedAppDeletion;
export type ConnectedAppsData = Api.ConnectedAppsData;
export type ConnectAppConsent = Api.ConnectAppConsent;
export type PlannerOperatorCatalogue = Api.PlannerOperatorCatalogue;

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
 * stop (no page of its own yet), a served transit network's stop
 * (`/transit/{network}/stops/{stopId}`) or an Irish station. */
export type StationPlace =
  | { kind: 'tfl'; stop: TflStop }
  | { kind: 'transit'; network: string; stopId: string }
  /** An Iarnród Éireann or NI Railways station, and its page. */
  | { kind: 'ireland'; href: string };

/** The fields an untracked leg adds to a journey leg (DS-237's network
 * ride included), as optional inputs: the helpers that read them also take
 * list and group rows, which carry only some of them, `null` on a train
 * leg. Its place names are the leg's own `originName`/`destinationName`. */
export type UntrackedLegFields = Loose<
  Pick<
    Api.JourneyLegDetailResponse,
    | 'kind'
    | 'transitMode'
    | 'lineName'
    | 'plannedDeparture'
    | 'plannedArrival'
    | 'untrackedStatus'
    | 'originStopId'
    | 'destinationStopId'
    | 'transitNetwork'
    | 'transitLineId'
    | 'headsign'
  >
>;

/* Mid-journey changes (docs/superpowers/specs/2026-10-22-mid-journey-changes-design.md
 * §7, §8, §17.6): breaks, suggestions and the plan's revisions. */

/** What the planner was asked: `cause` of `GET .../alternatives` and of
 * `POST .../replace`. */
export type AlternativesCause = Api.AlternativesCause;
export type ReplaceRequest = Api.ReplaceRequest;
export type AcceptSuggestionRequest = Api.AcceptSuggestionRequest;

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
