import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor, within, cleanup } from '@testing-library/react';
import { renderWithMantine } from '@/test/render';
import { expectShrinkGuarded } from '@/test/shrinkGuard';
import GroupDetailPage, { generateMetadata } from './page';
import {
  getGroup,
  getGroupCustomLines,
  getGroupJourneys,
  getGroupMembers,
  getGroupTrains,
  getLineStatus,
  ApiNotFoundError,
  ApiUnauthorizedError,
} from '@/lib/api';
import type { GroupCustomLine, GroupJourney, GroupMember, GroupRole, GroupTrain, LineStatusReport } from '@/lib/types';
import { GROUP_JOURNEY_DEFAULTS, GROUP_TRAIN_DEFAULTS, testPublicId } from '@/test/apiDefaults';

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return {
    ...actual,
    getGroup: vi.fn(),
    getGroupCustomLines: vi.fn(),
    getGroupJourneys: vi.fn(),
    getGroupMembers: vi.fn(),
    getGroupTrains: vi.fn(),
    getLineStatus: vi.fn(),
  };
});

// Every test that gets past the group fetch renders the shared-custom-lines
// and shared-journeys sections, so their defaults need to be set here too;
// individual tests below override what they care about.
beforeEach(() => {
  vi.mocked(getGroupCustomLines).mockResolvedValue([]);
  vi.mocked(getLineStatus).mockResolvedValue([]);
  vi.mocked(getGroupJourneys).mockResolvedValue([]);
  // Rows from a past London day read as finished; pin "today" to the
  // fixtures' own service date so they stay active.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-11T12:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => '/groups/grp-1',
  useSearchParams: () => new URLSearchParams(''),
}));

// `getSiteOrigin()` (lib/siteOrigin.ts), called unconditionally by this
// page to build GroupInviteLinkCard's `origin` prop, reads `next/headers`
// when `NEXT_PUBLIC_SITE_URL` isn't set -- there is no Next request
// context in a unit test. Same stub shape lib/api.test.ts's own
// `next/headers` mock uses, extended with the `.get()` `getSiteOrigin`
// needs.
vi.mock('next/headers', () => ({
  headers: async () => ({ get: () => null }),
}));

describe('GroupDetailPage generateMetadata (DS-534)', () => {
  const meta = (id: string) => generateMetadata({ params: Promise.resolve({ id }) });

  it("titles the tab with the group's name, with no link-preview cards", async () => {
    vi.mocked(getGroup).mockResolvedValue({
      id: 'grp-1',
      name: 'Family',
      ownerId: null,
      ownerMemberId: 'member-1',
      memberId: 'member-1',
      ownerName: 'Alex',
      ownerTag: null,
      memberCount: 2,
      role: 'owner',
      inviteLink: null,
    });
    const result = await meta('grp-1');
    expect(result).toMatchObject({ title: 'Family', robots: { index: false } });
    expect(result.openGraph).toBeUndefined();
  });

  it.each([
    ['signed out', new ApiUnauthorizedError('401')],
    ['not a member', new ApiNotFoundError('404')],
    ['an outage', new Error('boom')],
  ])('keeps the generic title when the read fails (%s)', async (_why, error) => {
    vi.mocked(getGroup).mockRejectedValue(error);
    expect(await meta('grp-1')).toEqual({ title: 'Group', robots: { index: false } });
  });

  it('keeps the generic title for a malformed id without calling getGroup', async () => {
    vi.mocked(getGroup).mockClear();
    expect(await meta('../secret')).toEqual({ title: 'Group', robots: { index: false } });
    expect(getGroup).not.toHaveBeenCalled();
  });
});

