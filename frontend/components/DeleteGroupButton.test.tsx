import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithMantine } from '@/test/render';
import { DeleteGroupButton } from './DeleteGroupButton';

const pushMock = vi.fn();
const refreshMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
  usePathname: () => '/groups/grp-1',
  useSearchParams: () => new URLSearchParams(''),
}));

describe('DeleteGroupButton', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    pushMock.mockClear();
    refreshMock.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('DELETEs the group and navigates to /groups', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    renderWithMantine(<DeleteGroupButton groupId="grp-1" name="Family" memberCount={3} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete group' }));
    await waitFor(() => screen.getByRole('button', { name: 'Confirm delete group' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete group' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/groups/grp-1?expectedMemberCount=3', { method: 'DELETE' });
    });
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/groups'));
  });

  it('on group_changed deletes nothing, refreshes the page and asks the owner to look again', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: 'group_changed', message: 'This group has changed.', memberCount: 4 }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    renderWithMantine(<DeleteGroupButton groupId="grp-1" name="Family" memberCount={3} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete group' }));
    await waitFor(() => screen.getByRole('button', { name: 'Confirm delete group' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete group' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(
      'People have joined or left since you opened this page. The group now has 4 members. Check who is in the group, then try again.',
    );
    expect(alert).not.toHaveTextContent(/Couldn't/);
    expect(refreshMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('keeps the generic failure for any other 409 and does not refresh', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('{"error":"other"}', { status: 409 }));

    renderWithMantine(<DeleteGroupButton groupId="grp-1" name="Family" memberCount={3} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete group' }));
    await waitFor(() => screen.getByRole('button', { name: 'Confirm delete group' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete group' }));

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't delete this group.");
    expect(refreshMock).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('warns that the deletion affects everyone before confirming', async () => {
    renderWithMantine(<DeleteGroupButton groupId="grp-1" name="Family" memberCount={3} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete group' }));

    expect(await screen.findByText(/deletes the group for everyone/)).toBeInTheDocument();
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it('a 401 shows a login prompt', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(new Response('no session', { status: 401 }));

    renderWithMantine(<DeleteGroupButton groupId="grp-1" name="Family" memberCount={3} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete group' }));
    await waitFor(() => screen.getByRole('button', { name: 'Confirm delete group' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete group' }));

    expect(await screen.findByRole('link', { name: 'Log in to delete this group' })).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("shows the backend's own error message on a non-401 failure", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(new Response("you don't have permission to do that in this group", { status: 403 }));

    renderWithMantine(<DeleteGroupButton groupId="grp-1" name="Family" memberCount={3} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete group' }));
    await waitFor(() => screen.getByRole('button', { name: 'Confirm delete group' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete group' }));

    expect(await screen.findByText("You don't have permission to do that in this group.")).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });
});
