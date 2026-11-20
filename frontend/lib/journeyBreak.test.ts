import { describe, expect, it } from 'vitest';
import {
  breakBody,
  breakTitle,
  changesLabel,
  fateBadge,
  MISSED_UNDO_CAP_MS,
  UNDO_WINDOW_MS,
  legMissWindowOpen,
  missableLegRef,
  missedOffer,
  missWindowClosesMs,
  undoWindowMs,
  openBreakTitleFacts,
  revisionLegLine,
  revisionTitle,
  suggestionBadges,
  suggestionDelay,
  suggestionLegBody,
  suggestionLegLines,
  suggestionSetBody,
  suggestionSetTitleFacts,
  suggestionSummary,
  type BreakTitleFacts,
} from './journeyBreak';
import { legRef } from './publicId';
import { ID_SHAPES } from '@/test/zeroNumericIds';
import { trainLeg, untrackedLeg } from '@/test/journeyFixtures';
import { replanSuggestion, suggestionSet, trainSuggestionLeg, openBreakSummary } from '@/test/replanFixtures';
import type { RevisionLeg } from './types';
import { REVISION_LEG_DEFAULTS } from '@/test/apiDefaults';

const facts: BreakTitleFacts = {
  cause: 'cancelled',
  // 09:52 UK time (BST).
  departure: '2026-09-17T08:52:00Z',
  trainDestinationName: 'Edinburgh',
  legDestinationName: 'York',
  stationName: 'York',
};

describe('breakTitle', () => {
  it('words each cause', () => {
    expect(breakTitle(facts)).toBe('09:52 to Edinburgh cancelled');
    expect(breakTitle({ ...facts, cause: 'connection_missed' })).toBe('Connection at York missed');
    expect(breakTitle({ ...facts, cause: 'user_missed' })).toBe('You missed the 09:52 to Edinburgh');
    expect(breakTitle({ ...facts, cause: 'part_cancelled', stationName: 'Durham' })).toBe(
      '09:52 to Edinburgh no longer stops at Durham',
    );
    expect(breakTitle({ ...facts, cause: 'skipped_stop', stationName: 'Durham' })).toBe(
      '09:52 to Edinburgh no longer stops at Durham',
    );
  });

  it('falls back to fewer facts', () => {
    const none: BreakTitleFacts = {
      cause: 'cancelled',
      departure: null,
      trainDestinationName: null,
      legDestinationName: null,
      stationName: null,
    };
    expect(breakTitle(none)).toBe('Your train cancelled');
    expect(breakTitle({ ...none, departure: facts.departure })).toBe('09:52 train cancelled');
    expect(breakTitle({ ...none, cause: 'connection_missed' })).toBe('Connection missed');
    expect(breakTitle({ ...none, cause: 'user_missed' })).toBe('You missed your train');
    expect(breakTitle({ ...none, cause: 'user_missed', departure: facts.departure })).toBe(
      'You missed the 09:52 train',
    );
    expect(breakTitle({ ...none, cause: 'skipped_stop' })).toBe('Your train no longer stops where you need it');
    expect(breakTitle({ ...none, cause: 'part_cancelled', stationName: 'Durham' })).toBe(
      'Your train no longer stops at Durham',
    );
  });

  it('uses the leg destination when the train destination is unknown', () => {
    expect(breakTitle({ ...facts, trainDestinationName: null, cause: 'user_missed' })).toBe(
      'You missed the 09:52 to York',
    );
  });

  it('names a free choice by where it goes', () => {
    expect(breakTitle({ ...facts, cause: null, legDestinationName: 'Edinburgh' })).toBe('Other ways to Edinburgh');
    expect(breakTitle({ ...facts, cause: null, legDestinationName: null })).toBe('Other trains');
  });
});

describe('openBreakTitleFacts', () => {
  it('reads the trigger leg', () => {
    const leg = trainLeg(
      7,
      ['KGX', 'London Kings Cross'],
      ['YRK', 'York'],
      '2026-09-17T08:52:00Z',
      '2026-09-17T11:00:00Z',
      {
        scheduleDestinationName: 'Edinburgh',
      },
    );
    const result = openBreakTitleFacts(openBreakSummary({ triggerLegId: 7, cause: 'cancelled' }), [leg]);
    expect(breakTitle(result)).toBe('09:52 to Edinburgh cancelled');
  });

  it('copes with no trigger leg', () => {
    const result = openBreakTitleFacts(openBreakSummary({ triggerLegId: null, cause: 'connection_missed' }), []);
    expect(breakTitle(result)).toBe('Connection at York missed');
  });
});

