'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ActionIcon, Group, Switch, Text } from '@mantine/core';
import { useNeedsLogin } from './useNeedsLogin';
import { LoginPromptModal } from './LoginPromptModal';
import { LazyTooltip } from './LazyTooltip';
import type { Preferences } from '@/lib/types';
import { tokens } from '@/lib/theme';
import { describeFailure } from '@/lib/failure';

/** Every pin write in the tab, one after another (see `toggle()`). Each
 * toggle reads the whole pinned list and writes it back whole, so two
 * running at once (star A, then B on /lines before A's write lands) both
 * read the list without the other's change and the second write drops the
 * first pin. Queued, B's read happens after A's write. A failed task never
 * stalls the queue. Two tabs can still race, but only a click apart. */
let pinWrites: Promise<unknown> = Promise.resolve();

export function serialisePinWrite<T>(task: () => Promise<T>): Promise<T> {
  const run = pinWrites.then(task, task);
  pinWrites = run.catch(() => undefined);
  return run;
}

type PinKind = 'line' | 'station' | 'operator';

/** Same star glyph in both states so the shape reads as "star" either way;
 * the pinned/unpinned distinction itself comes from `fill` (none vs
 * `currentColor`) combined with the `ActionIcon`'s `variant`/`color`, which
 * is set differently per state below — fill is deliberately not the only
 * signal, since a squashed icon at small sizes can make a fill-only
 * distinction hard to see. */
function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

/** Calls the same-origin `/api/*` proxy (see `app/api/[...path]/route.ts`)
 * rather than `lib/api.ts` — this is a Client Component, which cannot read
 * the server-only `API_BASE_URL` env var `lib/api.ts`'s functions rely on. */
