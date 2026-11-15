import { guardPreview } from '@/lib/previewRoute';
import { ApiNotFoundError, getPreviewTransitLine, getPreviewTransitNetwork } from '@/lib/api';
import { boundedCredit, LIVE_PREVIEW_CACHE_CONTROL } from '@/lib/livePreview';
import { renderStatusPreviewImage } from '@/lib/previewImage';
import { TRANSIT_ID } from '@/lib/transit';
import { transitLinePreviewCard } from '@/lib/transitPreview';

// A transit line's link-preview image, listed by the page's
// `generateMetadata` as `/transit/{network}/lines/{line}/card.png?v={digest}`
// (`lib/transitPreview.ts`; the incident card's route for why it isn't an
// `opengraph-image.tsx`). `?v=` is never read: the image always shows the
// line as it is now. Both reads are preview reads (`lib/api.ts`, "Reads for
// link-preview images"), shared for a minute.
export const revalidate = 60; // LIVE_PREVIEW_REVALIDATE_SECONDS: segment config must be a literal

export function generateStaticParams(): { network: string; line: string }[] {
  return [];
}

function notFoundResponse(): Response {
  return new Response('Not found', { status: 404, headers: { 'Cache-Control': LIVE_PREVIEW_CACHE_CONTROL } });
}

async function handle(
  _request: Request,
  { params }: { params: Promise<{ network: string; line: string }> },
): Promise<Response> {
  const { network, line } = await params;
  if (!TRANSIT_ID.test(network) || !TRANSIT_ID.test(line)) return notFoundResponse();
  let detail;
  let lineDetail;
  try {
    [detail, lineDetail] = await Promise.all([getPreviewTransitNetwork(network), getPreviewTransitLine(network, line)]);
  } catch (err) {
    if (err instanceof ApiNotFoundError) return notFoundResponse();
    throw err;
  }
  return renderStatusPreviewImage(
    transitLinePreviewCard(lineDetail, detail.name),
    boundedCredit(detail.attribution.text),
    {
      headers: { 'Cache-Control': LIVE_PREVIEW_CACHE_CONTROL },
    },
  );
}

export const GET = guardPreview(handle);