describe('suggestionSetTitleFacts', () => {
  it('takes the station of a missed connection from the trigger', () => {
    const set = suggestionSet();
    expect(breakTitle(suggestionSetTitleFacts(set, 'connection_missed', null))).toBe('Connection at York missed');
    expect(breakTitle(suggestionSetTitleFacts(set, 'user_missed', null))).toBe('You missed the 09:52 to Edinburgh');
    expect(breakTitle(suggestionSetTitleFacts(set, null, null))).toBe('Other ways to Edinburgh');
  });
});

describe('breakBody', () => {
  it('counts the ways and names the first arrival', () => {
    expect(breakBody(3, 'Edinburgh', '2026-09-17T10:12:00Z')).toBe('3 other ways to Edinburgh. First arrives 11:12.');
    expect(breakBody(1, 'Edinburgh', null)).toBe('1 other way to Edinburgh.');
    expect(breakBody(2, null, null)).toBe('2 other ways.');
  });

  it('says when there are none', () => {
    expect(breakBody(0, 'Edinburgh', null)).toBe('No more trains to Edinburgh today.');
    expect(breakBody(0, null, null)).toBe('No more trains today.');
  });

  it('says when none are planned yet', () => {
    expect(breakBody(0, 'Edinburgh', null, false)).toBe('Looking for other trains.');
  });

  it('reads a suggestion set', () => {
    expect(suggestionSetBody(suggestionSet())).toBe('3 other ways to Edinburgh. First arrives 12:10.');
  });
});

describe('suggestion rows', () => {
  it('summarises a suggestion', () => {
    expect(suggestionSummary(replanSuggestion())).toBe('10:04 York to Edinburgh, direct');
    const changing = replanSuggestion({
      changeCount: 1,
      legs: [
        trainSuggestionLeg({ destinationName: 'Newcastle', destinationCrs: 'NCL' }),
        trainSuggestionLeg({ originName: 'Newcastle', originCrs: 'NCL', departure: '2026-09-17T10:30:00Z' }),
      ],
    });
    expect(suggestionSummary(changing)).toBe('10:04 York to Edinburgh, 1 change');
    expect(suggestionLegLines(changing)).toEqual([
      '10:04 York to Newcastle, LNER (GR)',
      '11:30 Newcastle to Edinburgh, LNER (GR)',
    ]);
  });

  it('falls back to the set ends with no legs', () => {
    expect(
      suggestionSummary(replanSuggestion({ legs: [] }), { originName: 'York', destinationName: 'Edinburgh' }),
    ).toBe('10:04 York to Edinburgh, direct');
  });

  it('words changes', () => {
    expect(changesLabel(0)).toBe('direct');
    expect(changesLabel(1)).toBe('1 change');
    expect(changesLabel(2)).toBe('2 changes');
  });

  it('words an untracked leg', () => {
    const walk = replanSuggestion({
      legs: [
        {
          kind: 'untracked',
          transitMode: 'walk',
          originName: 'Euston',
          destinationName: "King's Cross",
          lineName: null,
          originStopId: null,
          destinationStopId: null,
          plannedDeparture: '2026-09-17T09:00:00Z',
          plannedArrival: '2026-09-17T09:15:00Z',
        },
      ],
    });
    expect(suggestionLegLines(walk)).toEqual(["Walk, Euston to King's Cross"]);
  });
});

describe('suggestionDelay', () => {
  it('is orange until an hour, then red', () => {
    expect(suggestionDelay(12)).toEqual({
      text: '+12 min',
      spoken: 'Arrives 12 min after your booked time',
      tone: 'late',
    });
    expect(suggestionDelay(59)?.tone).toBe('late');
    expect(suggestionDelay(60)?.tone).toBe('critical');
  });

  it('says on time and early', () => {
    expect(suggestionDelay(0)?.text).toBe('On time');
    expect(suggestionDelay(-3)).toMatchObject({ text: '−3 min', tone: 'early' });
    expect(suggestionDelay(null)).toBeNull();
  });
});

