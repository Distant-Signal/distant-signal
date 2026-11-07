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
  Stack,
  Switch,
  Text,
  Title,
} from '@mantine/core';
import { TimeInput } from '@mantine/dates';
import { DateInput } from '@/components/LazyDateFields';
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
import { londonToday } from '@/lib/londonWallClock';
import {
  nextMatchingDate,
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
import type {
  BankHolidayDivision,
  CreateJourneyTemplateRequest,
  PlanOptions,
  StationBufferPrefill,
  TemplateTarget,
  TripPlanItinerary,
  TripPlanResponse,
  UsualItinerary,
} from '@/lib/types';

type TargetKind = TemplateTarget['kind'];

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
 * pick my usual train for me. "Find trains" plans the next matching date
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

export function RegularJourneyForm() {
  const router = useRouter();
  const [originCrs, setOriginCrs] = useState('');
  const [destinationCrs, setDestinationCrs] = useState('');
  const [kind, setKind] = useState<TargetKind>('depart_after');
  const [time, setTime] = useState('');
  const [days, setDays] = useState<string[]>(WEEKDAY_KEYS);
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
  const date = mask === 0 ? null : nextMatchingDate(mask, startsOn, endsOn, londonToday());
  const origin = originCrs.trim().toUpperCase();
  const destination = destinationCrs.trim().toUpperCase();
  const stationsSet = /^[A-Z]{3}$/.test(origin) && /^[A-Z]{3}$/.test(destination) && origin !== destination;
  const searchReason = !stationsSet
    ? 'Choose two different stations first.'
    : time === ''
      ? 'Choose a time first.'
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
    outboundQuery !== null && usual !== null && (!withReturn || (returnQuery !== null && returnUsual !== null));

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
      daysOfWeek: mask,
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
          <Text size="sm" c="red">
            Choose at least one day.
          </Text>
        )}
      </Stack>
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
