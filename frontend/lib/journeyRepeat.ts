import type { JourneyDetail, JourneyRepeat, JourneyRepeatUnsupported } from './types';

/** "Track this journey again" plans the same route on another day
 * (`GET /Journeys/{id}/repeat`); "Move this journey" previews the same
 * plan for a journey that hasn't started (`basis=current`) and saves it
 * with `POST /Journeys/{id}/move`. */
export type RepeatMode = 'repeat' | 'move';

/** Whether the journey's route can be planned again: every train leg has
 * its train, none is Irish (there is no Irish timetable) and no leg is a
 * ride on a transit network. The api has the last word (`status:
 * "unsupported"`). */
export function canPlanAgain(journey: Pick<JourneyDetail, 'legs'>): boolean {
  return journey.legs.every((leg) => {
    if (leg.transitNetwork !== null) return false;
    if (leg.kind !== 'train') return true;
    const uid = leg.trackedTrainState?.trainUid;
    return typeof uid === 'string' && uid !== '' && !uid.toLowerCase().startsWith('ie:');
  });
}

/** The repeat route's path for `mode`, with the date and time asked for
 * (the api's defaults when absent). */
export function repeatPath(
  journeyId: number,
  mode: RepeatMode,
  date: string | null = null,
  time: string | null = null,
): string {
  const params = new URLSearchParams();
  if (mode === 'move') params.set('basis', 'current');
  if (date) params.set('date', date);
  if (time && /^\d{2}:\d{2}$/.test(time)) params.set('time', time);
  const query = params.toString();
  return `/api/Journeys/${journeyId}/repeat${query ? `?${query}` : ''}`;
}

/** Why the planned train was picked, for the line under it. */
export function repeatReasonText(reason: JourneyRepeat['reason']): string | null {
  switch (reason) {
    case 'usual':
      return 'The same trains as before.';
    case 'same_operator':
      return 'The same operator, close to your time.';
    case 'best':
      return 'The quickest way from your time.';
    default:
      return null;
  }
}

/** Why a journey can't be planned again. */
export function unsupportedText(why: JourneyRepeatUnsupported | null): string {
  switch (why) {
    case 'irish':
      return "We can't plan trains in Ireland again yet.";
    case 'transit':
      return "We can't plan a journey with a tram or metro ride again yet.";
    case 'waypoints':
      return "We can't plan a journey with a stop on the way again yet.";
    default:
      return "We can't plan this journey again.";
  }
}