describe('GroupDetailPage', () => {
  it('shows a not-found message on ApiNotFoundError', async () => {
    vi.mocked(getGroup).mockRejectedValue(new ApiNotFoundError('404'));
    renderWithMantine(await GroupDetailPage({ params: Promise.resolve({ id: 'grp-missing' }) }));
    expect(await screen.findByText('Group not found')).toBeInTheDocument();
  });

  // Finding 3 of the 2026-09-24 security review: a malformed id (a `../`
  // segment, an embedded `?`/`#`) used to reach `getGroup` -- which
  // forwards the ambient session cookie -- completely unvalidated. This id
  // shape check must reject it before `getGroup` is ever called at all.
  it('shows the same not-found message for a malformed id, without ever calling getGroup', async () => {
    // `getGroup` isn't reset by the shared `beforeEach` above (only its
    // resolved/rejected value is set per test), so its call count carries
    // over from earlier tests in this file -- clear it here so this
    // assertion is about THIS test's render, not the whole file's history.
    vi.mocked(getGroup).mockClear();
    renderWithMantine(await GroupDetailPage({ params: Promise.resolve({ id: '../secret' }) }));
    expect(await screen.findByText('Group not found')).toBeInTheDocument();
    expect(getGroup).not.toHaveBeenCalled();
  });

  it('accepts a real-shaped base64url group id (regression: valid ids must still work)', async () => {
    vi.mocked(getGroup).mockRejectedValue(new ApiNotFoundError('404'));
    const realShapedId = 'AbCd12_-34EfGh56IjKl78MnOp90QrSt12UvWx34Yz';
    await GroupDetailPage({ params: Promise.resolve({ id: realShapedId }) });
    expect(getGroup).toHaveBeenCalledWith(realShapedId);
  });

  it('renders the group name, members, and shared trains', async () => {
    vi.mocked(getGroup).mockResolvedValue({
      id: 'grp-1',
      name: 'Family',
      ownerId: null,
      ownerMemberId: 'member-1',
      memberId: 'member-1',
      ownerName: 'Alex',
      ownerTag: null,
      memberCount: 2,
      role: 'owner',
      inviteLink: { token: 'tok', expiresAt: '2026-09-18T00:00:00Z' },
    });
    vi.mocked(getGroupMembers).mockResolvedValue([
      {
        userId: null,
        memberId: 'member-1',
        isMe: false,
        displayName: 'Alex',
        displayTag: null,
        role: 'owner',
        joinedAt: '2026-09-01T00:00:00Z',
      },
      {
        userId: null,
        memberId: 'member-2',
        isMe: false,
        displayName: 'Sam',
        displayTag: null,
        role: 'member',
        joinedAt: '2026-09-02T00:00:00Z',
      },
    ]);
    vi.mocked(getGroupTrains).mockResolvedValue([
      {
        ...GROUP_TRAIN_DEFAULTS,
        trainSubscriptionId: 42,
        pinOriginCrs: 'WOK',
        pinDestinationCrs: 'WAT',
        pinOriginName: 'Woking',
        pinDestinationName: 'London Waterloo',
        pinScheduledDeparture: '2026-09-11T08:00:00Z',
        serviceDate: '2026-09-11',
        resolutionStatus: 'resolved',
        trainUid: 'A12345',
        status: 'en_route',
        delayMinutes: 5,
        customName: null,
        addedBy: null,
        addedByMemberId: 'member-2',
        addedByIsMe: false,
        addedByName: 'Sam',
        addedByTag: null,
      },
    ]);

    renderWithMantine(await GroupDetailPage({ params: Promise.resolve({ id: 'grp-1' }) }));

    expect(screen.getByRole('heading', { name: 'Family' })).toBeInTheDocument();
    expect(screen.getByText('Alex')).toBeInTheDocument();
    expect(screen.getByText('Sam')).toBeInTheDocument();
    expect(screen.getByText(/Shared by Sam/)).toBeInTheDocument();
    // This card renders through the Track list's `TrackedRowStatusBadge`:
    // the delay badge alone, as on the owner's own row -- and the raw
    // `status` enum token ("en_route") must never appear in the subtitle.
    expect(screen.queryByText('En route')).not.toBeInTheDocument();
    expect(screen.getByText('5 min late')).toBeInTheDocument();
    expect(screen.queryByText('en_route')).not.toBeInTheDocument();
  });

  it('links a shared Iarnród Éireann train to its page, named by its boards', async () => {
    vi.mocked(getGroup).mockResolvedValue({
      id: 'grp-1',
      name: 'Family',
      ownerId: null,
      ownerMemberId: 'member-1',
      memberId: 'member-1',
      ownerName: 'Alex',
      ownerTag: null,
      memberCount: 2,
      role: 'member',
      inviteLink: null,
    });
    vi.mocked(getGroupMembers).mockResolvedValue([]);
    vi.mocked(getGroupTrains).mockResolvedValue([
      {
        ...GROUP_TRAIN_DEFAULTS,
        trainSubscriptionId: 42,
        pinOriginCrs: null,
        pinDestinationCrs: null,
        pinOriginName: 'Dublin Connolly',
        pinDestinationName: 'Belfast',
        pinScheduledDeparture: '2026-11-05T15:50:00Z',
        serviceDate: '2026-11-05',
        resolutionStatus: 'resolved',
        trainUid: 'ie:A120',
        status: 'en_route',
        delayMinutes: 2,
        customName: null,
        addedBy: null,
        addedByMemberId: 'member-2',
        addedByIsMe: false,
        addedByName: 'Sam',
        addedByTag: null,
        irishTrain: { trainCode: 'A120', serviceDate: '2026-11-05' },
      },
    ]);

    renderWithMantine(await GroupDetailPage({ params: Promise.resolve({ id: 'grp-1' }) }));

    const link = screen.getByRole('link', { name: /Dublin Connolly to Belfast/ });
    expect(link.getAttribute('href')).toBe('/island-of-ireland/iarnrod-eireann/trains/A120/2026-11-05');
    expect(screen.queryByText(/ie:A120/)).not.toBeInTheDocument();
  });

  it("a shared train's badge uses the owner's tracking phase and mode", async () => {
    vi.mocked(getGroup).mockResolvedValue({
      id: 'grp-1',
      name: 'Family',
      ownerId: null,
      ownerMemberId: 'member-1',
      memberId: 'member-1',
      ownerName: 'Alex',
      ownerTag: null,
      memberCount: 2,
      role: 'member',
      inviteLink: null,
    });
    vi.mocked(getGroupMembers).mockResolvedValue([]);
    const shared = {
      ...GROUP_TRAIN_DEFAULTS,
      pinOriginCrs: 'WOK',
      pinDestinationCrs: 'WAT',
      pinOriginName: 'Woking',
      pinDestinationName: 'London Waterloo',
      pinScheduledDeparture: '2026-09-11T08:00:00Z',
      serviceDate: '2026-09-11',
      resolutionStatus: 'schedule_matched',
      status: null,
      delayMinutes: null,
      customName: null,
      addedBy: null,
      addedByMemberId: 'member-2',
      addedByIsMe: false,
      addedByName: 'Sam',
      addedByTag: null,
    } satisfies Partial<GroupTrain>;
    vi.mocked(getGroupTrains).mockResolvedValue([
      { ...shared, trainSubscriptionId: 1, trainUid: 'P00001', trackingPhase: 'planned' },
      {
        ...shared,
        trainSubscriptionId: 2,
        trainUid: 'P00002',
        resolutionStatus: 'pending',
        trackingPhase: 'noTimetable',
      },
      {
        ...shared,
        trainSubscriptionId: 3,
        trainUid: 'B00001',
        trackingPhase: 'timetableOnly',
        serviceMode: 'bus',
        liveTracking: false,
      },
    ]);

    renderWithMantine(await GroupDetailPage({ params: Promise.resolve({ id: 'grp-1' }) }));

    expect(screen.getByText('Planned')).toBeInTheDocument();
    expect(screen.getByText('Not in the timetable')).toBeInTheDocument();
    expect(screen.getByText('Bus service')).toBeInTheDocument();
    expect(screen.getByText('Timetabled only')).toBeInTheDocument();
    expect(screen.queryByText('Pending match')).not.toBeInTheDocument();
    expect(screen.queryByText('Matched to schedule')).not.toBeInTheDocument();
  });

  /** A member whose identity provider has no name on file for them used to
   * arrive here as a BLANK `displayName`/`addedByName`, not a null one
   * (Authentik and friends send `"name": ""` rather than omitting the
   * claim, and the backend stored/served exactly what it was sent).
   * `?? 'A member'` never fires for `''`, so both of these rendered as an
   * empty gap where the name should be -- the member row showed only a
   * role badge, and the attribution line read "Shared by " with nothing
   * after it.
   *
   * The backend now normalizes blanks to `null` on both write and read, so
   * these two guards are for rows written before it did (and for any other
   * future producer of a blank) -- worth keeping precisely because the
   * failure mode is silent: a blank label looks like a layout bug, not a
   * missing value. */
  it('falls back to a placeholder when a display name is blank rather than null', async () => {
    vi.mocked(getGroup).mockResolvedValue({
      id: 'grp-1',
      name: 'Family',
      ownerId: null,
      ownerMemberId: 'member-1',
      memberId: 'member-1',
      ownerName: 'Alex',
      ownerTag: null,
      memberCount: 2,
      role: 'member',
      inviteLink: null,
    });
    vi.mocked(getGroupMembers).mockResolvedValue([
      {
        userId: null,
        memberId: 'member-1',
        isMe: false,
        displayName: 'Alex',
        displayTag: null,
        role: 'owner',
        joinedAt: '2026-09-01T00:00:00Z',
      },
      {
        userId: null,
        memberId: 'member-2',
        isMe: false,
        displayName: '   ',
        displayTag: null,
        role: 'member',
        joinedAt: '2026-09-02T00:00:00Z',
      },
    ]);
    vi.mocked(getGroupTrains).mockResolvedValue([
      {
        ...GROUP_TRAIN_DEFAULTS,
        trainSubscriptionId: 42,
        pinOriginCrs: 'WOK',
        pinDestinationCrs: 'WAT',
        pinOriginName: 'Woking',
        pinDestinationName: 'London Waterloo',
        pinScheduledDeparture: '2026-09-11T08:00:00Z',
        serviceDate: '2026-09-11',
        resolutionStatus: 'resolved',
        trainUid: 'A12345',
        status: null,
        delayMinutes: null,
        customName: null,
        addedBy: null,
        addedByMemberId: 'member-2',
        addedByIsMe: false,
        addedByName: '',
        addedByTag: null,
      },
    ]);

    renderWithMantine(await GroupDetailPage({ params: Promise.resolve({ id: 'grp-1' }) }));

    expect(screen.getByText('A member')).toBeInTheDocument();
    expect(screen.getByText(/Shared by a member/)).toBeInTheDocument();
  });

  /** The Entra-ID case. `preferred_username` there IS the user's
   * email-shaped UPN, so the backend declines to name ANY member of the
   * group (it never shows an address) and every row used to read as the
   * identical "A member" -- an admin looking at this list had no way to
   * tell which row was whom, or which of them shared the train below.
   * `displayTag` is what separates them, and the sharer's tag matches
   * their own row in the member list so the two can be read together. */
  it('tells placeholder-rendered members apart by their display tag', async () => {
    vi.mocked(getGroup).mockResolvedValue({
      id: 'grp-1',
      name: 'Family',
      ownerId: null,
      ownerMemberId: 'member-1',
      memberId: 'member-1',
      ownerName: null,
      ownerTag: 'a1b2c3',
      memberCount: 3,
      role: 'owner',
      inviteLink: null,
    });
    vi.mocked(getGroupMembers).mockResolvedValue([
      {
        userId: null,
        memberId: 'member-1',
        isMe: false,
        displayName: null,
        displayTag: 'a1b2c3',
        role: 'owner',
        joinedAt: '2026-09-01T00:00:00Z',
      },
      {
        userId: null,
        memberId: 'member-2',
        isMe: false,
        displayName: null,
        displayTag: 'd4e5f6',
        role: 'member',
        joinedAt: '2026-09-02T00:00:00Z',
      },
      {
        userId: null,
        memberId: 'member-3',
        isMe: false,
        displayName: 'Ada Rider',
        displayTag: null,
        role: 'member',
        joinedAt: '2026-09-03T00:00:00Z',
      },
    ]);
    vi.mocked(getGroupTrains).mockResolvedValue([
      {
        ...GROUP_TRAIN_DEFAULTS,
        trainSubscriptionId: 42,
        pinOriginCrs: 'WOK',
        pinDestinationCrs: 'WAT',
        pinOriginName: 'Woking',
        pinDestinationName: 'London Waterloo',
        pinScheduledDeparture: '2026-09-11T08:00:00Z',
        serviceDate: '2026-09-11',
        resolutionStatus: 'resolved',
        trainUid: 'A12345',
        status: null,
        delayMinutes: null,
        customName: null,
        addedBy: null,
        addedByMemberId: 'member-2',
        addedByIsMe: false,
        addedByName: null,
        addedByTag: 'd4e5f6',
      },
    ]);

    renderWithMantine(await GroupDetailPage({ params: Promise.resolve({ id: 'grp-1' }) }));

    expect(screen.getByText('A member (#a1b2c3)')).toBeInTheDocument();
    expect(screen.getByText('A member (#d4e5f6)')).toBeInTheDocument();
    // The member this app CAN name is untouched -- no suffix on a real name.
    expect(screen.getByText('Ada Rider')).toBeInTheDocument();
    // ...and the credit on the shared train points at the second member's
    // row rather than at an anonymous everyone.
    expect(screen.getByText(/Shared by a member \(#d4e5f6\)/)).toBeInTheDocument();
    expect(screen.queryByText('A member')).not.toBeInTheDocument();
  });

  // The browser's own Back button fails outright for a visitor who followed
  // a deep link straight to a group's detail page, so the page links back.
  it('links back to /groups above the page heading', async () => {
    vi.mocked(getGroup).mockResolvedValue({
      id: 'grp-1',
      name: 'Family',
      ownerId: null,
      ownerMemberId: 'member-1',
      memberId: 'member-1',
      ownerName: 'Alex',
      ownerTag: null,
      memberCount: 1,
      role: 'owner',
      inviteLink: null,
    });
    vi.mocked(getGroupMembers).mockResolvedValue([
      {
        userId: null,
        memberId: 'member-1',
        isMe: false,
        displayName: 'Alex',
        displayTag: null,
        role: 'owner',
        joinedAt: '2026-09-01T00:00:00Z',
      },
    ]);
    vi.mocked(getGroupTrains).mockResolvedValue([]);

    renderWithMantine(await GroupDetailPage({ params: Promise.resolve({ id: 'grp-1' }) }));
    // The arrow is decorative and aria-hidden: the name is just "Groups".
    const back = screen.getByRole('link', { name: 'Back to groups' });
    expect(back).toHaveAttribute('href', '/groups');
    expect(back).not.toHaveTextContent('←');
  });

  // The viewer's own row needs a marker: it is awkward to spot even with a
  // real name, and ambiguous for a placeholder-rendered member matching
  // their own opaque tag against the list.
  it('marks the current user\'s own row with "(you)" and no other row', async () => {
    vi.mocked(getGroup).mockResolvedValue({
      id: 'grp-1',
      name: 'Family',
      ownerId: null,
      ownerMemberId: 'member-1',
      memberId: 'member-1',
      ownerName: 'Alex',
      ownerTag: null,
      memberCount: 2,
      role: 'owner',
      inviteLink: null,
    });
    vi.mocked(getGroupMembers).mockResolvedValue([
      {
        userId: 'user-1',
        memberId: 'member-1',
        isMe: true,
        displayName: 'Alex',
        displayTag: null,
        role: 'owner',
        joinedAt: '2026-09-01T00:00:00Z',
      },
      {
        userId: null,
        memberId: 'member-2',
        isMe: false,
        displayName: 'Sam',
        displayTag: null,
        role: 'member',
        joinedAt: '2026-09-02T00:00:00Z',
      },
    ]);
    vi.mocked(getGroupTrains).mockResolvedValue([]);

    renderWithMantine(await GroupDetailPage({ params: Promise.resolve({ id: 'grp-1' }) }));
    expect(screen.getAllByText('(you)')).toHaveLength(1);
    expect(screen.getByText('Alex').parentElement).toContainElement(screen.getByText('(you)'));
  });

  it('never renders a Remove button for the owner row', async () => {
    vi.mocked(getGroup).mockResolvedValue({
      id: 'grp-1',
      name: 'Family',
      ownerId: null,
      ownerMemberId: 'member-1',
      memberId: 'member-1',
      ownerName: 'Alex',
      ownerTag: null,
      memberCount: 1,
      role: 'owner',
      inviteLink: null,
    });
    vi.mocked(getGroupMembers).mockResolvedValue([
      {
        userId: null,
        memberId: 'member-1',
        isMe: false,
        displayName: 'Alex',
        displayTag: null,
        role: 'owner',
        joinedAt: '2026-09-01T00:00:00Z',
      },
    ]);
    vi.mocked(getGroupTrains).mockResolvedValue([]);

    renderWithMantine(await GroupDetailPage({ params: Promise.resolve({ id: 'grp-1' }) }));
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument();
  });

  it('shows a login prompt when the session has lapsed (ApiUnauthorizedError)', async () => {
    vi.mocked(getGroup).mockRejectedValue(new ApiUnauthorizedError('401'));
    renderWithMantine(await GroupDetailPage({ params: Promise.resolve({ id: 'grp-1' }) }));
    expect(await screen.findByRole('link', { name: 'Log in to view this group' })).toBeInTheDocument();
    expect(screen.queryByText('Group not found')).not.toBeInTheDocument();
  });

  /** Role-gating of the controls that the BACKEND gates more narrowly than
   * `canManage` -- each of these would otherwise be a button whose only
   * possible outcome is a 403 (promote, delete group) or a 404 (removing
   * someone else's shared train). */
  describe('role-gated controls', () => {
    const OWNER: GroupMember = {
      userId: null,
      memberId: 'member-owner',
      isMe: false,
      displayName: 'Olive',
      displayTag: null,
      role: 'owner',
      joinedAt: '2026-09-01T00:00:00Z',
    };
    const ADMIN: GroupMember = {
      userId: null,
      memberId: 'member-admin',
      isMe: false,
      displayName: 'Adam',
      displayTag: null,
      role: 'admin',
      joinedAt: '2026-09-02T00:00:00Z',
    };
    const PLAIN: GroupMember = {
      userId: null,
      memberId: 'member-plain',
      isMe: false,
      displayName: 'Priya',
      displayTag: null,
      role: 'member',
      joinedAt: '2026-09-03T00:00:00Z',
    };

    function sharedTrain(sharer: GroupMember, viewer: GroupMember, trainSubscriptionId: number): GroupTrain {
      return {
        ...GROUP_TRAIN_DEFAULTS,
        trainSubscriptionId,
        pinOriginCrs: 'WOK',
        pinDestinationCrs: 'WAT',
        pinOriginName: 'Woking',
        pinDestinationName: 'London Waterloo',
        pinScheduledDeparture: '2026-09-11T08:00:00Z',
        serviceDate: '2026-09-11',
        resolutionStatus: 'resolved',
        trainUid: 'A12345',
        status: 'en_route',
        delayMinutes: null,
        customName: `Train ${trainSubscriptionId}`,
        addedBy: sharer.memberId === viewer.memberId ? 'user-viewer' : null,
        addedByMemberId: sharer.memberId,
        addedByIsMe: sharer.memberId === viewer.memberId,
        addedByName: sharer.displayName,
        addedByTag: null,
      };
    }

    /** The rendered member row for `member`, so a per-row assertion can
     * say WHICH row a control sits on rather than just how many of it the
     * whole page has. `MemberRow` renders
     * `<Group>{<Group><Text>label</Text><Badge/></Group>}{controls}</Group>`,
     * so the row is two levels up from the label's own element. */
    function memberRow(member: GroupMember): HTMLElement {
      const label = screen.getByText(member.displayName as string);
      const row = label.parentElement?.parentElement;
      if (!row) throw new Error(`no rendered row found for ${member.displayName}`);
      return row;
    }

    /** Renders the page as `viewer`, with `viewerRole` as their role on the
     * group -- the two always agree in reality, so they're set together. */
    async function renderAs(viewer: GroupMember, viewerRole: GroupRole, trains: GroupTrain[] = []) {
      vi.mocked(getGroup).mockResolvedValue({
        id: 'grp-1',
        name: 'Family',
        ownerId: viewerRole === 'owner' ? 'user-owner' : null,
        ownerMemberId: OWNER.memberId,
        memberId: viewer.memberId,
        ownerName: OWNER.displayName,
        ownerTag: null,
        memberCount: 3,
        role: viewerRole,
        inviteLink: null,
      });
      vi.mocked(getGroupMembers).mockResolvedValue(
        [OWNER, ADMIN, PLAIN].map((member) => ({ ...member, isMe: member.memberId === viewer.memberId })),
      );
      vi.mocked(getGroupTrains).mockResolvedValue(trains);
      renderWithMantine(await GroupDetailPage({ params: Promise.resolve({ id: 'grp-1' }) }));
    }

    it('an owner viewer sees "Promote to admin" on a plain member row', async () => {
      await renderAs(OWNER, 'owner');
      expect(screen.getByRole('button', { name: 'Promote to admin' })).toBeInTheDocument();
    });

    it('an owner viewer sees "Make owner" on every non-owner row, never on their own, and an admin sees none', async () => {
      await renderAs(OWNER, 'owner');
      expect(within(memberRow(PLAIN)).getByRole('button', { name: 'Make owner' })).toBeInTheDocument();
      expect(within(memberRow(ADMIN)).getByRole('button', { name: 'Make owner' })).toBeInTheDocument();
      expect(within(memberRow(OWNER)).queryByRole('button', { name: 'Make owner' })).not.toBeInTheDocument();
      cleanup();
      await renderAs(ADMIN, 'admin');
      expect(screen.queryByRole('button', { name: 'Make owner' })).not.toBeInTheDocument();
    });

    it('an admin viewer does NOT see "Promote to admin" (the backend is owner-only)', async () => {
      await renderAs(ADMIN, 'admin');
      expect(screen.queryByRole('button', { name: 'Promote to admin' })).not.toBeInTheDocument();
      // ...but the admin still has the controls the backend DOES grant
      // them, so this isn't just "an admin sees nothing".
      expect(screen.getAllByRole('button', { name: 'Remove' }).length).toBeGreaterThan(0);
    });

    it('an owner viewer sees "Demote to member" on the admin row and nowhere else', async () => {
      await renderAs(OWNER, 'owner');
      // Asserted per ROW, not as a count: "exactly one demote button on
      // the page" would still pass if it were rendered against the
      // OWNER's own row instead -- the permanent-owner row the backend
      // 403s, i.e. precisely the "button whose only outcome is a 403"
      // this page's own doc comment exists to prevent.
      expect(within(memberRow(ADMIN)).getByRole('button', { name: 'Demote to member' })).toBeInTheDocument();
      expect(within(memberRow(OWNER)).queryByRole('button', { name: 'Demote to member' })).not.toBeInTheDocument();
      // A plain member has no admin role to lose; they get the opposite
      // control instead, and only that one.
      expect(within(memberRow(PLAIN)).queryByRole('button', { name: 'Demote to member' })).not.toBeInTheDocument();
      expect(within(memberRow(PLAIN)).getByRole('button', { name: 'Promote to admin' })).toBeInTheDocument();
      expect(within(memberRow(ADMIN)).queryByRole('button', { name: 'Promote to admin' })).not.toBeInTheDocument();
    });

    it('an admin viewer does NOT see "Demote to member" (the backend is owner-only)', async () => {
      await renderAs(ADMIN, 'admin');
      expect(screen.queryByRole('button', { name: 'Demote to member' })).not.toBeInTheDocument();
    });

    it('a plain member viewer does NOT see "Demote to member"', async () => {
      await renderAs(PLAIN, 'member');
      expect(screen.queryByRole('button', { name: 'Demote to member' })).not.toBeInTheDocument();
    });

    it('a plain member viewer does NOT see "Remove from group" on someone else\'s shared train', async () => {
      await renderAs(PLAIN, 'member', [sharedTrain(ADMIN, PLAIN, 41)]);
      expect(screen.queryByRole('button', { name: 'Remove from group' })).not.toBeInTheDocument();
    });

    it('a plain member viewer DOES see "Remove from group" on their own shared train', async () => {
      await renderAs(PLAIN, 'member', [sharedTrain(PLAIN, PLAIN, 42)]);
      expect(screen.getByRole('button', { name: 'Remove from group' })).toBeInTheDocument();
    });

    it('an admin viewer sees "Remove from group" on someone else\'s shared train', async () => {
      await renderAs(ADMIN, 'admin', [sharedTrain(PLAIN, ADMIN, 43)]);
      expect(screen.getByRole('button', { name: 'Remove from group' })).toBeInTheDocument();
    });

    // WCAG 2.5.3: the row's `Group wrap="nowrap"` (`StatusRow`)
    // pairs the train's display name with this button -- it must not be
    // crushable by a long name/subtitle.
    it('puts "Remove from group" on its own line, where the title cannot squeeze it', async () => {
      // 2026-10-20: a bus's two badges plus this button left a phone row's
      // title no room at all, so the status and the button moved under the
      // title, out of its `wrap="nowrap"` row.
      await renderAs(ADMIN, 'admin', [sharedTrain(PLAIN, ADMIN, 44)]);
      expect(screen.getByRole('button', { name: 'Remove from group' }).closest('[data-status-row]')).toBeNull();
    });

    it('only an owner sees "Delete group"; an admin and a plain member see "Rename" / neither', async () => {
      await renderAs(OWNER, 'owner');
      expect(screen.getByRole('button', { name: 'Rename' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Delete group' })).toBeInTheDocument();
    });

    it('an admin viewer sees "Rename" but not "Delete group"', async () => {
      await renderAs(ADMIN, 'admin');
      expect(screen.getByRole('button', { name: 'Rename' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Delete group' })).not.toBeInTheDocument();
    });

    it('a plain member viewer sees neither "Rename" nor "Delete group"', async () => {
      await renderAs(PLAIN, 'member');
      expect(screen.queryByRole('button', { name: 'Rename' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Delete group' })).not.toBeInTheDocument();
      // The self-service control every member always has stays put.
      expect(screen.getByRole('button', { name: 'Leave group' })).toBeInTheDocument();
    });

    /** `LeaveGroupButton`'s confirm copy must warn about the WHOLE group
     * being deleted when the viewer is the sole owner (`remove_member`'s
     * sole-owner-leaves branch deletes the group, not just their own
     * membership row) -- and must NOT show that warning otherwise, even for
     * an owner who isn't alone. */
    it('asks the sole owner to delete the group instead of leaving it', async () => {
      vi.mocked(getGroup).mockResolvedValue({
        id: 'grp-1',
        name: 'Family',
        ownerId: 'user-owner',
        ownerMemberId: OWNER.memberId,
        memberId: OWNER.memberId,
        ownerName: OWNER.displayName,
        ownerTag: null,
        memberCount: 1,
        role: 'owner',
        inviteLink: null,
      });
      vi.mocked(getGroupMembers).mockResolvedValue([{ ...OWNER, isMe: true }]);
      vi.mocked(getGroupTrains).mockResolvedValue([]);
      renderWithMantine(await GroupDetailPage({ params: Promise.resolve({ id: 'grp-1' }) }));

      fireEvent.click(screen.getByRole('button', { name: 'Leave group' }));
      await waitFor(() => screen.getByText(/leaving would delete this group/));
    });

    it('does not warn about deleting the group for an owner with other members', async () => {
      await renderAs(OWNER, 'owner');

      fireEvent.click(screen.getByRole('button', { name: 'Leave group' }));
      await waitFor(() => screen.getByText(/lose access to every train shared/));
      expect(screen.queryByText(/leaving would delete this group/)).not.toBeInTheDocument();
    });

    // The owner leaving a group that survives (other members
    // remain) always transfers ownership -- `remove_member`'s own successor
    // query picks the longest-standing remaining ADMIN over a longer-standing
    // plain member, so the copy here must name Adam, not Priya, even though
    // Priya joined first.
    it('names the longest-standing admin as the successor when the owner leaves', async () => {
      await renderAs(OWNER, 'owner');

      fireEvent.click(screen.getByRole('button', { name: 'Leave group' }));
      await waitFor(() => screen.getByText(/Adam will become the new owner/));
    });

    it('names nobody as successor when the sole owner leaves (the group is deleted instead)', async () => {
      vi.mocked(getGroup).mockResolvedValue({
        id: 'grp-1',
        name: 'Family',
        ownerId: 'user-owner',
        ownerMemberId: OWNER.memberId,
        memberId: OWNER.memberId,
        ownerName: OWNER.displayName,
        ownerTag: null,
        memberCount: 1,
        role: 'owner',
        inviteLink: null,
      });
      vi.mocked(getGroupMembers).mockResolvedValue([{ ...OWNER, isMe: true }]);
      vi.mocked(getGroupTrains).mockResolvedValue([]);
      renderWithMantine(await GroupDetailPage({ params: Promise.resolve({ id: 'grp-1' }) }));

      fireEvent.click(screen.getByRole('button', { name: 'Leave group' }));
      await waitFor(() => screen.getByText(/leaving would delete this group/));
      expect(screen.queryByText(/will become the new owner/)).not.toBeInTheDocument();
    });

    it('names no successor for a non-owner leaving', async () => {
      await renderAs(PLAIN, 'member');

      fireEvent.click(screen.getByRole('button', { name: 'Leave group' }));
      await waitFor(() => screen.getByText(/lose access to every train shared/));
      expect(screen.queryByText(/will become the new owner/)).not.toBeInTheDocument();
    });

    // "Delete group" lives in its own "Danger zone" section at the foot of
    // the page, not in the header.
    it('renders "Delete group" inside a "Danger zone" heading for an owner', async () => {
      await renderAs(OWNER, 'owner');
      expect(screen.getByRole('heading', { name: 'Danger zone' })).toBeInTheDocument();
    });

    it('renders no "Danger zone" section for a non-owner', async () => {
      await renderAs(ADMIN, 'admin');
      expect(screen.queryByRole('heading', { name: 'Danger zone' })).not.toBeInTheDocument();
    });
  });

  describe('shared custom lines', () => {
    const SHARER = 'user-sharer';
    const VIEWER_OWN = (viewerId: string) => viewerId.replace('user-', 'member-');

    function line(overrides: Partial<GroupCustomLine> = {}): GroupCustomLine {
      return {
        lineId: 'custom-my-commute',
        lineName: 'My Commute',
        grantedBy: null,
        grantedByMemberId: 'member-sharer',
        grantedByIsMe: false,
        grantedByName: 'Sam',
        grantedByTag: null,
        ...overrides,
      };
    }

    function report(): LineStatusReport {
      return {
        $type: 'DistantSignal.LineStatusReport',
        attribution: [],
        id: 'custom-my-commute',
        name: 'My Commute',
        modeName: 'national-rail',
        operators: ['SW'],
        computedAt: '2026-09-15T09:00:00Z',
        lineStatuses: [
          {
            statusSeverity: 6,
            statusSeverityDescription: 'Severe Delays',
            reason: 'signalling',
            sampleAvailability: { state: 'no-coverage' },
          } as never,
        ],
      };
    }

    async function renderAsViewer(viewerId: string, role: GroupRole) {
      vi.mocked(getGroup).mockResolvedValue({
        id: 'grp-1',
        name: 'Family',
        ownerId: role === 'owner' ? 'user-owner' : null,
        ownerMemberId: 'member-owner',
        memberId: VIEWER_OWN(viewerId),
        ownerName: 'Alex',
        ownerTag: null,
        memberCount: 3,
        role,
        inviteLink: null,
      });
      vi.mocked(getGroupMembers).mockResolvedValue([]);
      vi.mocked(getGroupTrains).mockResolvedValue([]);
      const lines = await getGroupCustomLines('grp-1');
      vi.mocked(getGroupCustomLines).mockResolvedValue(
        lines.map((l) => ({ ...l, grantedByIsMe: l.grantedByMemberId === VIEWER_OWN(viewerId) })),
      );
      renderWithMantine(await GroupDetailPage({ params: Promise.resolve({ id: 'grp-1' }) }));
    }

    it('renders an empty state when nothing has been shared', async () => {
      await renderAsViewer('user-owner', 'owner');
      expect(screen.getByText('No custom lines have been shared into this group yet.')).toBeInTheDocument();
    });

    it('renders a shared line with its attribution, status badge and link out', async () => {
      vi.mocked(getGroupCustomLines).mockResolvedValue([line()]);
      vi.mocked(getLineStatus).mockResolvedValue([report()]);
      await renderAsViewer('user-other', 'member');

      expect(screen.getByRole('heading', { name: 'Shared custom lines' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'My Commute' })).toHaveAttribute('href', '/lines/custom-my-commute');
      expect(screen.getByText('Shared by Sam')).toBeInTheDocument();
      expect(screen.getByText('Severe delays')).toBeInTheDocument();
    });

    it('still renders the row when no status has been computed for the line yet', async () => {
      vi.mocked(getGroupCustomLines).mockResolvedValue([line()]);
      vi.mocked(getLineStatus).mockRejectedValue(new ApiNotFoundError('no matching line(s)'));
      await renderAsViewer('user-other', 'member');

      expect(screen.getByRole('link', { name: 'My Commute' })).toBeInTheDocument();
    });

    it('a plain member who did not share it sees no "Stop sharing" control', async () => {
      vi.mocked(getGroupCustomLines).mockResolvedValue([line()]);
      await renderAsViewer('user-bystander', 'member');

      expect(screen.queryByRole('button', { name: 'Stop sharing' })).not.toBeInTheDocument();
    });

    it('the member who shared it DOES see "Stop sharing", even as a plain member', async () => {
      vi.mocked(getGroupCustomLines).mockResolvedValue([line()]);
      await renderAsViewer(SHARER, 'member');

      expect(screen.getByRole('button', { name: 'Stop sharing' })).toBeInTheDocument();
    });

    it('an admin sees "Stop sharing" on someone else\'s shared line', async () => {
      vi.mocked(getGroupCustomLines).mockResolvedValue([line()]);
      await renderAsViewer('user-admin', 'admin');

      expect(screen.getByRole('button', { name: 'Stop sharing' })).toBeInTheDocument();
    });

    // WCAG 2.5.3: the row pairs a (potentially long) line name
    // with this status badge and "Stop sharing" button in a `Group
    // wrap="nowrap"` (`StatusRow`) -- without a shrink guard on both,
    // either could be crushed to nothing instead of the title truncating.
    it('gives the status badge and the "Stop sharing" button a shrink guard against a long line name', async () => {
      vi.mocked(getGroupCustomLines).mockResolvedValue([
        line({ lineName: 'An Implausibly Long Custom Line Name Chosen To Threaten The Row Layout' }),
      ]);
      vi.mocked(getLineStatus).mockResolvedValue([report()]);
      await renderAsViewer(SHARER, 'member');

      expectShrinkGuarded(screen.getByText('Severe delays'));
      expectShrinkGuarded(screen.getByRole('button', { name: 'Stop sharing' }));
    });

    it('never offers an Edit or Delete control for a line the viewer does not own', async () => {
      // A grant is read-only: not even a group owner can edit or delete a
      // member's custom line, and this page must never suggest otherwise.
      vi.mocked(getGroupCustomLines).mockResolvedValue([line()]);
      await renderAsViewer('user-owner', 'owner');

      expect(screen.queryByRole('button', { name: /^Edit/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Delete line/i })).not.toBeInTheDocument();
    });
  });

  // No seed data creates a group with an actual shared journey in it, and
  // every test above leaves `getGroupJourneys` at its `beforeEach` default
  // of `[]`, so `SharedJourneyRow` (page.tsx) needs a realistic
  // component-level fixture here, checked for truncation, missing labels
  // and colour-only signals. Mirrors 'shared custom lines' above
  // field-for-field.
  describe('shared journeys', () => {
    const SHARER = 'user-sharer';
    const VIEWER_OWN = (viewerId: string) => viewerId.replace('user-', 'member-');

    function journey(overrides: Partial<GroupJourney> = {}): GroupJourney {
      return {
        ...GROUP_JOURNEY_DEFAULTS,
        journeyId: 501,
        journeyPublicId: testPublicId(501),
        customName: null,
        legCount: 1,
        pinOriginCrs: 'WOK',
        pinDestinationCrs: 'WAT',
        pinOriginName: 'Woking',
        pinDestinationName: 'London Waterloo',
        pinScheduledDeparture: '2026-09-11T08:00:00Z',
        firstOriginCrs: 'WOK',
        firstOriginName: 'Woking',
        lastDestinationCrs: 'WAT',
        lastDestinationName: 'London Waterloo',
        serviceDate: '2026-09-11',
        resolutionStatus: 'resolved',
        trainUid: 'A12345',
        status: 'en_route',
        delayMinutes: 5,
        addedBy: null,
        addedByMemberId: 'member-sharer',
        addedByIsMe: false,
        addedByName: 'Sam',
        addedByTag: null,
        ...overrides,
      };
    }

    async function renderAsViewer(viewerId: string, role: GroupRole) {
      vi.mocked(getGroup).mockResolvedValue({
        id: 'grp-1',
        name: 'Family',
        ownerId: role === 'owner' ? 'user-owner' : null,
        ownerMemberId: 'member-owner',
        memberId: VIEWER_OWN(viewerId),
        ownerName: 'Alex',
        ownerTag: null,
        memberCount: 3,
        role,
        inviteLink: null,
      });
      vi.mocked(getGroupMembers).mockResolvedValue([]);
      vi.mocked(getGroupTrains).mockResolvedValue([]);
      const journeys = await getGroupJourneys('grp-1');
      vi.mocked(getGroupJourneys).mockResolvedValue(
        journeys.map((j) => ({ ...j, addedByIsMe: j.addedByMemberId === VIEWER_OWN(viewerId) })),
      );
      renderWithMantine(await GroupDetailPage({ params: Promise.resolve({ id: 'grp-1' }) }));
    }

    it('renders an empty state when nothing has been shared', async () => {
      await renderAsViewer('user-owner', 'owner');
      expect(screen.getByText('No journeys have been shared into this group yet.')).toBeInTheDocument();
    });

    it('renders a shared journey with its route, attribution, status badge and link out', async () => {
      vi.mocked(getGroupJourneys).mockResolvedValue([journey()]);
      await renderAsViewer('user-other', 'member');

      expect(screen.getByRole('heading', { name: 'Shared journeys' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Woking \(WOK\) to London Waterloo \(WAT\)/ })).toHaveAttribute(
        'href',
        `/journeys/${testPublicId(501)}`,
      );
      expect(screen.getByText('Shared by Sam')).toBeInTheDocument();
      // The Track list's `TrackedRowStatusBadge`: the delay badge alone,
      // and the raw `status` enum token must never leak into the page.
      expect(screen.queryByText('En route')).not.toBeInTheDocument();
      expect(screen.getByText('5 min late')).toBeInTheDocument();
      expect(screen.queryByText('en_route')).not.toBeInTheDocument();
    });

    it('names a journey by the one journey rule: whole route and date, a leg count for several legs', async () => {
      vi.mocked(getGroupJourneys).mockResolvedValue([
        journey({
          journeyId: 501,
          legCount: 1,
          firstOriginCrs: 'WOK',
          firstOriginName: 'Woking',
          lastDestinationCrs: 'WAT',
          lastDestinationName: 'London Waterloo',
        }),
        // First leg unmatched (no pin at all): still named from its legs,
        // ending at the LAST leg's destination.
        journey({
          journeyId: 502,
          journeyPublicId: testPublicId(502),
          legCount: 3,
          pinOriginCrs: null,
          pinDestinationCrs: null,
          pinOriginName: null,
          pinDestinationName: null,
          firstOriginCrs: 'KGX',
          firstOriginName: 'London Kings Cross',
          lastDestinationCrs: 'EDB',
          lastDestinationName: 'Edinburgh',
        }),
        journey({
          journeyId: 503,
          legCount: 2,
          customName: 'Scotland trip',
          firstOriginCrs: 'WOK',
          firstOriginName: null,
          lastDestinationCrs: 'EDB',
          lastDestinationName: null,
        }),
      ]);
      await renderAsViewer('user-other', 'member');

      expect(
        screen.getByRole('link', { name: 'Woking (WOK) to London Waterloo (WAT), 11 Sep 2026' }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: 'London Kings Cross (KGX) to Edinburgh (EDB), 11 Sep 2026' }),
      ).toHaveAttribute('href', `/journeys/${testPublicId(502)}`);
      expect(screen.getByText('3 legs')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Scotland trip' })).toBeInTheDocument();
      expect(screen.getByText('WOK to EDB, 11 Sep 2026 · 2 legs')).toBeInTheDocument();
      expect(screen.queryByText(/more leg/)).not.toBeInTheDocument();
    });

    it('asks the owner for a train, not a red "Unmatched", for a leg with no train picked yet', async () => {
      // `resolutionStatus` is null on the wire when the summarised leg is
      // still an open search. It used to be coalesced to 'unresolved' and
      // read as a red "Unmatched"; the owner's journey list says it needs
      // a train picked.
      vi.mocked(getGroupJourneys).mockResolvedValue([
        journey({ kind: 'train', resolutionStatus: null, status: null, delayMinutes: null, trainUid: null }),
      ]);
      await renderAsViewer(SHARER, 'member');

      expect(screen.getByText('Needs a train picked')).toBeInTheDocument();
      expect(screen.queryByText('Unmatched')).not.toBeInTheDocument();
      expect(screen.queryByText('null')).not.toBeInTheDocument();
    });

    // DS-199's rule, as on the Journeys and home lists: only the owner or a
    // follower can pick the train, so only they are asked to.
    it('a member who does not follow it reads "No train picked yet"; a follower is asked', async () => {
      const open = { kind: 'train' as const, resolutionStatus: null, status: null, delayMinutes: null, trainUid: null };
      vi.mocked(getGroupJourneys).mockResolvedValue([
        journey({ ...open, journeyId: 701, customName: 'Not followed' }),
        journey({ ...open, journeyId: 702, customName: 'Followed', following: true }),
      ]);
      await renderAsViewer('user-other', 'member');

      const card = (name: string) => screen.getByRole('link', { name }).closest('.mantine-Card-root') as HTMLElement;
      expect(within(card('Not followed')).getByText('No train picked yet')).toBeInTheDocument();
      expect(within(card('Not followed')).queryByText('Needs a train picked')).not.toBeInTheDocument();
      expect(within(card('Followed')).getByText('Needs a train picked')).toBeInTheDocument();
    });

    it('a walk-and-Tube journey shows its leg clock state, not "Unmatched"', async () => {
      vi.mocked(getGroupJourneys).mockResolvedValue([
        journey({
          journeyId: 601,
          kind: 'untracked',
          transitMode: 'walk',
          plannedDeparture: '2026-09-11T08:00:00Z',
          plannedArrival: '2026-09-11T08:10:00Z',
          untrackedStatus: 'inProgress',
          resolutionStatus: null,
          status: null,
          delayMinutes: null,
          trainUid: null,
        }),
      ]);
      await renderAsViewer('user-other', 'member');

      expect(screen.getByText('In progress (not live tracked)')).toBeInTheDocument();
      expect(screen.queryByText('Unmatched')).not.toBeInTheDocument();
    });

    it("shows the owner's phase and mode words for a picked train", async () => {
      vi.mocked(getGroupJourneys).mockResolvedValue([
        journey({
          journeyId: 701,
          kind: 'train',
          resolutionStatus: 'schedule_matched',
          status: null,
          delayMinutes: null,
          trackingPhase: 'planned',
          serviceMode: 'train',
          liveTracking: true,
        }),
        journey({
          journeyId: 702,
          kind: 'train',
          resolutionStatus: 'schedule_matched',
          status: null,
          delayMinutes: null,
          trackingPhase: 'timetableOnly',
          serviceMode: 'bus',
          liveTracking: false,
        }),
      ]);
      await renderAsViewer('user-other', 'member');

      expect(screen.getByText('Planned')).toBeInTheDocument();
      expect(screen.getByText('Timetabled only')).toBeInTheDocument();
      expect(screen.queryByText('Matched to schedule')).not.toBeInTheDocument();
    });

    // Same blank-vs-null attribution gap `GroupTrain.addedByName` already
    // has a regression test for above -- a blank string used to render as
    // "Shared by " with nothing after it rather than falling back to the
    // generic placeholder.
    it("falls back to a placeholder when the sharer's display name is blank rather than null", async () => {
      vi.mocked(getGroupJourneys).mockResolvedValue([journey({ addedByName: '' })]);
      await renderAsViewer('user-other', 'member');

      expect(screen.getByText(/Shared by a member/)).toBeInTheDocument();
    });

    // DS-146: any member but its owner can follow a shared journey into
    // their own journeys, and stop.
    it('offers a member "Follow this journey", and "Unfollow" once they follow it', async () => {
      vi.mocked(getGroupJourneys).mockResolvedValue([journey(), journey({ journeyId: 502, following: true })]);
      await renderAsViewer('user-bystander', 'member');

      expect(screen.getAllByRole('button', { name: /^Follow this journey/ })).toHaveLength(1);
      expect(screen.getAllByRole('button', { name: /^Unfollow/ })).toHaveLength(1);
    });

    it('offers its owner no follow', async () => {
      vi.mocked(getGroupJourneys).mockResolvedValue([journey()]);
      await renderAsViewer(SHARER, 'member');

      expect(screen.queryByRole('button', { name: /^Follow this journey/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Unfollow/ })).not.toBeInTheDocument();
    });

    it('a plain member who did not share it sees no "Remove from group" control', async () => {
      vi.mocked(getGroupJourneys).mockResolvedValue([journey()]);
      await renderAsViewer('user-bystander', 'member');

      expect(screen.queryByRole('button', { name: 'Remove from group' })).not.toBeInTheDocument();
    });

    it('the member who shared it DOES see "Remove from group", even as a plain member', async () => {
      vi.mocked(getGroupJourneys).mockResolvedValue([journey()]);
      await renderAsViewer(SHARER, 'member');

      expect(screen.getByRole('button', { name: 'Remove from group' })).toBeInTheDocument();
    });

    it('an admin sees "Remove from group" on someone else\'s shared journey', async () => {
      vi.mocked(getGroupJourneys).mockResolvedValue([journey()]);
      await renderAsViewer('user-admin', 'admin');

      expect(screen.getByRole('button', { name: 'Remove from group' })).toBeInTheDocument();
    });

    // WCAG 2.5.3: a (potentially long) route/custom name must not crush
    // the status badge or "Remove from group". Both sit on their own line
    // under the title rather than in its `Group wrap="nowrap"`
    // (`StatusRow`), where either could be crushed to nothing instead of
    // the title truncating.
    it('keeps the status badge and the "Remove from group" button out of a long custom name\'s row', async () => {
      vi.mocked(getGroupJourneys).mockResolvedValue([
        journey({
          customName: 'An Implausibly Long Journey Name Chosen To Threaten The Row Layout End To End',
        }),
      ]);
      await renderAsViewer(SHARER, 'member');

      // On their own line under the title, as on the shared train rows.
      expect(screen.getByText('5 min late').closest('[data-status-row]')).toBeNull();
      expect(screen.getByRole('button', { name: 'Remove from group' }).closest('[data-status-row]')).toBeNull();
    });
  });
});