describe('suggestionBadges', () => {
  it('puts the picks first, then the fit, at most three', () => {
    const badges = suggestionBadges(
      replanSuggestion({
        pickLabels: ['Recommended', 'Fastest', 'Same operator'],
        fit: 'likelyNewTicket',
        fitLabel: 'May need a new ticket',
        fitReason: 'Your Advance ticket is for the 09:52 only.',
      }),
    );
    expect(badges).toEqual([
      { label: 'Recommended', tone: 'neutral', reason: null },
      { label: 'Fastest', tone: 'neutral', reason: null },
      { label: 'May need a new ticket', tone: 'caution', reason: 'Your Advance ticket is for the 09:52 only.' },
    ]);
  });

  it('keeps a covered fit gray and three picks without a fit', () => {
    expect(
      suggestionBadges(replanSuggestion({ fit: 'covered', fitLabel: 'Usually covered by your ticket' })).at(-1)?.tone,
    ).toBe('neutral');
    expect(
      suggestionBadges(replanSuggestion({ pickLabels: ['A', 'B', 'C', 'D'], fit: null, fitLabel: null })).map(
        (badge) => badge.label,
      ),
    ).toEqual(['A', 'B', 'C']);
  });

  it('flags a suggestion outside the operator filter and names an operator-only one', () => {
    expect(
      suggestionBadges(
        replanSuggestion({
          pickLabels: ['Recommended', 'Fastest'],
          fit: 'covered',
          fitLabel: 'Usually covered by your ticket',
          outsideOperatorFilter: true,
        }),
      ).map((badge) => [badge.label, badge.tone]),
    ).toEqual([
      ['Recommended', 'neutral'],
      ['Uses other operators', 'caution'],
      ['Usually covered by your ticket', 'neutral'],
    ]);
    expect(
      suggestionBadges(
        replanSuggestion({
          pickLabels: [],
          fit: null,
          fitLabel: null,
          legs: [trainSuggestionLeg()],
          operatorOnly: ['GR'],
        }),
      ).map((badge) => badge.label),
    ).toEqual(['LNER only']);
  });
});

describe('suggestionLegBody', () => {
  it('maps a train leg, leaving out unknown ends', () => {
    expect(suggestionLegBody(trainSuggestionLeg())).toEqual({
      trainUid: 'L12345',
      serviceDate: '2026-09-17',
      originCrs: 'YRK',
      destinationCrs: 'EDB',
    });
    expect(suggestionLegBody(trainSuggestionLeg({ originCrs: null, destinationCrs: null }))).toEqual({
      trainUid: 'L12345',
      serviceDate: '2026-09-17',
    });
  });

  it('maps an untracked leg, leaving out nulls', () => {
    expect(
      suggestionLegBody({
        kind: 'untracked',
        transitMode: 'tube',
        originName: 'Euston',
        destinationName: 'Victoria',
        lineName: 'Victoria line',
        originStopId: '940GZZLUEUS',
        destinationStopId: null,
        plannedDeparture: '2026-09-17T09:00:00Z',
        plannedArrival: '2026-09-17T09:15:00Z',
      }),
    ).toEqual({
      kind: 'untracked',
      transitMode: 'tube',
      originName: 'Euston',
      destinationName: 'Victoria',
      lineName: 'Victoria line',
      originStopId: '940GZZLUEUS',
      plannedDeparture: '2026-09-17T09:00:00Z',
      plannedArrival: '2026-09-17T09:15:00Z',
    });
  });
});

