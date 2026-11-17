'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ConfirmActionButton } from './ConfirmActionButton';
import { readApiError } from '@/lib/apiError';
import { deleteGroup } from '@/lib/groupDelete';

/** The error line shown when the api refused a leave because the caller
 * turned out to be the only member after all. */
const ONLY_MEMBER_NOTE = "You're the only member, so you can't leave without deleting this group.";

/** Self-removal, always allowed for any member (spec §3) -- unlike
 * `RemoveMemberButton`, this targets the CURRENT user's own member id, so it
 * needs no `admin`/`owner` gating at the call site: the page renders this
 * for every member's own row unconditionally. On success, navigates back
 * to `/groups` (there's no reason to stay on a group's own detail page
 * once you've left it) -- same "navigate away from a now-gone-to-you
 * resource" reasoning as `DeleteTrainButton`'s own redirect.
 *
 * `willDeleteGroup` should be `true` when the caller is the sole owner of
 * an otherwise-empty group. The api never deletes a group as a side effect
 * of leaving (`409 owner_must_delete`), so in that case this asks "Delete
 * this group?" instead and sends `DELETE /groups/{id}`: leaving a group you
 * alone own IS deleting it, and the dialog says so. If the client guessed
 * wrong (`willDeleteGroup` false, but the api answers `owner_must_delete`
 * because the other members left meanwhile), the dialog turns into the same
 * deletion prompt, with a note saying why, and deletes nothing until the
 * owner confirms that.
 *
 * `nextOwnerLabel` (review §3.2.1, design decision) names who inherits
 * ownership when the caller is an owner leaving a group that ISN'T sole
 * (`willDeleteGroup` false): `remove_member`'s owner branch
 * (`crates/api/src/data/groups.rs`) always transfers ownership to the
 * longest-standing remaining admin, or failing that the longest-standing
 * remaining member, rather than leaving the group ownerless. That transfer
 * is the one consequence of leaving a departing owner would not otherwise
 * guess -- every other member just sees the group carry on -- so it gets
 * its own explicit sentence rather than being folded silently into the
 * generic "you'll lose access" copy every other leaving member sees. `null`
 * (the default) renders the generic copy unchanged, which covers every
 * non-owner caller and the sole-owner case above. */
export function LeaveGroupButton({
  groupId,
  memberId,
  willDeleteGroup = false,
  nextOwnerLabel = null,
}: {
  groupId: string;
  memberId: string;
  willDeleteGroup?: boolean;
  nextOwnerLabel?: string | null;
}) {
  const router = useRouter();
  const [refused, setRefused] = useState(false);
  const soleOwner = willDeleteGroup || refused;

  if (soleOwner) {
    return (
      <ConfirmActionButton
        label="Leave group"
        confirmLabel="Delete group"
        actionName="delete group"
        title="Delete this group?"
        // The owner is shown as the only member (1): if anyone has joined
        // since, the api deletes nothing and the page refreshes (`lib/groupDelete.ts`).
        request={() => deleteGroup(groupId, 1, () => router.refresh())}
        failure={['delete', 'this group']}
        loginPrompt="Log in to delete this group"
        onSuccess={(router) => router.push('/groups')}
      >
        You&apos;re the only member, so leaving would delete this group. Everything shared in it stops being shared and
        its invite link stops working. Your own trains, journeys and custom lines are kept. This can&apos;t be undone.
      </ConfirmActionButton>
    );
  }

  return (
    <ConfirmActionButton
      label="Leave group"
      confirmLabel="Leave"
      actionName="leave group"
      title="Leave this group?"
      request={async () => {
        const response = await fetch(`/api/groups/${groupId}/members/${memberId}`, { method: 'DELETE' });
        if (response.status === 409 && (await readApiError(response.clone())).code === 'owner_must_delete') {
          // The dialog turns into the deletion prompt; this is its error line.
          setRefused(true);
          return new Response(ONLY_MEMBER_NOTE, { status: 409 });
        }
        return response;
      }}
      failure={['leave', 'this group']}
      loginPrompt="Log in to leave this group"
      onSuccess={(router) => router.push('/groups')}
    >
      {`You'll lose access to every train shared in this group, and any trains you've shared into it will be removed for everyone else too.${nextOwnerLabel ? ` ${nextOwnerLabel} will become the new owner.` : ''}`}
    </ConfirmActionButton>
  );
}
