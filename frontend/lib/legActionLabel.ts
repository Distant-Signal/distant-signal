/** Where a leg sits among the legs a journey page shows ("Leg 2 of 3"). */
export interface LegPlace {
  position: number;
  total: number;
}

/** The accessible name of a per-leg button, so the same button on every leg
 * of a journey reads differently out of context (a screen reader's list of
 * buttons): "Edit search for leg 2: London Kings Cross to Edinburgh". It
 * starts with the visible text (WCAG 2.5.3). `place` is the shown leg
 * position, the same one the visible "Leg 2 of 3" uses; `null` for a lone or
 * folded leg, which has no number. */
export function legActionLabel(action: string, subject: string, place: LegPlace | null): string {
  return place ? `${action} for leg ${place.position}: ${subject}` : `${action}: ${subject}`;
}

/** `legActionLabel` for "Remove leg", whose own text already says "leg":
 * "Remove leg 2: London Kings Cross to Edinburgh". */
export function removeLegLabel(subject: string, place: LegPlace | null): string {
  return place ? `Remove leg ${place.position}: ${subject}` : `Remove leg: ${subject}`;
}
