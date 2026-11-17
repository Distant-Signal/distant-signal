import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithMantine } from '@/test/render';
import { LeaveGroupButton } from './LeaveGroupButton';

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => '/groups/grp-1',
  useSearchParams: () => new URLSearchParams(''),
}));

describe('LeaveGroupButton', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    pushMock.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('DELETEs the current user as a member and navigates to /groups', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    renderWithMantine(<LeaveGroupButton groupId="grp-1" memberId="member-1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Leave group' }));
    await waitFor(() => screen.getByRole('button', { name: 'Confirm leave group' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm leave group' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/groups/grp-1/members/member-1', { method: 'DELETE' });
    });
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/groups'));
  });

  it('shows the generic warning by default', async () => {
    renderWithMantine(<LeaveGroupButton groupId="grp-1" memberId="member-1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Leave group' }));
    await waitFor(() => screen.getByText(/lose access to every train shared/));
    expect(screen.queryByText(/leaving deletes this group/)).not.toBeInTheDocument();
  });

  it('asks "Delete this group?" and deletes the group, not the membership, when willDeleteGroup is set', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    renderWithMantine(<LeaveGroupButton groupId="grp-1" memberId="member-1" willDeleteGroup />);
    fireEvent.click(screen.getByRole('button', { name: 'Leave group' }));
    await waitFor(() => screen.getByText('Delete this group?'));
    expect(screen.getByText(/leaving would delete this group/)).toBeInTheDocument();
    expect(screen.queryByText(/lose access to every train shared/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirm leave group' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete group' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/groups/grp-1', { method: 'DELETE' }));
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/groups'));
  });

  it('sends nothing when the sole owner cancels', async () => {
    const fetchMock = vi.mocked(fetch);
    renderWithMantine(<LeaveGroupButton groupId="grp-1" memberId="member-1" willDeleteGroup />);
    fireEvent.click(screen.getByRole('button', { name: 'Leave group' }));
    await waitFor(() => screen.getByText('Delete this group?'));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('turns into the deletion prompt, deleting nothing, when the api answers owner_must_delete', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ error: 'owner_must_delete', message: 'Delete the group instead.', memberCount: 1 }),
        { status: 409, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    renderWithMantine(<LeaveGroupButton groupId="grp-1" memberId="member-1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Leave group' }));
    await waitFor(() => screen.getByRole('button', { name: 'Confirm leave group' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm leave group' }));

    await waitFor(() => screen.getByText('Delete this group?'));
    expect(screen.getByRole('alert')).toHaveTextContent(/only member, so you can't leave without deleting this group/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(pushMock).not.toHaveBeenCalled();

    // Only an explicit confirmation deletes, through the delete route.
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete group' }));
    await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith('/api/groups/grp-1', { method: 'DELETE' }));
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/groups'));
  });

  it('keeps the generic failure for any other 409', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(new Response('something else', { status: 409 }));

    renderWithMantine(<LeaveGroupButton groupId="grp-1" memberId="member-1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Leave group' }));
    await waitFor(() => screen.getByRole('button', { name: 'Confirm leave group' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm leave group' }));

    await waitFor(() => screen.getByRole('alert'));
    expect(screen.getByText('Leave this group?')).toBeInTheDocument();
    expect(screen.queryByText('Delete this group?')).not.toBeInTheDocument();
  });

  // Review §3.2.1: ownership transfer is the one consequence of leaving a
  // departing owner would not otherwise guess -- every other member just
  // sees the group carry on unaffected.
  it('names the successor when nextOwnerLabel is set', async () => {
    renderWithMantine(<LeaveGroupButton groupId="grp-1" memberId="member-1" nextOwnerLabel="Adam" />);
    fireEvent.click(screen.getByRole('button', { name: 'Leave group' }));
    await waitFor(() => screen.getByText(/Adam will become the new owner/));
  });

  it('says nothing about a successor when nextOwnerLabel is not set', async () => {
    renderWithMantine(<LeaveGroupButton groupId="grp-1" memberId="member-1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Leave group' }));
    await waitFor(() => screen.getByText(/lose access to every train shared/));
    expect(screen.queryByText(/will become the new owner/)).not.toBeInTheDocument();
  });

  // willDeleteGroup takes precedence over nextOwnerLabel: if leaving
  // deletes the group outright there is no successor to name.
  it('does not name a successor when willDeleteGroup is also set', async () => {
    renderWithMantine(<LeaveGroupButton groupId="grp-1" memberId="member-1" willDeleteGroup nextOwnerLabel="Adam" />);
    fireEvent.click(screen.getByRole('button', { name: 'Leave group' }));
    await waitFor(() => screen.getByText(/leaving would delete this group/));
    expect(screen.queryByText(/will become the new owner/)).not.toBeInTheDocument();
  });
});
