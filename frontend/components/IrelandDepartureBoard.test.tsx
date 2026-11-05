import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderWithMantine } from '@/test/render';
import { DEPARTURES } from '@/test/irelandFixtures';
import { IrelandDepartureBoard } from './IrelandDepartureBoard';

describe('IrelandDepartureBoard', () => {
  it('lists each departure with its time, destination and delay in words, and no feed status', () => {
    renderWithMantine(<IrelandDepartureBoard board={{ departures: DEPARTURES, polledAt: null }} />);
    const rows = within(screen.getByRole('list', { name: 'Live departures' })).getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(rows[0]!.textContent).toContain('08:05');
    expect(rows[0]!.textContent).toContain('to Belfast Grand Central');
    expect(rows[0]!.textContent).toContain('5 min late');
    expect(rows[0]!.textContent).toContain('Timetabled 08:00 · From Dublin Connolly · Train code A101');
    // "No Information" with Late 0 is no report, never "On time".
    expect(rows[1]!.textContent).toContain('No report yet');
    expect(rows[1]!.textContent).not.toContain('On time');
    expect(rows[1]!.textContent).not.toContain('Timetabled');
    expect(screen.queryByText(/En Route|No Information/)).toBeNull();
  });

  it("links each row to its train's page when the board gives the train's date", () => {
    renderWithMantine(
      <IrelandDepartureBoard
        board={{ departures: [DEPARTURES[0]!, { ...DEPARTURES[1]!, trainDate: null }], polledAt: null }}
      />,
    );
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(links[0]!.getAttribute('href')).toBe('/island-of-ireland/iarnrod-eireann/trains/A101/2026-09-17');
    expect(links[0]!.textContent).toContain('to Belfast Grand Central');
  });

  it('says when the board was polled, once', () => {
    renderWithMantine(<IrelandDepartureBoard board={{ departures: DEPARTURES, polledAt: '2026-11-04T09:05:03Z' }} />);
    expect(screen.getAllByText(/^Updated /)).toHaveLength(1);
  });

  it('says when a station has no live board', () => {
    renderWithMantine(<IrelandDepartureBoard board={null} />);
    expect(screen.getByRole('status').textContent).toBe("We don't have live departures for this station.");
  });

  it('says when the board is empty, counting only departing trains', () => {
    renderWithMantine(<IrelandDepartureBoard board={{ departures: [DEPARTURES[2]!], polledAt: null }} />);
    expect(screen.getByRole('status').textContent).toBe('No departures listed right now.');
  });

  it('words a failed load the usual way', () => {
    renderWithMantine(<IrelandDepartureBoard board="failed" />);
    expect(screen.getByRole('status').textContent).toBe("Couldn't load departures. Try again.");
  });
});
