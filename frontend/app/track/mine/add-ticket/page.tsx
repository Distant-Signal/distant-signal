import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Journeys', robots: { index: false } };

/** `/track/mine/add-ticket` -- the standalone ticket page, retired on
 * 2026-11-06: a ticket is now a few optional details on a journey leg
 * (its type, the one company it is valid on, a name, or an Apple Wallet
 * pass to fill them in), added from the journey's own page, and Delay
 * Repay is estimated on every leg without one. Old links and bookmarks go
 * to the Journeys page, where every journey is. */
export default function AddTicketPage(): never {
  redirect('/journeys');
}
