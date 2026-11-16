import { guardPreview } from '@/lib/previewRoute';
import { getPreviewIrelandLines, getPreviewIrelandStations } from '@/lib/api';
import { plainCredits } from '@/lib/creditText';
import { IRELAND_CREDIT_FOR_NETWORK, networkBySlug, stationsById } from '@/lib/ireland';
import { idFromSegmentOrNull } from '@/lib/irelandData';
import { irelandLinePreviewCard } from '@/lib/irelandPreview';
import { LIVE_PREVIEW_CACHE_CONTROL } from '@/lib/livePreview';
import { renderStatusPreviewImage } from '@/lib/previewImage';

// An Irish line's link-preview image, listed by the page's `generateMetadata`
// as `/island-of-ireland/{network}/lines/{line}/card.png?v={digest}`
// (`lib/irelandPreview.ts`). Both reads are hour-long preview reads
// (`lib/api.ts`, "Reads for link-preview images").
// Rendered per request, never stored as an ISR entry (`lib/livePreview.ts`):
// its reads are cached, the PNG is cached by the CDN.
export const dynamic = 'force-dynamic';

function notFound(): Response {
  return new Response('Not found', { status: 404, headers: { 'Cache-Control': LIVE_PREVIEW_CACHE_CONTROL } });
}

async function handle(
  _request: Request,
  { params }: { params: Promise<{ network: string; line: string }> },
): Promise<Response> {
  const { network, line: segment } = await params;
  const info = networkBySlug(network);
  const id = idFromSegmentOrNull(segment);
  if (!info || id === null) return notFound();
  const [stations, lines] = await Promise.all([getPreviewIrelandStations(), getPreviewIrelandLines()]);
  const line = lines.find((candidate) => candidate.id === id && candidate.network === info.network);
  if (!line) return notFound();
  const byId = stationsById(stations.filter((station) => station.network === info.network));
  return renderStatusPreviewImage(
    irelandLinePreviewCard(line, info, byId),
    plainCredits([IRELAND_CREDIT_FOR_NETWORK[info.network]]),
    { headers: { 'Cache-Control': LIVE_PREVIEW_CACHE_CONTROL } },
  );
}

export const GET = guardPreview(handle);
