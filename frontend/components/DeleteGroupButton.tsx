'use client';

import { useRouter } from 'next/navigation';
import { ConfirmActionButton } from './ConfirmActionButton';
import { deleteGroup } from '@/lib/groupDelete';

/** `owner`-only "Delete group" control for `DELETE /groups/{id}` (spec §3:
 * "Delete the group entirely | `owner` only" -- the caller renders this
 * only for an owner, and the backend's `require_role(..,
 * GroupRole::is_owner)` refuses everyone else regardless).
 *
 * Mirrors `LeaveGroupButton.tsx`'s confirm-modal shape rather than a
 * bare button: `groups::delete_group`'s `ON DELETE CASCADE` takes the
 * memberships, the shared-train rows, and the invite links with it, for
 * EVERY member -- strictly more destructive than leaving, so it gets at
 * least the same confirmation weight. Navigates to `/groups` on success,
 * the same "navigate away from a now-gone resource" move
 * `DeleteTrainButton`/`LeaveGroupButton` both make; staying on a detail
 * page for a group that no longer exists would just render a 404.
 *
 * `variant="subtle"` rather than the `outline` red `LeaveGroupButton` uses:
 * "leave" only affects the caller while "delete" wipes the group for every
 * member, so the two must not look identical. The caller
 * (`app/groups/[id]/page.tsx`) renders this alone in a "Danger zone" section
 * at the foot of the page. The confirm modal is unchanged and just as hard to
 * trigger by accident.
 *
 * `memberCount` is the count the page showed (`GET /groups/{id}`). It is
 * sent with the delete (`expectedMemberCount`): if someone joined or left
 * since the page was opened, the api deletes nothing (`409 group_changed`),
 * the page refreshes and the dialog asks the owner to look again
 * (`lib/groupDelete.ts`). */
export function DeleteGroupButton({
  groupId,
  name,
  memberCount,
}: {
  groupId: string;
  name: string;
  memberCount: number;
}) {
  const router = useRouter();
  return (
    <ConfirmActionButton
      label="Delete group"
      confirmLabel="Delete"
      actionName="delete group"
      title={`Delete ${name}?`}
      request={() => deleteGroup(groupId, memberCount, () => router.refresh())}
      failure={['delete', 'this group']}
      loginPrompt="Log in to delete this group"
      onSuccess={(router) => router.push('/groups')}
    >
      This deletes the group for everyone. Every member loses access, every train shared into it stops being shared, and
      the invite link stops working. This can&apos;t be undone.
    </ConfirmActionButton>
  );
}