export function PinToggle({
  kind,
  id,
  name,
  initiallyPinned,
  needsAccountHint = false,
}: {
  kind: PinKind;
  id: string;
  /** What the star pins, said in its accessible name ("Pin Victoria line,
   * currently not pinned"): a page of them (245 stars on /lines) is
   * otherwise a list of identical buttons to a screen reader. */
  name: string;
  initiallyPinned: boolean;
  // Review §3.4 (Task 3.4.13): an anonymous visitor gets no hint that
  // pinning needs an account until they click and hit the `401` prompt
  // below -- this folds "needs an account" into the star's own tooltip/
  // aria-label up front instead, for a visitor known to have no session.
  // Optional and defaulted to `false` so the one other call site
  // (`app/stations/[crs]/page.tsx`, which doesn't yet thread a viewer's
  // anonymous/signed-in state down to this component) is unaffected.
  needsAccountHint?: boolean;
}) {
  const router = useRouter();
  const [pinned, setPinned] = useState(initiallyPinned);
  // Follows a changed `initiallyPinned` (a `router.refresh()` after a pin
  // made in another tab or row), so the star and the next toggle start from
  // what the server says. Adjusted while rendering, React's pattern for
  // state that follows a prop, rather than in an effect.
  const [seenInitiallyPinned, setSeenInitiallyPinned] = useState(initiallyPinned);
  if (seenInitiallyPinned !== initiallyPinned) {
    setSeenInitiallyPinned(initiallyPinned);
    setPinned(initiallyPinned);
  }
  const [busy, setBusy] = useState(false);
  // Set on a 401 from either request below, reset at the start of every
  // fresh attempt. Surfaces *why* the click did nothing, instead of the
  // dead-click silence this replaced (see the comment further down).
  const needsLoginState = useNeedsLogin();
  // Set on a network failure (a rejected `fetch()`) from either request
  // below, reset at the start of every fresh attempt -- see the `catch`
  // block in `toggle()` for why this exists.
  const [error, setError] = useState<string | null>(null);
  // A line just pinned asks whether to alert about it too (DS-153), on by
  // default: pinning and alerting are separate. `null` until it asks.
  const [alerts, setAlerts] = useState<boolean | null>(null);
  const [alertsBusy, setAlertsBusy] = useState(false);
  // The log-in prompt is mounted at the first click, not up front (DS-374):
  // a closed Mantine `Modal` still sets up its portal and hooks, once per
  // row of /lines. Mounted closed while the first request is in flight, so
  // a 401 opens it with its usual transition.
  const [loginPromptMounted, setLoginPromptMounted] = useState(false);

  /** A read-modify-write of the whole pinned list (there are no per-item
   * endpoints): re-fetch `/api/preferences`, add or remove `id`, `PUT` the
   * list back. The read and write run in `serialisePinWrite`'s queue, so
   * stars pressed quickly in one tab can't drop each other's pins. The new
   * list is the server's list with `id` added or removed as this press
   * asks, so a pin made in another tab is never added twice. */
  async function toggle() {
    // Not `disabled` while busy (below), so a second press has to be refused
    // here.
    if (busy) return;
    const wantPinned = !pinned;
    const verb = wantPinned ? 'pin' : 'unpin';
    const noun = `this ${kind}`;
    setBusy(true);
    setLoginPromptMounted(true);
    needsLoginState.reset();
    setError(null);
    try {
      await serialisePinWrite(async () => {
        const prefsResponse = await fetch('/api/preferences');
        // Both endpoints require an authenticated user, so an anonymous
        // visitor gets a 401 from each. A failed response is never parsed
        // or applied (a 401 body is not JSON), and the star only flips once
        // the write landed. A 401 opens the log-in prompt; any other
        // failure says so, rather than a click that does nothing.
        if (!prefsResponse.ok) {
          fail(prefsResponse.status, verb, noun);
          return;
        }
        const prefs = (await prefsResponse.json()) as Preferences;
        let key: 'pinnedLines' | 'pinnedStations' | 'pinnedOperators';
        let endpoint: string;
        if (kind === 'line') {
          key = 'pinnedLines';
          endpoint = '/api/preferences/pinned-lines';
        } else if (kind === 'station') {
          key = 'pinnedStations';
          endpoint = '/api/preferences/pinned-stations';
        } else {
          key = 'pinnedOperators';
          endpoint = '/api/preferences/pinned-operators';
        }
        const without = prefs[key].filter((existing) => existing !== id);
        const next = wantPinned ? [...without, id] : without;
        const putResponse = await fetch(endpoint, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(next),
        });
        if (!putResponse.ok) {
          fail(putResponse.status, verb, noun);
          return;
        }
        setPinned(wantPinned);
        setAlerts(kind === 'line' && wantPinned ? true : null);
        router.refresh();
      });
    } catch {
      // A rejected `fetch()` (offline, DNS failure, a dropped connection):
      // say so, never a dead click or the browser's own message.
      setError(describeFailure(verb, noun));
    } finally {
      setBusy(false);
    }
  }

  /** A failed read or write: the log-in prompt for a 401, otherwise the
   * failure in words. */
  function fail(status: number, verb: string, noun: string) {
    if (status === 401) {
      needsLoginState.markNeedsLogin();
    } else {
      setError(describeFailure(verb, noun, status));
    }
  }

  /** "Alert me about this line": its status pushes on or off, separately
   * from the pin (`PUT /preferences/pinned-lines/{id}/alerts`). A failed
   * save puts the switch back. */
  async function changeAlerts(next: boolean) {
    setAlerts(next);
    setAlertsBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/preferences/pinned-lines/${encodeURIComponent(id)}/alerts`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notify: next }),
      });
      if (!response.ok) {
        setAlerts(!next);
        setError(describeFailure('save', 'this setting', response.status));
      }
    } catch {
      setAlerts(!next);
      setError(describeFailure('save', 'this setting'));
    } finally {
      setAlertsBusy(false);
    }
  }

  // States both the action and the current state, per accessibility
  // review, so a screen reader user can tell pinned from unpinned without
  // relying on the icon fill (which they can't see). A pinned line implies
  // an account already exists, so the account hint only ever applies to
  // the unpinned wording.
  const label = pinned
    ? `Unpin ${name}, currently pinned`
    : needsAccountHint
      ? `Pin ${name}, needs an account`
      : `Pin ${name}, currently not pinned`;

  return (
    <Group gap={4} wrap="nowrap">
      <LazyTooltip label={label}>
        <ActionIcon
          variant={pinned ? 'filled' : 'outline'}
          // Distinct hues (not just filled vs. outline of the same yellow)
          // so pinned/unpinned don't rely on icon fill alone.
          color={pinned ? 'yellow' : 'gray'}
          onClick={toggle}
          // `aria-disabled` and `data-disabled`, not `disabled`: a disabled
          // button drops keyboard focus to the page, so the login prompt
          // this press opens would have nowhere to give focus back to when
          // it closes (e2e/keyboard-focus.spec.ts).
          {...(busy && { 'aria-disabled': true, 'data-disabled': true })}
          aria-label={label}
          // 44px, not Mantine's default `md` (28px): review §2.10 calls this
          // out by name as one of "the two actions a returning user taps
          // most" (alongside `ShareButton`), so it gets the 44px
          // primary-action floor rather than the general 24px one. A bare
          // number sets `--ai-size` directly rather than picking a named
          // preset (`ActionIcon.css`), which only resizes the button box --
          // `StarIcon` below stays a fixed 16x16 SVG regardless, so the
          // glyph itself is unchanged.
          size={tokens.iconButton.pageAction}
        >
          <StarIcon filled={pinned} />
        </ActionIcon>
      </LazyTooltip>
      {pinned && alerts !== null && (
        <Switch
          size="xs"
          label="Alert me about this line"
          checked={alerts}
          disabled={alertsBusy}
          onChange={(event) => void changeAlerts(event.currentTarget.checked)}
        />
      )}
      {error && (
        <Text size="xs" c="var(--ds-color-error-text)" role="alert">
          {error}
        </Text>
      )}
      {loginPromptMounted && (
        <LoginPromptModal opened={needsLoginState.needsLogin} onClose={needsLoginState.reset}>
          Log in to pin this {kind}.
        </LoginPromptModal>
      )}
    </Group>
  );
}
