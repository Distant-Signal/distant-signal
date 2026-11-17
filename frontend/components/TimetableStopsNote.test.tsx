import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithMantine } from '@/test/render';
import { JOURNEY_STOP_DEFAULTS } from '@/test/apiDefaults';
import {
  TIMETABLE_STOPS_NOTES,
  TimetableStopsNote,
  timetableStopsNoteKind,
  type TimetableStopsNoteFields,
} from './TimetableStopsNote';

const { title, message } = TIMETABLE_STOPS_NOTES.noStops;

/** A train added at short notice: running live, with no stops. */
function train(overrides: Partial<TimetableStopsNoteFields> = {}): TimetableStopsNoteFields {
  return {
    journeyStops: null,
    status: 'en_route',
    trackingPhase: 'live',
    serviceMode: 'train',
    liveTracking: true,
    ...overrides,
  };
}

const stop = {
  ...JOURNEY_STOP_DEFAULTS,
  crs: 'WAT',
  name: 'London Waterloo',
  kind: 'Origin' as const,
  scheduledArrival: null,
  scheduledDeparture: '2026-11-16T10:00:00Z',
  plannedPlatform: null,
  platformChanged: false,
};

describe('timetableStopsNoteKind', () => {
  it.each([null, []])('a live train with stops %j has the no-stops note', (journeyStops) => {
    expect(timetableStopsNoteKind(train({ journeyStops }))).toBe('noStops');
  });

  it.each([
    ['live phase', { status: null, trackingPhase: 'live' }],
    ['on its way', { status: 'en_route', trackingPhase: null }],
    ['arrived', { status: 'completed', trackingPhase: null }],
  ] as const)('counts a train as live when %s', (_name, overrides) => {
    expect(timetableStopsNoteKind(train(overrides))).toBe('noStops');
  });

  it('has no note when the train has stops', () => {
    expect(timetableStopsNoteKind(train({ journeyStops: [stop] }))).toBeNull();
  });

  it.each([
    ['waiting for its first report', { status: 'awaiting_activation', trackingPhase: 'awaitingReport' }],
    ['not in the timetable', { status: null, trackingPhase: 'noTimetable' }],
    ['cancelled', { status: 'cancelled', trackingPhase: null }],
    // The api's live phase covers a cancellation too.
    ['cancelled in the live phase', { status: 'cancelled', trackingPhase: 'live' }],
    ['unknown', { status: null, trackingPhase: null }],
  ] as const)('has no note without live running (%s)', (_name, overrides) => {
    expect(timetableStopsNoteKind(train(overrides))).toBeNull();
  });

  it('has no note for a bus or ferry, never tracked live', () => {
    expect(timetableStopsNoteKind(train({ serviceMode: 'bus', liveTracking: false }))).toBeNull();
  });
});

describe('TimetableStopsNote', () => {
  it('says why a live train shows no stops', () => {
    renderWithMantine(<TimetableStopsNote train={train()} />);
    const note = screen.getByRole('note');
    expect(note).toHaveTextContent(title);
    expect(note).toHaveTextContent(message);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders nothing when the train has stops', () => {
    const { container } = renderWithMantine(<TimetableStopsNote train={train({ journeyStops: [stop] })} />);
    expect(screen.queryByText(title)).not.toBeInTheDocument();
    expect(container.querySelector('[data-timetable-stops-note]')).toBeNull();
  });
});