describe('history', () => {
  it('labels fates', () => {
    expect(fateBadge('cancelled')).toEqual({ label: 'Cancelled', tone: 'critical' });
    expect(fateBadge('missed')).toEqual({ label: 'Missed', tone: 'late' });
    expect(fateBadge('not_used')).toEqual({ label: 'Not used', tone: 'neutral' });
    expect(fateBadge('travelled')).toEqual({ label: 'Travelled', tone: 'neutral' });
    expect(fateBadge('planned')).toBeNull();
  });

  it('titles plans', () => {
    expect(revisionTitle({ reason: 'booked' })).toBe('Booked plan');
    expect(revisionTitle({ reason: 'replace' })).toBe('Changed plan');
    expect(revisionTitle({ reason: 'auto_shift' })).toBe('Updated plan');
    expect(revisionTitle({ reason: 'revert' })).toBe('Earlier plan restored');
  });

  it('words a plan leg', () => {
    const leg: RevisionLeg = {
      ...REVISION_LEG_DEFAULTS,
      position: 0,
      sourceLegId: 1,
      kind: 'train',
      trainUid: 'L1',
      serviceDate: '2026-09-17',
      atocCode: 'GR',
      originCrs: 'YRK',
      originName: 'York',
      destinationCrs: 'EDB',
      destinationName: 'Edinburgh',
      bookedDeparture: '2026-09-17T08:52:00Z',
      bookedArrival: '2026-09-17T11:00:00Z',
      transitMode: null,
      originPlace: null,
      destinationPlace: null,
      lineName: null,
      plannedDeparture: null,
      plannedArrival: null,
      fate: 'cancelled',
    };
    expect(revisionLegLine(leg)).toBe('09:52 York to Edinburgh, GR');
    expect(revisionLegLine(leg, { GR: 'London North Eastern Railway' })).toBe(
      '09:52 York to Edinburgh, London North Eastern Railway (GR)',
    );
    expect(revisionLegLine({ ...leg, atocCode: null })).toBe('09:52 York to Edinburgh');
    expect(
      revisionLegLine({
        ...leg,
        kind: 'untracked',
        transitMode: 'walk',
        originPlace: 'Euston',
        destinationPlace: "King's Cross",
        plannedDeparture: '2026-09-17T08:00:00Z',
      }),
    ).toBe("09:00 Walk, Euston to King's Cross");
  });
});

describe('missableLegRef', () => {
  const now = new Date('2026-09-17T09:30:00Z');
  it('is the first train leg not yet over', () => {
    const first = trainLeg(1, ['KGX', 'Kings Cross'], ['YRK', 'York'], '2026-09-17T07:00:00Z', '2026-09-17T09:00:00Z', {
      status: 'completed',
    });
    const walk = untrackedLeg(2, 'York', 'York', '2026-09-17T09:05:00Z', '2026-09-17T09:10:00Z');
    const second = trainLeg(3, ['YRK', 'York'], ['EDB', 'Edinburgh'], '2026-09-17T10:00:00Z', '2026-09-17T12:00:00Z');
    expect(missableLegRef([first, walk, second], now)).toBe(legRef(second));
  });

  it('is null when every train leg is over: those offer the small button instead', () => {
    const done = trainLeg(1, ['KGX', 'Kings Cross'], ['YRK', 'York'], '2026-09-17T07:00:00Z', '2026-09-17T09:00:00Z', {
      status: 'completed',
    });
    expect(missableLegRef([done], now)).toBeNull();
    expect(missedOffer([done], done, now)).toBe('small');
  });
});

/* The miss window mirrors the api's `journey_breaks::miss_window_open`: open
 * until 04:00 London the morning after the leg's service date. */
describe('missWindowClosesMs', () => {
  it('is 04:00 London the next morning: 03:00Z in summer time', () => {
    expect(new Date(missWindowClosesMs('2026-09-17')).toISOString()).toBe('2026-09-18T03:00:00.000Z');
  });

  it('is 04:00Z in winter', () => {
    expect(new Date(missWindowClosesMs('2026-12-17')).toISOString()).toBe('2026-12-18T04:00:00.000Z');
  });

  it('follows the clocks on a change day', () => {
    // The clocks go forward at 01:00 on 29 Mar 2026 and back on 25 Oct 2026.
    expect(new Date(missWindowClosesMs('2026-03-28')).toISOString()).toBe('2026-03-29T03:00:00.000Z');
    expect(new Date(missWindowClosesMs('2026-10-24')).toISOString()).toBe('2026-10-25T04:00:00.000Z');
  });
});

