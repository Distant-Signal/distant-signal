'use client';

import { useEffect, useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Button,
  Chip,
  Group,
  InputLabel,
  Radio,
  SegmentedControl,
  Select,
  Stack,
  Switch,
  Text,
  Title,
} from '@mantine/core';
import { TimeInput } from '@mantine/dates';
import { DateInput, DatePickerInput } from '@/components/LazyDateFields';
import { BankHolidaySwitch, useBankHolidayDivision } from './BankHolidaySwitch';
import { ItineraryOption } from './ItineraryOption';
import { LoginPromptModal } from './LoginPromptModal';
import { StationBufferField } from './StationBufferField';
import { StationField } from './StationField';
import { CLOCK_HINT } from './TimeFilterInput';
import { useNeedsLogin } from './useNeedsLogin';
import { ButtonSpinner } from '@/components/LoadingText';
import { DEFAULT_BANK_HOLIDAY_DIVISION, saveBankHolidayDivision } from '@/lib/bankHolidays';
import { formatDate, PICKER_DATE_FORMAT } from '@/lib/dateFormat';
import { describeFailure, failureFromResponse } from '@/lib/failure';
import { addCalendarDays, londonToday } from '@/lib/londonWallClock';
import {
  earlierTrainsBound,
  isUsualOption,
  laterTrainsBound,
  queryOptionsFromPlan,
  REGULAR_JOURNEYS_HREF,
  takeRegularJourneyDraft,
  trainChoicesQuery,
  usualItineraryFromPlan,
  usualTrainSummary,
  type TrainSearchBound,
} from '@/lib/regularJourneys';
import { getStationNames } from '@/lib/suggestions';
import { collectTripPlanStationCodes, fetchTripPlan, TripPlanError, tripPlanStopNames } from '@/lib/tripPlan';
import {
  isoWeekdayOf,
  isoWeekdayOfKey,
  nextDateOnWeekday,
  TEMPLATE_DAYS,
  weekdayPlural,
} from '@/lib/templateRecurrence';
import { previewSentence } from '@/lib/upcomingDates';
import type {
  BankHolidayDivision,
  CreateJourneyTemplateRequest,
  DayOverrideRequest,
  PlanOptions,
  PreviewDatesRequest,
  PreviewDatesResponse,
  StationBufferPrefill,
  TemplateTarget,
  TripPlanItinerary,
  TripPlanResponse,
  UsualItinerary,
} from '@/lib/types';

type TargetKind = TemplateTarget['kind'];

/** Every day: where the next date of a saved route (no days) is found. */
const ALL_DAYS_MASK = 127;

/** Mon to Fri, the form's starting days (§4.4). */
const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri'];

function daysMask(keys: string[]): number {
  return TEMPLATE_DAYS.filter((day) => keys.includes(day.key)).reduce((mask, day) => mask | day.bit, 0);
}

/** The usual train picked for one direction: the itinerary to save and
 * how the form names it. */
interface UsualPick {
  itinerary: UsualItinerary;
  summary: string | null;
}

/** "Leave after" or "Arrive by" with a time: one direction's target. */
function TargetFields({
  kind,
  time,
  onKind,
  onTime,
  clockHint = false,
  legend,
}: {
  kind: TargetKind;
  time: string;
  onKind: (kind: TargetKind) => void;
  onTime: (time: string) => void;
  clockHint?: boolean;
  legend: string;
}) {
  const labelId = useId();
  return (
    <Group gap="sm" align="flex-end" wrap="wrap">
      <Stack gap={4}>
        <InputLabel id={labelId} component="span">
          {legend}
        </InputLabel>
        <SegmentedControl
          aria-labelledby={labelId}
          value={kind}
          onChange={onKind}
          data={[
            { label: 'Leave after', value: 'depart_after' },
            { label: 'Arrive by', value: 'arrive_by' },
          ]}
        />
      </Stack>
      <TimeInput
        label="Time"
        description={clockHint ? CLOCK_HINT : undefined}
        value={time}
        onChange={(event) => onTime(event.currentTarget.value)}
        required
        withAsterisk={false}
      />
    </Group>
  );
}

/** The trains `/Trips/plan` found for one direction, in departure
 * order, to pick the usual one from (`ItineraryOption`, as on Plan a
 * journey), with Earlier trains and Later trains to page. The usual
 * train is marked by its trains and times (`isUsualOption`), so it stays
 * selected after another search. */
