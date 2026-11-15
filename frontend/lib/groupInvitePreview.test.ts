import { describe, expect, it } from 'vitest';
import {
  groupInviteDescription,
  groupInvitePreviewCard,
  groupInvitePreviewImage,
  groupInviteTitle,
  memberCountLabel,
} from './groupInvitePreview';

describe('group invite preview', () => {
  it('counts members in the singular and plural', () => {
    expect(memberCountLabel(1)).toBe('1 member');
    expect(memberCountLabel(3)).toBe('3 members');
  });

  it('titles and describes the invite by group name and member count', () => {
    const preview = { groupName: 'Family', memberCount: 3 };
    expect(groupInviteTitle(preview)).toBe('Join Family');
    expect(groupInviteDescription(preview)).toBe(
      '3 members already in Family. Follow this link to join and share tracked trains with the group.',
    );
  });

  it('draws a neutral band with the member count and nothing else of the group', () => {
    const card = groupInvitePreviewCard({ groupName: 'Family', memberCount: 1, groupId: 'grp-secret' } as never);
    expect(card).toEqual({
      band: { tone: 'informational', label: 'Group invite', aside: '1 member' },
      title: 'Join Family',
      lead: 'Join to share tracked trains with the group',
      chips: { names: [], more: 0 },
      rows: ['Your other tracked trains and tickets stay private'],
    });
    expect(JSON.stringify(card)).not.toContain('grp-secret');
  });

  it('lists the card route, versioned by the card and encoding the token', () => {
    const card = groupInvitePreviewCard({ groupName: 'Family', memberCount: 3 });
    const image = groupInvitePreviewImage('tok-_1', card, 'alt');
    expect(image.url).toMatch(/^\/groups\/join\/tok-_1\/card\.png\?v=[0-9a-f]{8}$/);
    const bigger = groupInvitePreviewCard({ groupName: 'Family', memberCount: 4 });
    expect(groupInvitePreviewImage('tok-_1', bigger, 'alt').url).not.toBe(image.url);
  });
});
