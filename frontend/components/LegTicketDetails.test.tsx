import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithMantine } from '@/test/render';
import { LegTicketDetails } from './LegTicketDetails';
import type { LegTicket } from '@/lib/types';

const refreshMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  refreshMock.mockClear();
});

const SAVED: LegTicket = {
  ticketType: 'advance',
  operatorOnly: true,
  operatorCode: 'GR',
  name: 'Work',
  source: 'manual',
  departureDate: null,
};

function render(ticket: LegTicket | null = null) {
  renderWithMantine(<LegTicketDetails journeyId={5} legId={9} ticket={ticket} operatorName="LNER" />);
}

describe('LegTicketDetails', () => {
  it('needs no ticket, and says so', () => {
    render();
    expect(screen.getByText('No ticket details. None needed for Delay Repay.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add ticket details' })).toBeInTheDocument();
  });

  it('sums up saved details on one line', () => {
    render(SAVED);
    expect(screen.getByText('Ticket: Advance, LNER trains only (Work)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit ticket details' })).toBeInTheDocument();
  });

  it('saves the type, the one-company flag and a trimmed name with a PUT, then refreshes', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(SAVED), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    render();
    fireEvent.click(screen.getByRole('button', { name: 'Add ticket details' }));
    fireEvent.click(screen.getByRole('combobox', { name: 'Ticket type' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Return' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Only valid on LNER trains' }));
    fireEvent.change(screen.getByRole('textbox', { name: /^Name/ }), { target: { value: '  Home  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith('/api/Journeys/5/legs/9/ticket', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ticketType: 'return',
        operatorOnly: true,
        name: 'Home',
        source: 'manual',
        departureDate: null,
      }),
    });
  });

  it('fills the form from a Wallet pass, warns about another date, and saves it as from the pass', async () => {
    const fetchMock = vi.fn(async (url: string, _init?: RequestInit) =>
      url.endsWith('/pkpass')
        ? new Response(
            JSON.stringify({
              ticketType: 'offPeak',
              operatorOnly: false,
              ticketTypeText: 'Super Off-Peak',
              departureDate: '2026-11-12T08:00:00Z',
              departureDateMatchesLeg: false,
            }),
            { status: 200 },
          )
        : new Response(JSON.stringify(SAVED), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const { container } = renderWithMantine(
      <LegTicketDetails journeyId={5} legId={9} ticket={null} operatorName={null} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add ticket details' }));
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['x'], 'ticket.pkpass')] } });
    expect(await screen.findByText(/It's for 12 Nov 2026, not this leg's date/)).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Ticket type' })).toHaveValue('Off-Peak');
    expect(screen.getByRole('checkbox', { name: 'Only valid on this train company' })).not.toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
    const put = fetchMock.mock.calls.find(([url]) => url === '/api/Journeys/5/legs/9/ticket');
    expect(JSON.parse(put?.[1]?.body as string)).toMatchObject({
      ticketType: 'offPeak',
      source: 'wallet',
      departureDate: '2026-11-12T08:00:00Z',
    });
  });

  it('says why a file could not be read, and keeps the form', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('this file is a PDF, not a .pkpass', { status: 415 })),
    );
    const { container } = renderWithMantine(
      <LegTicketDetails journeyId={5} legId={9} ticket={null} operatorName="LNER" />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add ticket details' }));
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['%PDF'], 'ticket.pdf')] } });
    expect(
      await screen.findByText("That isn't an Apple Wallet pass. Fill in the details yourself."),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('removes saved details with a DELETE', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    render(SAVED);
    fireEvent.click(screen.getByRole('button', { name: 'Edit ticket details' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove ticket details' }));
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith('/api/Journeys/5/legs/9/ticket', { method: 'DELETE' });
  });

  it('words a failed save as a failure, never the raw body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('internal', { status: 500 })),
    );
    render();
    fireEvent.click(screen.getByRole('button', { name: 'Add ticket details' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't save your ticket details. Try again.");
  });
});