function TrainChoices({
  plan,
  date,
  stationNames,
  usual,
  onSelect,
  onPage,
  paging,
  note,
}: {
  plan: TripPlanResponse;
  date: string;
  stationNames: Map<string, string>;
  usual: UsualItinerary | undefined;
  onSelect: (itinerary: TripPlanItinerary) => void;
  /** Searches again from this bound; absent when the plan can't page. */
  onPage?: ((bound: TrainSearchBound, direction: 'earlier' | 'later') => void) | undefined;
  paging: boolean;
  /** Why the last Earlier or Later search changed nothing. */
  note: string | null;
}) {
  const segment = plan.segments.length === 1 ? plan.segments[0] : undefined;
  if (!segment) {
    return (
      <Text size="sm" c="dimmed">
        This route has stops to call at. Pick its usual train from Plan a journey instead.
      </Text>
    );
  }
  if (segment.itineraries.length === 0) {
    return <Alert color="yellow">No trains found for {formatDate(`${date}T12:00:00Z`)}. Try another time.</Alert>;
  }
  const earlier = onPage ? earlierTrainsBound(plan.journeys) : null;
  const later = onPage ? laterTrainsBound(plan.journeys) : null;
  return (
    <Stack gap="xs">
      <Text size="sm" c="dimmed">
        Trains on {formatDate(`${date}T12:00:00Z`)}. Pick the one you usually take.
      </Text>
      {earlier && (
        <Button
          variant="default"
          size="xs"
          className="ds-self-start"
          disabled={paging}
          onClick={() => onPage?.(earlier, 'earlier')}
        >
          Earlier trains
        </Button>
      )}
      {segment.itineraries.map((itinerary, index) => (
        <ItineraryOption
          key={index}
          itinerary={itinerary}
          selected={isUsualOption(itinerary, usual)}
          onSelect={() => onSelect(itinerary)}
          stationNames={stationNames}
          stopAccess={plan.access}
        />
      ))}
      {later && (
        <Button
          variant="default"
          size="xs"
          className="ds-self-start"
          disabled={paging}
          onClick={() => onPage?.(later, 'later')}
        >
          Later trains
        </Button>
      )}
      {note && (
        <Text size="sm" c="dimmed" role="status">
          {note}
        </Text>
      )}
    </Stack>
  );
}

/** One direction's "Find trains" and its results. */
function UsualTrainPicker({
  label,
  query,
  usual,
  onPick,
  disabledReason,
}: {
  label: string;
  /** What to search: `null` while the form can't say yet. */
  query: {
    originCrs: string;
    destinationCrs: string;
    date: string;
    kind: TargetKind;
    time: string;
    options: PlanOptions | null;
  } | null;
  usual: UsualPick | null;
  onPick: (pick: UsualPick) => void;
  disabledReason: string | null;
}) {
  const [plan, setPlan] = useState<TripPlanResponse | null>(null);
  const [planDate, setPlanDate] = useState<string | null>(null);
  const [stationNames, setStationNames] = useState<Map<string, string>>(new Map());
  const [searching, setSearching] = useState(false);
  const [paging, setPaging] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function fetchTrains(date: string, bound: TrainSearchBound): Promise<TripPlanResponse> {
    if (!query) throw new Error('no query');
    const result = await fetchTripPlan(
      trainChoicesQuery(
        { originCrs: query.originCrs, destinationCrs: query.destinationCrs, date },
        bound,
        queryOptionsFromPlan(query.options),
      ),
    );
    const names = await getStationNames(collectTripPlanStationCodes(result)).catch(() => new Map<string, string>());
    setStationNames((known) => new Map([...known, ...names, ...tripPlanStopNames(result)]));
    return result;
  }

  async function search() {
    if (!query) return;
    setSearching(true);
    setError(null);
    setNote(null);
    setPlan(null);
    try {
      const result = await fetchTrains(query.date, { kind: query.kind, time: query.time, dayOffset: 0 });
      setPlan(result);
      setPlanDate(query.date);
    } catch (caught) {
      setError(caught instanceof TripPlanError ? caught.message : describeFailure('find', 'trains'));
    } finally {
      setSearching(false);
    }
  }

  /** Earlier trains or Later trains: the next few, in place of these. */
  async function page(bound: TrainSearchBound, direction: 'earlier' | 'later') {
    if (!query || !planDate) return;
    setPaging(true);
    setError(null);
    setNote(null);
    try {
      const result = await fetchTrains(planDate, bound);
      if ((result.segments[0]?.itineraries.length ?? 0) === 0) {
        setNote(direction === 'earlier' ? 'No earlier trains that day.' : 'No later trains that day.');
      } else {
        setPlan(result);
      }
    } catch (caught) {
      setError(caught instanceof TripPlanError ? caught.message : describeFailure('find', 'trains'));
    } finally {
      setPaging(false);
    }
  }

  return (
    <Stack gap="xs">
      {usual?.summary && (
        <Text size="sm">
          {label}: {usual.summary}
        </Text>
      )}
      <Group gap="xs">
        <Button
          variant={usual ? 'default' : 'filled'}
          onClick={() => void search()}
          disabled={!query || searching}
          leftSection={searching ? <ButtonSpinner /> : undefined}
        >
          {searching ? 'Finding trains' : usual ? 'Find other trains' : 'Find trains'}
        </Button>
      </Group>
      {disabledReason && !query && (
        <Text size="sm" c="dimmed">
          {disabledReason}
        </Text>
      )}
      {error && <Alert color="red">{error}</Alert>}
      {plan && planDate && (
        <TrainChoices
          plan={plan}
          date={planDate}
          stationNames={stationNames}
          usual={usual?.itinerary}
          onSelect={(option) => {
            const itinerary = usualItineraryFromPlan([option], (code) => stationNames.get(code));
            onPick({ itinerary, summary: usualTrainSummary(itinerary, (code) => stationNames.get(code)) });
          }}
          onPage={plan.count !== undefined ? (bound, direction) => void page(bound, direction) : undefined}
          paging={paging}
          note={note}
        />
      )}
    </Stack>
  );
}

