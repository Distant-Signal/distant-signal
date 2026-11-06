import { describe, it, expect, vi } from 'vitest';
import AddTicketPage from './page';

const redirect = vi.fn((href: string) => {
  throw new Error(`NEXT_REDIRECT ${href}`);
});
vi.mock('next/navigation', () => ({ redirect: (href: string) => redirect(href) }));

describe('/track/mine/add-ticket', () => {
  it('sends old links to the Journeys page, where ticket details now live on each leg', () => {
    expect(() => AddTicketPage()).toThrow('NEXT_REDIRECT /journeys');
    expect(redirect).toHaveBeenCalledWith('/journeys');
  });
});
