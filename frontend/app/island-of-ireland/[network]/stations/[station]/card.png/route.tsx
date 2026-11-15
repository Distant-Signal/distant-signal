import { guardPreview } from '@/lib/previewRoute';
import { getPreviewIrelandLines, getPreviewIrelandStations } from '@/lib/api';
import { plainCredits } from '@/lib/creditText';
import { IRELAND_CREDIT_FOR_NETWORK, networkBySlug } from '@/lib/ireland';
import { idFromSegmentOrNull } from '@/lib/irelandData';
import { irelandStationPreviewCard } from '@/lib/irelandPreview';
import { LIVE_PREVIEW_CACHE_CONTROL } from '@/lib/livePreview';
import { renderStatusPreviewImage } from '@/lib/previewImage';

// An Irish station's link-preview image, listed by the page's
// `generateMetadata` as `/island-of-ireland/{network}/stations/{station}/card.png?v={digest}`
// (`lib/irelandPreview.ts`). Not live: its lines (the departure board
// changes by the minute). Both reads are hour-long preview reads.
export const revalidate = 60; // LIVE_PREVIEW_REVALIDATE_SECONDS: segment config must be a literal

export function generateStaticParams(): { network: string; station: string }[] {
  return [];
}

function notFound(): Response {
  return new Response('Not found', { status: 404, headers: { 'Cache-Control': LIVE_PREVIEW_CACHE_CONTROL } });
}

async function handle(
  _request: Request,
  { params }: { params: Promise<{ network: string; station: string }> },
): Promise<Response> {
  const { network, station: segment } = await params;
  const info = networkBySlug(network);
  const id = idFromSegmentOrNull(segment);
  if (!info || id === null) return notFound();
  const [stations, lines] = await Promise.all([getPreviewIrelandStations(), getPreviewIrelandLines()]);
  const station = stations.find((candidate) => candidate.id === id && candidate.network === info.network);
  if (!station) return notFound();
  return renderStatusPreviewImage(
    irelandStationPreviewCard(
      station,
      info,
      lines.filter((line) => line.network === info.network),
    ),
    plainCredits([IRELAND_CREDIT_FOR_NETWORK[info.network]]),
    { headers: { 'Cache-Control': LIVE_PREVIEW_CACHE_CONTROL } },
  );
}

export const GET = guardPreview(handle);
