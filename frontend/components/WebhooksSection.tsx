import { Webhooks } from './Webhooks';
import { getWebhooks } from '@/lib/api';

/** `Webhooks` with its data, for a server-rendered page (the
 * `/account/notifications` route). Renders nothing for a visitor who is not
 * logged in, while webhooks are off, or when the list can't be read: the
 * rest of the page doesn't depend on it. */
export async function WebhooksSection({ headingOrder = 2 }: { headingOrder?: 2 | 3 }) {
  const data = await getWebhooks().catch(() => null);
  if (!data) return null;
  return <Webhooks data={data} headingOrder={headingOrder} />;
}
