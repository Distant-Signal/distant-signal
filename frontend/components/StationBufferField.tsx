import { NumberInput } from '@mantine/core';

/** The station buffer's limits, in minutes (the api's and the columns'). */
export const STATION_BUFFER_MAX = 120;

/** "Minutes to get to the station" (regular journeys design §5.4): the
 * traveller's own time from the door to the train, margin included. The
 * leave-by is the first departure less this. Empty means no leave-by. */
export function StationBufferField({
  value,
  onChange,
  disabled = false,
  description = 'Include a few minutes to spare.',
}: {
  value: number | null;
  onChange: (minutes: number | null) => void;
  disabled?: boolean;
  description?: string;
}) {
  return (
    <NumberInput
      label="Minutes to get to the station"
      description={description}
      min={0}
      max={STATION_BUFFER_MAX}
      step={1}
      allowDecimal={false}
      allowNegative={false}
      clampBehavior="strict"
      value={value ?? ''}
      disabled={disabled}
      onChange={(next) => onChange(typeof next === 'number' ? next : next === '' ? null : Number(next))}
      maw={240}
    />
  );
}
