import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithMantine } from '@/test/render';
import { WorkingTimetable } from './WorkingTimetable';
import type { JourneyStop } from '@/lib/types';
import { JOURNEY_STOP_DEFAULTS } from '@/test/apiDefaults';

function stop(overrides: Partial<JourneyStop>): JourneyStop {
  return {
    ...JOURNEY_STOP_DEFAULTS,
    // The api marks a stop with only a pass time a passing point.
    passingPoint:
      overrides.workingPass != null && overrides.workingArrival == null && overrides.workingDeparture == null,
    crs: null,
    name: null,
    tiploc: null,
    kind: 'Intermediate',
    scheduledArrival: null,
    scheduledDeparture: null,
    actualArrival: null,
    actualDeparture: null,
    estimatedArrival: null,
    estimatedDeparture: null,
    lastEventType: null,
    variationStatus: null,
    delayMinutes: null,
    stopStatus: 'Unknown',
    skipSource: null,
    platform: null,
    plannedPlatform: null,
    platformChanged: false,
    ...overrides,
  };
}

const STOPS = [
  stop({
    crs: 'EUS',
    name: 'London Euston',
    kind: 'Origin',
    scheduledDeparture: '2026-10-01T10:40:00Z',
    workingDeparture: '2026-10-01T10:40:00Z',
  }),
  // A passing point: no stop times, only a pass time.
  stop({ crs: 'WFJ', name: 'Watford Junction', tiploc: 'WATFDJ', workingPass: '2026-10-01T10:52:30Z' }),
  stop({
    crs: 'MTH',
    name: 'Motherwell',
    scheduledArrival: '2026-10-01T16:00:00Z',
    workingArrival: '2026-10-01T16:00:30Z',
    workingDeparture: '2026-10-01T16:02:00Z',
    canBoard: false,
    canAlight: true,
  }),
];

describe('WorkingTimetable', () => {
  it('is collapsed behind a disclosure button by default', () => {
    renderWithMantine(<WorkingTimetable stops={STOPS} />);
    const toggle = screen.getByRole('button', { name: 'Detailed (working timetable)' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('table', { name: 'Working timetable' })).not.toBeInTheDocument();
  });

  it('shows working times with half-minutes, passing points and direction once opened', async () => {
    renderWithMantine(<WorkingTimetable stops={STOPS} />);
    fireEvent.click(screen.getByRole('button', { name: 'Detailed (working timetable)' }));
    expect(await screen.findByRole('table', { name: 'Working timetable' })).toBeInTheDocument();
    expect(screen.getByText('11:52½')).toBeInTheDocument();
    expect(screen.getByText('11:52 and a half')).toBeInTheDocument();
    expect(screen.getByText('Passing point')).toBeInTheDocument();
    expect(screen.getByText('17:00½')).toBeInTheDocument();
    expect(screen.getByText('Set down only')).toBeInTheDocument();
  });

  it('shows observed times in an Actual column, never estimates', async () => {
    renderWithMantine(
      <WorkingTimetable
        stops={[
          stop({
            crs: 'EUS',
            name: 'London Euston',
            kind: 'Origin',
            workingDeparture: '2026-10-01T10:40:00Z',
            actualDeparture: '2026-10-01T10:42:00Z',
          }),
          // Passing point passed: one pass time in both actual fields.
          stop({
            crs: 'WFJ',
            name: 'Watford Junction',
            workingPass: '2026-10-01T10:52:30Z',
            actualArrival: '2026-10-01T10:54:00Z',
            actualDeparture: '2026-10-01T10:54:00Z',
          }),
          // After midnight, London time.
          stop({
            crs: 'MTH',
            name: 'Motherwell',
            workingArrival: '2026-10-01T22:58:00Z',
            workingDeparture: '2026-10-01T23:00:00Z',
            actualArrival: '2026-10-01T23:30:00Z',
            actualDeparture: '2026-10-01T23:31:00Z',
          }),
          // Forecast only: nothing observed.
          stop({
            crs: 'GLC',
            name: 'Glasgow Central',
            kind: 'Terminate',
            workingArrival: '2026-10-01T23:50:00Z',
            estimatedArrival: '2026-10-02T00:05:00Z',
          }),
          // Booked stop the train ran through: no times to show.
          stop({
            crs: 'CRE',
            name: 'Crewe',
            workingArrival: '2026-10-01T12:00:00Z',
            workingDeparture: '2026-10-01T12:02:00Z',
            lastEventType: 'PASS',
          }),
        ]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Detailed (working timetable)' }));
    const table = await screen.findByRole('table', { name: 'Working timetable' });
    expect(screen.getByRole('columnheader', { name: 'Actual' })).toBeInTheDocument();
    expect(table).toHaveTextContent('Departed 11:42');
    expect(table).toHaveTextContent('Passed 11:54');
    expect(table).toHaveTextContent('Arrived 00:30');
    expect(table).toHaveTextContent('Departed 00:31');
    // The forecast 01:05 and the unobserved rows contribute no actual text.
    expect(table).not.toHaveTextContent('01:05');
    expect(screen.getAllByText(/^(Arrived|Departed|Passed) /)).toHaveLength(4);
  });

  it('renders nothing when no stop has a working time (an older schedule)', () => {
    renderWithMantine(<WorkingTimetable stops={[stop({ crs: 'EUS', scheduledDeparture: '2026-10-01T10:40:00Z' })]} />);
    expect(screen.queryByRole('button', { name: 'Detailed (working timetable)' })).not.toBeInTheDocument();
  });
});
