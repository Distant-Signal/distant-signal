'use client';

import { ConfirmActionButton } from './ConfirmActionButton';

/** Removes a leg from a journey (`DELETE /Journeys/{journeyId}/legs/{legId}`,
 * `crates/api/src/routes/journeys.rs::delete_journey_leg`), so a traveller who
 * picked the wrong train has an exit from the page.
 *
 * `JourneyLegCard` renders this for EVERY owner-viewed leg -- open (unmatched),
 * matched-with-a-window, and matched-without-a-window alike -- alongside
 * "Change train" (offered additionally whenever the leg has a window). The
 * backend route has never cared what created the leg or whether it carries a
 * window, so the button is not gated on either.
 *
 * Mirrors `DeleteTrainButton.tsx`'s confirm-modal shape closely (same
 * `Modal` + `useDisclosure` + `useNeedsLogin` pattern, same
 * `aria-label="Confirm ..."` on the modal's own action button so it has a
 * distinct accessible name from this component's trigger once both are in
 * the DOM) -- deliberately not a bare `window.confirm`, for the same
 * reason every other destructive action in this codebase isn't one.
 *
 * `isOnlyLeg` decides what happens after a successful delete:
 * `journeys::delete_leg`'s own doc comment explains that removing a
 * journey's LAST leg deletes the whole (now-empty) journey too, so
 * `/journeys/{journeyId}` would 404 on a plain `router.refresh()` --
 * this instead redirects to `/journeys`, the same "closest surviving
 * list" target `DeleteTrainButton`'s own default `afterDelete="redirect"`
 * uses for an analogous "this page's own object is gone" case. When a
 * SIBLING leg remains, the journey survives and `router.refresh()` is
 * enough -- the Server Component page re-fetches and this leg's card is
 * simply gone from the list. */
export function RemoveJourneyLegButton({
  journeyId,
  legId,
  isOnlyLeg,
  ariaLabel,
}: {
  journeyId: string;
  legId: string;
  isOnlyLeg: boolean;
  /** The accessible name, naming the leg (`removeLegLabel`). */
  ariaLabel?: string | undefined;
}) {
  return (
    <ConfirmActionButton
      label="Remove leg"
      triggerAriaLabel={ariaLabel}
      actionName="remove leg"
      title="Remove this leg?"
      request={() => fetch(`/api/Journeys/${journeyId}/legs/${legId}`, { method: 'DELETE' })}
      failure={['remove', 'this leg']}
      loginPrompt="Log in to remove this leg"
      onSuccess={(router) => (isOnlyLeg ? router.push('/journeys') : router.refresh())}
    >
      {isOnlyLeg
        ? 'This is the only leg on this journey, so removing it deletes the whole journey. This cannot be undone.'
        : "This cannot be undone. You can add a new leg afterwards if you'd rather pick a different train."}
    </ConfirmActionButton>
  );
}
