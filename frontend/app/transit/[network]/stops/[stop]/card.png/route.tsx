import { guardPreview } from '@/lib/previewRoute';
import { ApiNotFoundError, getPreviewTransitNetwork, getPreviewTransitStop } from '@/lib/api';
import { boundedCredit, LIVE_PREVIEW_CACHE_CONTROL } from '@/lib/livePreview';
import { renderStatusPreviewImage } from '@/lib/previewImage';
import { TRANSIT_ID, TRANSIT_STOP_ID } from '@/lib/transit';
import { transitStopPreviewCard } from '@/lib/transitPreview';

// A transit stop's link-preview image, listed by the page's
// `generateMetadata` as `/transit/{network}/stops/{stop}/card.png?v={digest}`
// (`lib/transitPreview.ts`). Not live: the stop's lines and notices. Both
// reads are preview reads (`lib/api.ts`), shared for a minute.
// Rendered per request, never stored as an ISR entry (`lib/livePreview.ts`):
// its reads are cached, the PNG is cached by the CDN.
export const dynamic = 'force-dynamic';

function notFoundResponse(): Response {
  return new Response('Not found', { status: 404, headers: { 'Cache-Control': LIVE_PREVIEW_CACHE_CONTROL } });
}

async function handle(
  _request: Request,
  { params }: { params: Promise<{ network: string; stop: string }> },
): Promise<Response> {
  const { network, stop } = await params;
  if (!TRANSIT_ID.test(network) || !TRANSIT_STOP_ID.test(stop)) return notFoundResponse();
  let detail;
  let stopDetail;
  try {
    [detail, stopDetail] = await Promise.all([getPreviewTransitNetwork(network), getPreviewTransitStop(network, stop)]);
  } catch (err) {
    if (err instanceof ApiNotFoundError) return notFoundResponse();
    throw err;
  }
  return renderStatusPreviewImage(
    transitStopPreviewCard(stopDetail, detail.name),
    boundedCredit(detail.attribution.text),
    {
      headers: { 'Cache-Control': LIVE_PREVIEW_CACHE_CONTROL },
    },
  );
}

export const GET = guardPreview(handle);