/** One weekday's different time (R3), as the form holds it until saved. */
interface DayOverrideDraft {
  /** A stable key for the list. */
  key: number;
  /** ISO weekday, 1 Monday to 7 Sunday; `null` until chosen. */
  weekday: number | null;
  kind: TargetKind;
  time: string;
  usual: UsualPick | null;
}

/** What one direction's "Find trains" searches, given a time. */
interface DirectionQuery {
  originCrs: string;
  destinationCrs: string;
  kind: TargetKind;
  time: string;
  options: PlanOptions | null;
}

/** "Different time on some days" for one direction (R3): a switch, then a
 * row per weekday with its own "Leave after" or "Arrive by", time and usual
 * train, found on that weekday's next date (`dateFor`). `days` are the ISO
 * weekdays the journey runs on; a row's day is one of them, each once. */
function DayOverridesField({
  drafts,
  onChange,
  days,
  dateFor,
  queryFor,
  baseKind,
  trainLabel,
  waitReason,
}: {
  drafts: DayOverrideDraft[];
  onChange: (drafts: DayOverrideDraft[]) => void;
  days: number[];
  dateFor: (weekday: number) => string | null;
  /** The search for a row's kind and time; `null` while the form can't say. */
  queryFor: (kind: TargetKind, time: string) => DirectionQuery | null;
  baseKind: TargetKind;
  /** "Your usual train" or "Your usual train back". */
  trainLabel: string;
  /** Why no row can search yet (no stations, no usual train there). */
  waitReason: string;
}) {
  const [nextKey, setNextKey] = useState(1);
  const unused = (except: DayOverrideDraft | null) =>
    days.filter((day) => !drafts.some((draft) => draft !== except && draft.weekday === day));

  function add() {
    const weekday = unused(null).at(-1) ?? null;
    onChange([...drafts, { key: nextKey, weekday, kind: baseKind, time: '', usual: null }]);
    setNextKey(nextKey + 1);
  }

  function update(draft: DayOverrideDraft, change: Partial<DayOverrideDraft>) {
    onChange(drafts.map((item) => (item === draft ? { ...item, ...change } : item)));
  }

  return (
    <Stack gap="sm">
      <Switch
        label="Different time on some days"
        description="For example, an earlier train on Fridays."
        checked={drafts.length > 0}
        disabled={days.length === 0}
        onChange={(event) => {
          if (event.currentTarget.checked) add();
          else onChange([]);
        }}
      />
      {drafts.map((draft) => {
        const weekday = draft.weekday !== null && days.includes(draft.weekday) ? draft.weekday : null;
        const name = weekday === null ? null : weekdayPlural(weekday);
        const date = weekday === null ? null : dateFor(weekday);
        const base = draft.time === '' ? null : queryFor(draft.kind, draft.time);
        const query = base && date ? { ...base, date } : null;
        const reason =
          weekday === null
            ? 'Choose a day first.'
            : draft.time === ''
              ? 'Choose a time first.'
              : !base
                ? waitReason
                : date === null
                  ? `None of the ${name} is before the end date.`
                  : null;
        return (
          <Stack key={draft.key} gap="xs" data-day-override>
            <Group gap="sm" align="flex-end" wrap="wrap">
              <Select
                label="Day"
                placeholder="Choose a day"
                data={unused(draft).map((day) => ({ value: String(day), label: weekdayPlural(day) }))}
                value={weekday === null ? null : String(weekday)}
                onChange={(value) => update(draft, { weekday: value ? Number(value) : null, usual: null })}
                allowDeselect={false}
                maw={200}
              />
              <Button
                variant="subtle"
                onClick={() => onChange(drafts.filter((item) => item !== draft))}
                aria-label={name ? `Remove the different time on ${name}` : 'Remove this day'}
              >
                Remove
              </Button>
            </Group>
            <TargetFields
              legend={name ? `On ${name}` : 'On that day'}
              kind={draft.kind}
              time={draft.time}
              onKind={(kind) => update(draft, { kind, usual: null })}
              onTime={(time) => update(draft, { time, usual: null })}
            />
            <UsualTrainPicker
              label={name ? `${trainLabel} on ${name}` : trainLabel}
              query={query}
              usual={draft.usual}
              onPick={(usual) => update(draft, { usual })}
              disabledReason={reason}
            />
          </Stack>
        );
      })}
      {drafts.length > 0 && unused(null).length > 0 && (
        <Button variant="default" onClick={add} className="ds-self-start">
          Add another day
        </Button>
      )}
    </Stack>
  );
}

