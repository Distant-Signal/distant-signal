import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { renderTrainPage, PRIVATE_TRAIN_DESCRIPTION } from '@/app/train/[uid]/[date]/page';
import { pageMetadata } from '@/lib/pageMetadata';

// Never prerendered or stored: the answer depends on the share token in the
// path (see the train page's own note).
export const dynamic = 'force-dynamic';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// The shape of a real share token (see `app/journeys/shared/[token]`).
const SHARE_TOKEN_PATTERN = /^[A-Za-z0-9_-]+$/;

type Params = Promise<{ token: string; uid: string; date: string }>;

/** Generic by design, and never fetched: this URL carries a journey's share
 * token, and a train a journey leg kept after it was pruned may be all the
 * page can show. Nothing about the train goes into the title, description
 * or a preview image, and the page is never indexed or followed. */
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { uid } = await params;
  return pageMetadata(`Train ${uid}`, PRIVATE_TRAIN_DESCRIPTION, { capability: true });
}

/** `/journeys/shared/{token}/train/{uid}/{date}`: the train page for a leg
 * of a shared journey, the one place a share-link holder with no session
 * can read a train whose live data was pruned (DS-638). The token stays in
 * the path, where the share link itself already has it, so it is covered
 * by the same `no-referrer` policy (`next.config.mjs`, `TOKEN_PAGE_SOURCES`)
 * and is never put in a query string. The api checks the token against the
 * journey that holds this train; a train that is not on it is a 404. */
export default async function SharedJourneyTrainPage({ params }: { params: Params }) {
  const { token, uid, date } = await params;
  if (!SHARE_TOKEN_PATTERN.test(token) || !DATE_PATTERN.test(date)) notFound();
  return renderTrainPage(uid, date, token);
}
