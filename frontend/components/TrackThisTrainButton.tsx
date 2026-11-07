'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Stack } from '@mantine/core';
import { useNeedsLogin } from './useNeedsLogin';
import { LoginPromptModal } from './LoginPromptModal';
import { TrackDestinationModal } from './TrackDestinationModal';
import { useGroupSummaries } from '@/lib/useGroupSummaries';
import { shareTrackedTrainToGroup } from '@/lib/shareTrackedTrain';
import type { CreateJourneyResponse } from '@/lib/types';
import type { TrackIrishTrainRequest, TrackIrishTrainResponse } from '@/lib/api-types';
import { ButtonSpinner } from '@/components/LoadingText';

/** The "Track this train" action for a train whose real CIF identity is
 * already known -- a `(train_uid, service_date)` pair. Calls `POST
 * /Journeys` (`crates/api/src/routes/journeys.rs`) with a single
 * `knownTrain`-mode leg (`{ mode: 'knownTrain', trainUid, serviceDate }`):
 * identity is already fully known, so there is no form to fill in and
 * nothing to validate client-side. That is the whole difference from
 * `TrackTrainForm`'s legacy `POST /Train/track` flow, which has to guess an
 * identity from a CRS + time pin. Journey tracking Phase 1 -- see
 * .superpowers/sdd/2026-09-22-journey-tracking-phase1-single-leg-migration-plan
 * -- moved this off the former single-purpose
 * `POST /Train/by-uid/{uid}/{date}/track` route onto the new journeys
 * entry point; the response now carries a `journeyId` alongside the
 * underlying `trackingId`.
 *
 * Calls the same-origin `/api/*` proxy rather than `lib/api.ts` -- this is
 * a Client Component and cannot read the server-only `API_BASE_URL` env var
 * (same reasoning as `PinToggle` and `TrackTrainForm`).
 *
 * 401 handling is the shared `useNeedsLogin`/`LoginPromptModal` pattern
 * (`useNeedsLogin.ts`'s own doc comment names it). Unlike `TrackTrainForm`,
 * there is no typed input to protect on a 401 -- this control is a single
 * click, so it behaves like `PinToggle`: show the prompt, change nothing
 * else.
 *
 * `disabled={busy}` is load-bearing, not cosmetic:
 * `train_tracking::create_subscription_for_train` is idempotent per
 * `(user_id, trains_id)` as of this feature, but that in-function fix
 * cannot close a genuinely concurrent double-submit under READ COMMITTED.
 * Disabling the control while its request is in flight is what does.
 *
 * Shared-groups follow-up: `useGroupSummaries()` decides, once on mount,
 * whether this user is a member of any group at all. Zero groups (the
 * majority case today, and every anonymous visitor) leaves `track()` wired
 * directly to the button's `onClick`, exactly as before this feature
 * existed -- no prompt, no behavior change, no extra render state. One or
 * more groups instead routes the click through `TrackDestinationModal`
 * (see its own doc comment for why it's safe to reuse this same `track()`
 * function unmodified for the confirm step); either way, `track()` itself
 * is the single place that actually calls `POST /Journeys`, so the
 * zero-groups code path an existing test locks down is untouched. Once
 * tracking succeeds, sharing into the chosen group
 * (`shareTrackedTrainToGroup`) is a best-effort follow-up: tracking has
 * already succeeded by then, so a failure must not block navigation --
 * see that helper's own doc comment.
 *
 * An Iarnród Éireann train (`irish`, from its page) has no CIF identity:
 * it is tracked by its code and service date through
 * `POST /Journeys/irish-train`, which answers the same `journeyId` and
 * `trackingId`
 * (docs/superpowers/specs/2026-11-05-irish-rail-train-tracking-design.md
 * §9). The group picker and the redirect are the same. */
export function TrackThisTrainButton({
  uid,
  date,
  irish,
  size = 'sm',
  variant = 'filled',
  noun = 'train',
}: (
  | { uid: string; date: string; irish?: undefined }
  | {
      uid?: undefined;
      date?: undefined;
      /** The Irish train to track, and the board it was opened from. */
      irish: TrackIrishTrainRequest;
    }
) & {
  size?: 'xs' | 'sm' | 'md';
  /** `light` where tracking is a secondary action on the page (a train's
   * own page, which is for its timetable first); `filled` (the default)
   * where tracking is what the page is for. */
  variant?: 'filled' | 'light';
  /** What the service is, for the button text ("Track this bus"). A bus or
   * ferry is tracked timetable-only: it is added to your list with its
   * scheduled times, but gets no live alerts. */
  noun?: 'train' | 'bus' | 'ferry';
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const needsLoginState = useNeedsLogin();
  const { groups } = useGroupSummaries();
  const [destinationPromptOpened, setDestinationPromptOpened] = useState(false);

  async function track(groupId: string | null) {
    setBusy(true);
    needsLoginState.reset();
    setError(null);
    try {
      const response = irish
        ? await fetch('/api/Journeys/irish-train', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(irish),
          })
        : await fetch('/api/Journeys', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              leg: { mode: 'knownTrain', trainUid: uid, serviceDate: date },
            }),
          });

      if (response.ok) {
        const result = (await response.json()) as CreateJourneyResponse | TrackIrishTrainResponse;
        if (groupId !== null) {
          // Best-effort: tracking has already succeeded above. Shares the
          // train's new one-leg journey (DS-124).
          await shareTrackedTrainToGroup(groupId, result.journeyId);
        }
        router.push(`/journeys/${result.journeyId}`);
        return;
      }
      if (response.status === 401) {
        needsLoginState.markNeedsLogin();
        return;
      }
      if (irish && response.status === 404) {
        setError("We haven't seen this train on a departure board.");
        return;
      }
      setError("Couldn't track this train. Try again.");
    } catch {
      setError("Couldn't track this train. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function handleClick() {
    if (groups.length > 0) {
      setDestinationPromptOpened(true);
      return;
    }
    void track(null);
  }

  return (
    <Stack gap="xs">
      <Button
        size={size}
        variant={variant}
        onClick={handleClick}
        disabled={busy}
        leftSection={busy ? <ButtonSpinner /> : undefined}
      >
        {busy ? 'Tracking' : `Track this ${noun}`}
      </Button>
      {error && (
        <Alert color="red" title={`Couldn't track this ${noun}`}>
          {error}
        </Alert>
      )}
      <TrackDestinationModal
        opened={destinationPromptOpened}
        groups={groups}
        onClose={() => setDestinationPromptOpened(false)}
        onConfirm={(groupId) => void track(groupId)}
      />
      <LoginPromptModal opened={needsLoginState.needsLogin} onClose={needsLoginState.reset}>
        Log in to track this train.
      </LoginPromptModal>
    </Stack>
  );
}
