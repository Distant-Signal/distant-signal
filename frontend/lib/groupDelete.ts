import { numericExtra, parseApiError } from './apiError';

/** `DELETE /api/groups/{id}` with the member count the visitor was shown
 * (`expectedMemberCount`, DS-534). The api refuses a delete whose count is
 * stale with `409` `group_changed` (someone joined or left since the page
 * was opened) and deletes nothing. That refusal is not a failure of the
 * request: it asks the visitor to look again, so it is reworded here
 * (not as "Couldn't ...") and `onChanged` refreshes the page's data.
 * Every other response is returned untouched. */
export async function deleteGroup(
  groupId: string,
  expectedMemberCount: number,
  onChanged: () => void,
): Promise<Response> {
  const response = await fetch(`/api/groups/${groupId}?expectedMemberCount=${expectedMemberCount}`, {
    method: 'DELETE',
  });
  if (response.status !== 409) return response;
  const changed = parseGroupChanged(await response.clone().text());
  if (!changed) return response;
  onChanged();
  return new Response(groupChangedMessage(changed.memberCount), { status: 409 });
}

/** The parsed `group_changed` body, or null when `body` is anything else. */
function parseGroupChanged(body: string): { memberCount: number | null } | null {
  const error = parseApiError(409, body);
  if (error.code !== 'group_changed') return null;
  const count = numericExtra(error, 'memberCount');
  return { memberCount: count !== null && Number.isInteger(count) ? count : null };
}

/** What the dialog says after a `group_changed` refusal. */
export function groupChangedMessage(memberCount: number | null): string {
  const now =
    memberCount === null ? '' : ` The group now has ${memberCount} ${memberCount === 1 ? 'member' : 'members'}.`;
  return `People have joined or left since you opened this page.${now} Check who is in the group, then try again.`;
}
