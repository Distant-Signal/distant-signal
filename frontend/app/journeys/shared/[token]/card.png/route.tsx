import { guardPreview } from '@/lib/previewRoute';
import { ApiNotFoundError, getPreviewSharedJourney } from '@/lib/api';
import { plainCredits } from '@/lib/creditText';
import { TOKEN_PREVIEW_CACHE_CONTROL, NOINDEX_HEADER } from '@/lib/livePreview';
import { renderStatusPreviewImage } from '@/lib/previewImage';
import { sharedJourneyPreviewCard } from '@/lib/sharedJourneyPreview';

// A shared journey's link-preview image, listed by the page's
// `generateMetadata` as `/journeys/shared/{token}/card.png?v={digest}`
// (`lib/sharedJourneyPreview.ts` for what it shows; the incident card's
// route for why it isn't an `opengraph-image.tsx`). `?v=` is never read.
//
// One preview read (`lib/api.ts`, "Reads for link-preview images"): the
// unauthenticated share-token call, which answers with exactly what the page
// shows anyone holding the link. A revoked, expired or malformed token, or a
// journey with no legs, is a 404, so a chat app falls back to no image.
//
// Nothing here is cached by us: the read is uncached, the route is rendered
// per request (never an ISR entry, so no token is written to disk) and every
// answer is `TOKEN_PREVIEW_CACHE_CONTROL`, so the first fetch after the
// owner revokes the link is a 404, never the old card.
export const dynamic = 'force-dynamic';

function notFound(): Response {
  return new Response('Not found', {
    status: 404,
    headers: { 'Cache-Control': TOKEN_PREVIEW_CACHE_CONTROL, ...NOINDEX_HEADER },
  });
}

async function handle(_request: Request, { params }: { params: Promise<{ token: string }> }): Promise<Response> {
  const { token } = await params;
  // The page's own token check: never build a request from anything else.
  if (!/^[A-Za-z0-9_-]+$/.test(token)) return notFound();

  let journey;
  try {
    journey = await getPreviewSharedJourney(token);
  } catch (err) {
    if (err instanceof ApiNotFoundError) return notFound();
    throw err;
  }
  const card = sharedJourneyPreviewCard(journey.legs);
  if (!card) return notFound();
  return renderStatusPreviewImage(card, plainCredits(['national-rail', 'network-rail', 'rsp-timetable']), {
    headers: { 'Cache-Control': TOKEN_PREVIEW_CACHE_CONTROL, ...NOINDEX_HEADER },
  });
}

export const GET = guardPreview(handle, { token: true });
