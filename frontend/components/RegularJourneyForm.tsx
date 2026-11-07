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
  queryOptionsFromPlan,
  REGULAR_JOURNEYS_HREF,
  takeRegularJourneyDraft,
  usualItineraryFromPlan,
  usualTrainSummary,
} from '@/lib/regularJourneys';
import { getStationNames } from '@/lib/suggestions';
import { collectTripPlanStationCodes, fetchTripPlan, TripPlanError, tripPlanStopNames } from '@/lib/tripPlan';
import { apiQuery } from '@/lib/tripPlanTiming';
import { TEMPLATE_DAYS } from '@/lib/templateRecurrence';
import { previewSentence } from '@/lib/upcomingDates';
import type {
  BankHolidayDivision,
  CreateJourneyTemplateRequest,
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
  /** The option picked in this form's own search, to mark it selected. */
  option?: TripPlanItinerary | undefined;
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

/** The trains `/Trips/plan` found for one direction, to pick the usual
 * one from (`ItineraryOption`, as on Plan a journey). */
function TrainChoices({
  plan,
  date,
  stationNames,
  selected,
  onSelect,
}: {
  plan: TripPlanResponse;
  date: string;
  stationNames: Map<string, string>;
  selected: TripPlanItinerary | undefined;
  onSelect: (itinerary: TripPlanItinerary) => void;
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
  return (
    <Stack gap="xs">
      <Text size="sm" c="dimmed">
        Trains on {formatDate(`${date}T12:00:00Z`)}. Pick the one you usually take.
      </Text>
      {segment.itineraries.map((itinerary, index) => (
        <ItineraryOption
          key={index}
          itinerary={itinerary}
          selected={selected === itinerary}
          onSelect={() => onSelect(itinerary)}
          stationNames={stationNames}
          stopAccess={plan.access}
        />
      ))}
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
  const [error, setError] = useState<string | null>(null);

  async function search() {
    if (!query) return;
    setSearching(true);
    setError(null);
    setPlan(null);
    try {
      const result = await fetchTripPlan(
        apiQuery({
          originCrs: query.originCrs,
          destinationCrs: query.destinationCrs,
          waypointCrs: [],
          date: query.date,
          ...(query.kind === 'arrive_by' ? { arriveBy: query.time } : { departAfter: query.time }),
          results: 'options',
          ...queryOptionsFromPlan(query.options),
        }),
      );
      setPlan(result);
      setPlanDate(query.date);
      const names = await getStationNames(collectTripPlanStationCodes(result)).catch(() => new Map<string, string>());
      setStationNames(new Map([...names, ...tripPlanStopNames(result)]));
    } catch (caught) {
      setError(caught instanceof TripPlanError ? caught.message : describeFailure('find', 'trains'));
    } finally {
      setSearching(false);
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
          selected={usual?.option}
          onSelect={(option) => {
            const itinerary = usualItineraryFromPlan([option], (code) => stationNames.get(code));
            onPick({ itinerary, summary: usualTrainSummary(itinerary, (code) => stationNames.get(code)), option });
          }}
        />
      )}
    </Stack>
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
}: {
  /** Offer every few weeks and chosen dates (`regularJourneyRecurrenceEnabled`). */
  recurrenceEnabled?: boolean;
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

  // A changed route or time makes the picked train someone else's.
  function changeOutbound(apply: () => void) {
    apply();
    setUsual(null);
    setReturnUsual(null);
  }

  const canSave =
    !(listed && chosenDates.length === 0) &&
    outboundQuery !== null &&
    usual !== null &&
    (!withReturn || (returnQuery !== null && returnUsual !== null));

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
      return:
        withReturn && returnUsual
          ? {
              target: { kind: returnKind, time: returnTime, dayOffset: 0 },
              usualItinerary: returnUsual.itinerary,
              stationBufferMinutes: returnBuffer,
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