describe('legMissWindowOpen', () => {
  const arrived = trainLeg(1, ['KGX', 'Kings Cross'], ['YRK', 'York'], '2026-09-17T07:00:00Z', '2026-09-17T09:00:00Z', {
    status: 'completed',
  });

  it('is open after the train has departed and after it has reached its destination', () => {
    expect(legMissWindowOpen(arrived, new Date('2026-09-17T07:30:00Z'))).toBe(true);
    expect(legMissWindowOpen(arrived, new Date('2026-09-17T09:30:00Z'))).toBe(true);
    expect(legMissWindowOpen(arrived, new Date('2026-09-17T23:30:00Z'))).toBe(true);
  });

  it('closes at 04:00 London the next morning, not before', () => {
    expect(legMissWindowOpen(arrived, new Date('2026-09-18T02:59:59Z'))).toBe(true);
    expect(legMissWindowOpen(arrived, new Date('2026-09-18T03:00:00Z'))).toBe(false);
  });

  it('is closed for an untracked leg and a leg with no train picked', () => {
    const walk = untrackedLeg(2, 'York', 'York', '2026-09-17T09:05:00Z', '2026-09-17T09:10:00Z');
    expect(legMissWindowOpen(walk, new Date('2026-09-17T09:30:00Z'))).toBe(false);
    expect(legMissWindowOpen({ ...arrived, trackedTrainState: null }, new Date('2026-09-17T09:30:00Z'))).toBe(false);
  });

  it('stays open for a cancelled train, which is never over for this', () => {
    const cancelled = { ...arrived, trackedTrainState: { ...arrived.trackedTrainState!, status: 'cancelled' } };
    expect(legMissWindowOpen(cancelled as typeof arrived, new Date('2026-09-17T12:00:00Z'))).toBe(true);
  });
});

describe('missedOffer', () => {
  const now = new Date('2026-09-17T09:30:00Z');
  const first = trainLeg(1, ['KGX', 'Kings Cross'], ['YRK', 'York'], '2026-09-17T07:00:00Z', '2026-09-17T09:00:00Z', {
    status: 'completed',
  });
  const second = trainLeg(3, ['YRK', 'York'], ['EDB', 'Edinburgh'], '2026-09-17T10:00:00Z', '2026-09-17T12:00:00Z');

  it('is the main offer on the first train not yet over and small on a finished one', () => {
    expect(missedOffer([first, second], second, now)).toBe('main');
    expect(missedOffer([first, second], first, now)).toBe('small');
  });

  it('is none once the window has closed', () => {
    expect(missedOffer([first, second], first, new Date('2026-09-18T03:30:00Z'))).toBeNull();
  });

  it.each(ID_SHAPES)('offers main on one leg only, whatever the numeric ids (%s)', (_name, shape) => {
    const legs = shape([first, second]);
    const [a, b] = legs;
    if (a === undefined || b === undefined) throw new Error('fixture');
    expect(missedOffer(legs, a, now)).toBe('small');
    expect(missedOffer(legs, b, now)).toBe('main');
  });
});

describe('undoWindowMs', () => {
  const now = new Date('2026-09-17T09:00:00Z');

  it('is 2 minutes for any change but a miss', () => {
    expect(undoWindowMs(false, '2026-09-17T09:30:00Z', now)).toBe(UNDO_WINDOW_MS);
    expect(UNDO_WINDOW_MS).toBe(120_000);
  });

  it('runs to the new train leaving after a miss', () => {
    expect(undoWindowMs(true, '2026-09-17T09:20:00Z', now)).toBe(20 * 60_000);
  });

  it('is capped at an hour', () => {
    expect(undoWindowMs(true, '2026-09-17T15:00:00Z', now)).toBe(MISSED_UNDO_CAP_MS);
    expect(MISSED_UNDO_CAP_MS).toBe(3_600_000);
  });

  it('is never less than the usual 2 minutes, and an hour when the departure is unknown', () => {
    expect(undoWindowMs(true, '2026-09-17T09:00:30Z', now)).toBe(UNDO_WINDOW_MS);
    expect(undoWindowMs(true, '2026-09-17T08:00:00Z', now)).toBe(UNDO_WINDOW_MS);
    expect(undoWindowMs(true, null, now)).toBe(MISSED_UNDO_CAP_MS);
  });
});
