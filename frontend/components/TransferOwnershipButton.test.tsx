import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useState } from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithMantine } from '@/test/render';
import { TransferOwnershipButton } from './TransferOwnershipButton';
import { GroupOwnershipAnnouncer } from './GroupOwnershipAnnouncer';

const refreshMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refreshMock }),
  usePathname: () => '/groups/grp-1',
  useSearchParams: () => new URLSearchParams(''),
}));

async function confirm() {
  fireEvent.click(screen.getByRole('button', { name: 'Make owner' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Confirm make owner' }));
}

describe('TransferOwnershipButton', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    refreshMock.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('says what changes and sends nothing until confirmed', async () => {
    renderWithMantine(<TransferOwnershipButton groupId="grp-1" memberId="m_2" name="Alex" />);
    fireEvent.click(screen.getByRole('button', { name: 'Make owner' }));
    expect(await screen.findByText('Make Alex the owner?')).toBeInTheDocument();
    expect(screen.getByText(/stay a member and can leave/)).toBeInTheDocument();
    expect(screen.getByText(/can make you the owner again/)).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('POSTs the member id, refreshes and announces the change', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ role: 'member' }), { status: 200 }));
    renderWithMantine(
      <>
        <h1>Walkers</h1>
        <GroupOwnershipAnnouncer viewerRole="owner" />
        <TransferOwnershipButton groupId="grp-1" memberId="m_2" name="Alex" />
      </>,
    );
    await confirm();
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/groups/grp-1/transfer-ownership', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: 'm_2' }),
      });
    });
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
    expect(screen.getByRole('status')).toHaveTextContent('Alex is now the owner.');
  });

  it('moves focus to the heading once the page shows the viewer as a member', async () => {
    function Page() {
      const [viewerRole, setViewerRole] = useState('owner');
      return (
        <>
          <h1>Walkers</h1>
          <GroupOwnershipAnnouncer viewerRole={viewerRole} />
          <button onClick={() => setViewerRole('member')}>Refreshed</button>
        </>
      );
    }
    renderWithMantine(<Page />);
    window.dispatchEvent(new CustomEvent('ds:group-ownership-transferred', { detail: 'Alex is now the owner.' }));
    fireEvent.click(screen.getByRole('button', { name: 'Refreshed' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Walkers' })).toHaveFocus());
  });

  it('shows the api sentence for a 409 and keeps the dialog open', async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json(
        {
          error: 'ownership_changed',
          message: 'This group changed while you were doing that. Check who owns it and try again.',
        },
        { status: 409 },
      ),
    );
    renderWithMantine(<TransferOwnershipButton groupId="grp-1" memberId="m_2" name="Alex" />);
    await confirm();
    expect(
      await screen.findByText('This group changed while you were doing that. Check who owns it and try again.'),
    ).toBeInTheDocument();
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it('words a 403, a 404 and a network failure through describeFailure', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('no member with that id', { status: 404 }));
    renderWithMantine(<TransferOwnershipButton groupId="grp-1" memberId="m_2" name="Alex" />);
    await confirm();
    expect(await screen.findByText("Couldn't transfer ownership. It may have been removed.")).toBeInTheDocument();
    vi.mocked(fetch).mockRejectedValueOnce(new Error('offline'));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm make owner' }));
    expect(await screen.findByText("Couldn't transfer ownership. Try again.")).toBeInTheDocument();
  });
});