/** Whether every row has a day the journey runs on, a time and a usual
 * train, each day once. */
function draftsComplete(drafts: DayOverrideDraft[], days: number[]): boolean {
  const seen = new Set<number>();
  return drafts.every((draft) => {
    if (draft.weekday === null || !days.includes(draft.weekday) || seen.has(draft.weekday)) return false;
    seen.add(draft.weekday);
    return draft.time !== '' && draft.usual !== null;
  });
}

/** The rows as `dayOverrides` sends them. */
function overridesBody(drafts: DayOverrideDraft[]): DayOverrideRequest[] {
  return drafts.flatMap((draft) =>
    draft.weekday !== null && draft.usual
      ? [
          {
            weekday: draft.weekday,
            target: { kind: draft.kind, time: draft.time, dayOffset: 0 },
            usualItinerary: draft.usual.itinerary,
          },
        ]
      : [],
  );
}

/** The regular journey form (regular journeys design §4.4): From, To,
 * "Leave after" or "Arrive by" with a time, the days (Monday to Friday to
 * start), optional start and end dates, "Add the return journey" with its
 * own time, and "Each day": remind me to pick my train (the default) or
 * pick my usual train for me. "Find trains" plans the next date the api
 * previews for the chosen days (`POST /JourneyTemplates/preview-dates`)
 * and the picked option becomes the usual train, then the return's.
 * "Save regular journey" sends `POST /JourneyTemplates` `mode: "plan"`.
 *
 * Opened from Plan a journey ("Make this a regular journey"), it starts
 * from that search's route, time and options and the itinerary picked
 * there (`takeRegularJourneyDraft`). */
/** The minutes to get to the station a field starts from (decision 6):
 * the ones the traveller last used from `crs`
 * (`GET /JourneyTemplates/station-buffer`), until they type their own.
 * Logged out, or with none used, it stays empty. */
