import type { LegTicket, LegTicketType } from './types';

/** Each ticket type a journey leg can hold, in the order the form offers
 * them (`leg_tickets::TicketType`). */
export const LEG_TICKET_TYPE_LABELS: Record<LegTicketType, string> = {
  single: 'Single',
  return: 'Return',
  advance: 'Advance',
  offPeak: 'Off-Peak',
  season: 'Season',
  unknown: 'Not sure',
};

/** One line for a leg's saved ticket details: "Ticket: Advance, LNER
 * trains only (Work)". */
export function legTicketSummary(ticket: LegTicket, operatorName: string | null): string {
  const type = ticket.ticketType === 'unknown' ? 'type not given' : LEG_TICKET_TYPE_LABELS[ticket.ticketType];
  const parts = [type];
  if (ticket.operatorOnly) {
    parts.push(operatorName ? `${operatorName} trains only` : 'one train company only');
  }
  const name = ticket.name ? ` (${ticket.name})` : '';
  const wallet = ticket.source === 'wallet' ? ', from your Wallet pass' : '';
  return `Ticket: ${parts.join(', ')}${name}${wallet}`;
}
