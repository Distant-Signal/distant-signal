import { livePreviewImage, previewDigest, type StatusPreviewCard } from './livePreview';
import type { PreviewImage } from './pageMetadata';
import type { GroupJoinPreview } from './types';

/** The link preview of a group invite (`/groups/join/{token}`): the title,
 * description and card. Pure: the group's name and member count, which
 * `GET /public/groups/join/{token}` returns to anyone holding the link and
 * the page shows them. No member names, no group id, no token text. */

type InviteFacts = Pick<GroupJoinPreview, 'groupName' | 'memberCount'>;

/** "1 member", "3 members". */
export function memberCountLabel(count: number): string {
  return `${count} member${count === 1 ? '' : 's'}`;
}

export function groupInviteTitle(preview: Pick<GroupJoinPreview, 'groupName'>): string {
  return `Join ${preview.groupName}`;
}

export function groupInviteDescription(preview: InviteFacts): string {
  return `${memberCountLabel(preview.memberCount)} already in ${preview.groupName}. Follow this link to join and share tracked trains with the group.`;
}

/** The invite's card (`renderStatusPreviewImage`): a neutral band (an
 * invite has no severity), the title, and what joining does. */
export function groupInvitePreviewCard(preview: InviteFacts): StatusPreviewCard {
  return {
    band: { tone: 'informational', label: 'Group invite', aside: memberCountLabel(preview.memberCount) },
    title: groupInviteTitle(preview),
    lead: 'Join to share tracked trains with the group',
    chips: { names: [], more: 0 },
    rows: ['Your other tracked trains and tickets stay private'],
  };
}

/** The card's listing in the page's metadata, versioned by what it shows. */
export function groupInvitePreviewImage(token: string, card: StatusPreviewCard, alt: string): PreviewImage {
  return livePreviewImage(`/groups/join/${encodeURIComponent(token)}/card.png`, previewDigest(card), alt);
}
