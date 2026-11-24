'use client';

import { ConfirmActionButton } from './ConfirmActionButton';
import { OWNERSHIP_TRANSFERRED_EVENT } from './GroupOwnershipAnnouncer';

/** `owner`-only "Make owner" control on a member's row. It confirms first
 * and says what changes: the member becomes the owner, the viewer stays in
 * the group as a plain member and can leave, and only the new owner can hand
 * it back. On success it tells `GroupOwnershipAnnouncer` (which outlives
 * this control, as the viewer stops being the owner and the row's buttons go
 * away) to announce the change and move focus to the page heading, then
 * refreshes the page. The api's own sentences for a refused transfer
 * (yourself, a group that changed meanwhile) show in the dialog. */
export function TransferOwnershipButton({
  groupId,
  memberId,
  name,
}: {
  groupId: string;
  memberId: string;
  name: string;
}) {
  return (
    <ConfirmActionButton
      label="Make owner"
      actionName="make owner"
      title={`Make ${name} the owner?`}
      tone="neutral"
      request={() =>
        fetch(`/api/groups/${groupId}/transfer-ownership`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ memberId }),
        })
      }
      failure={['transfer', 'ownership']}
      loginPrompt="Log in to transfer ownership"
      onSuccess={(router) => {
        window.dispatchEvent(new CustomEvent(OWNERSHIP_TRANSFERRED_EVENT, { detail: `${name} is now the owner.` }));
        router.refresh();
      }}
    >
      {name} will become the owner of this group. You&apos;ll stay a member and can leave whenever you like. Only {name}{' '}
      can make you the owner again.
    </ConfirmActionButton>
  );
}