function useStationBuffer(crs: string): [number | null, (minutes: number | null) => void] {
  const [minutes, setMinutes] = useState<number | null>(null);
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (touched || !/^[A-Z]{3}$/.test(crs)) return undefined;
    let cancelled = false;
    const isCancelled = () => cancelled;
    void (async () => {
      try {
        const response = await fetch(`/api/JourneyTemplates/station-buffer?crs=${crs}`);
        if (!response.ok || isCancelled()) return;
        const body = (await response.json()) as StationBufferPrefill;
        if (!isCancelled() && body.minutes !== null) setMinutes(body.minutes);
      } catch {
        // A pre-fill only: the field stays as it is.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [crs, touched]);
  return [
    minutes,
    (next) => {
      setTouched(true);
      setMinutes(next);
    },
  ];
}

/** How a regular journey repeats (R2), as the form offers it: every week,
 * every 2 to 4 weeks, or on dates chosen one by one. */
type Repeat = '1' | '2' | '3' | '4' | 'dates';

const REPEAT_OPTIONS: { value: Repeat; label: string }[] = [
  { value: '1', label: 'Every week' },
  { value: '2', label: 'Every other week' },
  { value: '3', label: 'Every 3 weeks' },
  { value: '4', label: 'Every 4 weeks' },
  { value: 'dates', label: 'On dates I choose' },
];

/** The pattern fields `POST /JourneyTemplates` and the preview take; empty
 * for every week, so a form without the option sends nothing new. */
type PatternFields = Pick<PreviewDatesRequest, 'recurrenceKind' | 'intervalWeeks' | 'anchorWeek' | 'extraDates'>;

/** London's Monday of this week, or of next week. */
function mondayOf(week: 'this' | 'next'): string {
  const today = londonToday();
  // Midday UTC is the same calendar day in London all year.
  const sinceMonday = (new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7;
  return addCalendarDays(today, (week === 'next' ? 7 : 0) - sinceMonday);
}

function patternFields(repeat: Repeat, startWeek: 'this' | 'next', dates: string[]): PatternFields {
  if (repeat === 'dates') return { recurrenceKind: 'dates', extraDates: [...dates].sort() };
  if (repeat === '1') return {};
  return { intervalWeeks: Number(repeat), anchorWeek: mondayOf(startWeek) };
}

/** How many dates the form previews. */
const PREVIEW_COUNT = 4;

/** What `POST /JourneyTemplates/preview-dates` said about the form's days. */
type DatesPreview =
  | { status: 'loading' }
  | { status: 'ready'; result: PreviewDatesResponse }
  | { status: 'login' }
  | { status: 'error'; message: string };

/** The next dates the chosen days and start and end run on, from the api
 * (the rule the evening mint uses, with the caller's bank holidays when
 * the switch is on), so "Find trains" plans the first of them and the
 * form shows the next few. Asked again a moment after the days, dates or
 * switch stop changing. */
function useDatesPreview(
  mask: number,
  startsOn: string | null,
  endsOn: string | null,
  skipBankHolidays: boolean,
  pattern: PatternFields,
): DatesPreview | null {
  const [preview, setPreview] = useState<DatesPreview | null>(null);
  // The pattern by value, so a new object with the same fields asks nothing.
  const patternKey = JSON.stringify(pattern);
  useEffect(() => {
    const listed = pattern.recurrenceKind === 'dates';
    if (
      (mask === 0 && !listed) ||
      (listed && (pattern.extraDates ?? []).length === 0) ||
      (startsOn && endsOn && startsOn > endsOn)
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- nothing to ask: clear the last answer
      setPreview(null);
      return undefined;
    }
    let cancelled = false;
    const isCancelled = () => cancelled;
    setPreview({ status: 'loading' });
    const timer = setTimeout(() => {
      void (async () => {
        const body: PreviewDatesRequest = {
          daysOfWeek: listed ? null : mask,
          startsOn,
          endsOn,
          skipBankHolidays,
          count: PREVIEW_COUNT,
          ...pattern,
        };
        try {
          const response = await fetch('/api/JourneyTemplates/preview-dates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
          if (isCancelled()) return;
          if (response.status === 401) {
            setPreview({ status: 'login' });
          } else if (!response.ok) {
            setPreview({ status: 'error', message: await failureFromResponse('check', 'the dates', response) });
          } else {
            const result = (await response.json()) as PreviewDatesResponse;
            if (!isCancelled()) setPreview({ status: 'ready', result });
          }
        } catch {
          if (!isCancelled()) setPreview({ status: 'error', message: describeFailure('check', 'the dates') });
        }
      })();
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `patternKey` stands for `pattern`
  }, [mask, startsOn, endsOn, skipBankHolidays, patternKey]);
  return preview;
}

/** The form's line under the dates: the next few, or why there are none. */
function DatesPreviewLine({ preview }: { preview: DatesPreview | null }) {
  if (!preview || preview.status === 'loading') return null;
  if (preview.status === 'login') {
    return (
      <Text size="sm" c="dimmed">
        Log in to see the dates this runs on.
      </Text>
    );
  }
  if (preview.status === 'error') {
    return (
      <Text size="sm" c="red">
        {preview.message}
      </Text>
    );
  }
  if (preview.result.upcomingDates.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        None of the chosen days is before the end date.
      </Text>
    );
  }
  return (
    <Text size="sm" data-dates-preview>
      Next dates: {previewSentence(preview.result.upcomingDates)}.
    </Text>
  );
}

export function RegularJourneyForm({
  recurrenceEnabled = false,
  dayOverridesEnabled = false,
}: {
  /** Offer every few weeks and chosen dates (`regularJourneyRecurrenceEnabled`). */
  recurrenceEnabled?: boolean;
  /** Offer a different time on some days (`regularJourneyDayOverridesEnabled`). */
  dayOverridesEnabled?: boolean;
} = {}) {
  const router = useRouter();
  const [originCrs, setOriginCrs] = useState('');
  const [destinationCrs, setDestinationCrs] = useState('');
  const [kind, setKind] = useState<TargetKind>('depart_after');
  const [time, setTime] = useState('');
  const [days, setDays] = useState<string[]>(WEEKDAY_KEYS);
  const [repeat, setRepeat] = useState<Repeat>('1');
  const [startWeek, setStartWeek] = useState<'this' | 'next'>('this');
  const [chosenDates, setChosenDates] = useState<string[]>([]);
  const [startsOn, setStartsOn] = useState<string | null>(null);
  const [endsOn, setEndsOn] = useState<string | null>(null);
  const [withReturn, setWithReturn] = useState(false);
  const [returnKind, setReturnKind] = useState<TargetKind>('depart_after');
  const [returnTime, setReturnTime] = useState('');
  const [matchMode, setMatchMode] = useState<'manual' | 'auto'>('manual');
  const [skipBankHolidays, setSkipBankHolidays] = useState(true);
  const division = useBankHolidayDivision();
  const [divisionChoice, setDivisionChoice] = useState<BankHolidayDivision>(DEFAULT_BANK_HOLIDAY_DIVISION);
  // Asked once, inline: only while no division is saved (§8.3).
  const askDivision = division === null;
  const [planOptions, setPlanOptions] = useState<PlanOptions | null>(null);
  const [usual, setUsual] = useState<UsualPick | null>(null);
  const [returnUsual, setReturnUsual] = useState<UsualPick | null>(null);
  const [overrides, setOverrides] = useState<DayOverrideDraft[]>([]);
  const [returnOverrides, setReturnOverrides] = useState<DayOverrideDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const needsLoginState = useNeedsLogin();
  const daysLabelId = useId();

  // A draft from Plan a journey, read once on the client.
  useEffect(() => {
    const draft = takeRegularJourneyDraft();
    if (!draft) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads session storage only after mount, so the server and first client render agree
    setOriginCrs(draft.originCrs);
    setDestinationCrs(draft.destinationCrs);
    setKind(draft.target.kind);
    setTime(draft.target.time.slice(0, 5));
    setPlanOptions(draft.planOptions);
    setUsual({ itinerary: draft.usualItinerary, summary: draft.usualSummary });
  }, []);

  const [buffer, setBuffer] = useStationBuffer(originCrs.trim().toUpperCase());
  const [returnBuffer, setReturnBuffer] = useStationBuffer(withReturn ? destinationCrs.trim().toUpperCase() : '');
  const mask = daysMask(days);
  const listed = recurrenceEnabled && repeat === 'dates';
  const pattern = recurrenceEnabled ? patternFields(repeat, startWeek, chosenDates) : {};
  // No days is a saved route: its trains are picked from the next day
  // of any day of the week, with no bank holiday passed over.
  const savedRoute = mask === 0 && !listed;
  const preview = useDatesPreview(
    savedRoute ? ALL_DAYS_MASK : mask,
    startsOn,
    endsOn,
    savedRoute ? false : skipBankHolidays,
    savedRoute ? {} : pattern,
  );
  const date = preview?.status === 'ready' ? preview.result.nextDate : null;
  const origin = originCrs.trim().toUpperCase();
  const destination = destinationCrs.trim().toUpperCase();
  const stationsSet = /^[A-Z]{3}$/.test(origin) && /^[A-Z]{3}$/.test(destination) && origin !== destination;
  const searchReason = !stationsSet
    ? 'Choose two different stations first.'
    : time === ''
      ? 'Choose a time first.'
      : preview?.status === 'login'
        ? 'Log in to find trains for your days.'
        : preview === null
          ? 'Choose a start and end date in order first.'
          : preview.status === 'loading'
            ? 'Working out the next date.'
            : date === null
              ? 'None of the chosen days is before the end date.'
              : null;
  const outboundQuery =
    stationsSet && time !== '' && date !== null
      ? { originCrs: origin, destinationCrs: destination, date, kind, time, options: planOptions }
      : null;
  const returnQuery =
    stationsSet && returnTime !== '' && date !== null
      ? { originCrs: destination, destinationCrs: origin, date, kind: returnKind, time: returnTime, options: null }
      : null;

  // A different time on some days (R3): the weekdays it can be on are the
  // days the journey runs, or for chosen dates the dates' weekdays. Each
  // weekday's trains are found on its next date from the start date.
  const firstDay = startsOn && startsOn > londonToday() ? startsOn : londonToday();
  const overrideDays = !dayOverridesEnabled
    ? []
    : listed
      ? [...new Set(chosenDates.filter((day) => day >= londonToday()).map(isoWeekdayOf))].sort((a, b) => a - b)
      : savedRoute
        ? []
        : days.map(isoWeekdayOfKey).sort((a, b) => a - b);
  function overrideDate(weekday: number): string | null {
    const next = listed
      ? ([...chosenDates].sort().find((day) => day >= firstDay && isoWeekdayOf(day) === weekday) ?? null)
      : nextDateOnWeekday(firstDay, weekday);
    return next && endsOn && next > endsOn ? null : next;
  }

  // A changed route or time makes the picked train someone else's.
  function changeOutbound(apply: () => void) {
    apply();
    setUsual(null);
    setReturnUsual(null);
    setOverrides((drafts) => drafts.map((draft) => ({ ...draft, usual: null })));
    setReturnOverrides((drafts) => drafts.map((draft) => ({ ...draft, usual: null })));
  }

  const sentOverrides = overrideDays.length > 0 ? overrides : [];
  const sentReturnOverrides = withReturn && overrideDays.length > 0 ? returnOverrides : [];
  const canSave =
    !(listed && chosenDates.length === 0) &&
    outboundQuery !== null &&
    usual !== null &&
    (!withReturn || (returnQuery !== null && returnUsual !== null)) &&
    draftsComplete(sentOverrides, overrideDays) &&
    draftsComplete(sentReturnOverrides, overrideDays);

  async function handleSave() {
    if (!outboundQuery || !usual || !canSave) return;
    setSaving(true);
    setError(null);
    needsLoginState.reset();
    if (askDivision && skipBankHolidays) {
      // The inline answer is the traveller's choice for every regular
      // journey, so it is saved first, to Preferences.
      try {
        const response = await saveBankHolidayDivision(divisionChoice);
        if (response.status === 401) {
          needsLoginState.markNeedsLogin();
          setSaving(false);
          return;
        }
        if (!response.ok) {
          setError(await failureFromResponse('save', 'your bank holidays', response));
          setSaving(false);
          return;
        }
      } catch {
        setError(describeFailure('save', 'your bank holidays'));
        setSaving(false);
        return;
      }
    }
    const body: CreateJourneyTemplateRequest = {
      mode: 'plan',
      originCrs: origin,
      destinationCrs: destination,
      target: { kind, time, dayOffset: 0 },
      planOptions,
      usualItinerary: usual.itinerary,
      daysOfWeek: mask === 0 || listed ? null : mask,
      ...pattern,
      startsOn,
      endsOn,
      defaultMatchMode: matchMode,
      stationBufferMinutes: buffer,
      skipBankHolidays,
      ...(sentOverrides.length > 0 ? { dayOverrides: overridesBody(sentOverrides) } : {}),
      return:
        withReturn && returnUsual
          ? {
              target: { kind: returnKind, time: returnTime, dayOffset: 0 },
              usualItinerary: returnUsual.itinerary,
              stationBufferMinutes: returnBuffer,
              ...(sentReturnOverrides.length > 0 ? { dayOverrides: overridesBody(sentReturnOverrides) } : {}),
            }
          : null,
    };
    try {
      const response = await fetch('/api/JourneyTemplates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (response.status === 401) {
        needsLoginState.markNeedsLogin();
        setSaving(false);
        return;
      }
      if (!response.ok) {
        setError(await failureFromResponse('save', 'this regular journey', response));
        setSaving(false);
        return;
      }
      router.push(REGULAR_JOURNEYS_HREF);
    } catch {
      setError(describeFailure('save', 'this regular journey'));
      setSaving(false);
    }
  }

  return (
    <Stack gap="md">
      <StationField label="From" value={originCrs} onChange={(value) => changeOutbound(() => setOriginCrs(value))} />
      <StationField
        label="To"
        value={destinationCrs}
        onChange={(value) => changeOutbound(() => setDestinationCrs(value))}
      />
      <TargetFields
        legend="Going"
        kind={kind}
        time={time}
        onKind={(value) => changeOutbound(() => setKind(value))}
        onTime={(value) => changeOutbound(() => setTime(value))}
        clockHint
      />
      <StationBufferField value={buffer} onChange={setBuffer} />
      {recurrenceEnabled && (
        <Select
          label="Repeats"
          data={REPEAT_OPTIONS}
          value={repeat}
          onChange={(value) => {
            const next = REPEAT_OPTIONS.find((option) => option.value === value);
            if (next) setRepeat(next.value);
          }}
          allowDeselect={false}
          maw={320}
        />
      )}
      {listed ? (
        <Stack gap={4}>
          <DatePickerInput
            type="multiple"
            label="Dates"
            valueFormat={PICKER_DATE_FORMAT}
            value={chosenDates}
            onChange={(value) => setChosenDates(value.filter((day): day is string => typeof day === 'string'))}
            minDate={londonToday()}
            maxDate={addCalendarDays(londonToday(), 400)}
            clearable
          />
          {chosenDates.length === 0 && (
            <Text size="sm" c="red">
              Choose at least one date.
            </Text>
          )}
        </Stack>
      ) : (
        <Stack gap={4}>
          <Text size="sm" fw={500} id={`${daysLabelId}-days`}>
            Days
          </Text>
          <Chip.Group multiple value={days} onChange={setDays}>
            <Group gap="xs" role="group" aria-labelledby={`${daysLabelId}-days`}>
              {TEMPLATE_DAYS.map((day) => (
                <Chip key={day.key} value={day.key}>
                  {day.label}
                </Chip>
              ))}
            </Group>
          </Chip.Group>
          {mask === 0 && (
            <Text size="sm" c="dimmed">
              No days: a saved route. Start a journey from it whenever you travel.
            </Text>
          )}
        </Stack>
      )}
      {recurrenceEnabled && repeat !== '1' && repeat !== 'dates' && (
        <Radio.Group
          label="Starting"
          value={startWeek}
          onChange={(value) => setStartWeek(value === 'next' ? 'next' : 'this')}
        >
          <Group gap="md" mt={4}>
            <Radio value="this" label="Starting this week" />
            <Radio value="next" label="Starting next week" />
          </Group>
        </Radio.Group>
      )}
      <Group gap="sm" grow align="flex-start">
        <DateInput
          label="Starts (optional)"
          valueFormat={PICKER_DATE_FORMAT}
          value={startsOn}
          onChange={setStartsOn}
          minDate={londonToday()}
          clearable
        />
        <DateInput
          label="Ends (optional)"
          valueFormat={PICKER_DATE_FORMAT}
          value={endsOn}
          onChange={setEndsOn}
          minDate={startsOn ?? londonToday()}
          clearable
        />
      </Group>
      <BankHolidaySwitch
        checked={skipBankHolidays}
        onChange={setSkipBankHolidays}
        division={division}
        ask={askDivision ? { value: divisionChoice, onChange: setDivisionChoice } : undefined}
      />
      {!savedRoute && <DatesPreviewLine preview={preview} />}
      <Stack gap="xs">
        <Title order={2} size="h4">
          Your usual train
        </Title>
        <UsualTrainPicker
          label="Your usual train"
          query={outboundQuery}
          usual={usual}
          onPick={setUsual}
          disabledReason={searchReason}
        />
      </Stack>
      {overrideDays.length > 0 && (
        <DayOverridesField
          drafts={overrides}
          onChange={setOverrides}
          days={overrideDays}
          dateFor={overrideDate}
          queryFor={(draftKind, draftTime) =>
            stationsSet
              ? {
                  originCrs: origin,
                  destinationCrs: destination,
                  kind: draftKind,
                  time: draftTime,
                  options: planOptions,
                }
              : null
          }
          baseKind={kind}
          trainLabel="Your usual train"
          waitReason="Choose two different stations first."
        />
      )}
      <Switch
        label="Add the return journey"
        checked={withReturn}
        onChange={(event) => setWithReturn(event.currentTarget.checked)}
      />
      {withReturn && (
        <Stack gap="xs">
          <TargetFields
            legend="Coming back"
            kind={returnKind}
            time={returnTime}
            onKind={(value) => {
              setReturnKind(value);
              setReturnUsual(null);
            }}
            onTime={(value) => {
              setReturnTime(value);
              setReturnUsual(null);
            }}
          />
          <StationBufferField value={returnBuffer} onChange={setReturnBuffer} />
          <UsualTrainPicker
            label="Your usual train back"
            query={usual ? returnQuery : null}
            usual={returnUsual}
            onPick={setReturnUsual}
            disabledReason={usual ? 'Choose a time for the return first.' : 'Pick your usual train there first.'}
          />
          {overrideDays.length > 0 && (
            <DayOverridesField
              drafts={returnOverrides}
              onChange={setReturnOverrides}
              days={overrideDays}
              dateFor={overrideDate}
              queryFor={(draftKind, draftTime) =>
                stationsSet && usual
                  ? { originCrs: destination, destinationCrs: origin, kind: draftKind, time: draftTime, options: null }
                  : null
              }
              baseKind={returnKind}
              trainLabel="Your usual train back"
              waitReason={stationsSet ? 'Pick your usual train there first.' : 'Choose two different stations first.'}
            />
          )}
        </Stack>
      )}
      <Radio.Group
        label="Each day"
        value={matchMode}
        onChange={(value) => setMatchMode(value === 'auto' ? 'auto' : 'manual')}
      >
        <Stack gap="xs" mt={4}>
          <Radio value="manual" label="Remind me to pick my train" />
          <Radio
            value="auto"
            label="Pick my usual train for me"
            description="We'll pick the train closest to your usual one each day."
          />
        </Stack>
      </Radio.Group>
      {error && <Alert color="red">{error}</Alert>}
      <Button
        onClick={() => void handleSave()}
        disabled={!canSave || saving}
        loading={saving}
        className="ds-self-start"
      >
        Save regular journey
      </Button>
      <LoginPromptModal opened={needsLoginState.needsLogin} onClose={needsLoginState.reset}>
        Log in to save a regular journey.
      </LoginPromptModal>
    </Stack>
  );
}
