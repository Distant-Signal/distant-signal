import { guardPreview } from '@/lib/previewRoute';
import { getPreviewIrelandTrain } from '@/lib/api';
import { plainCredits } from '@/lib/creditText';
import { IRELAND_SERVICE_DATE, IRELAND_TRAIN_CODE, networkBySlug } from '@/lib/ireland';
import { irelandTrainPreviewCard } from '@/lib/irelandPreview';
import { LIVE_PREVIEW_CACHE_CONTROL } from '@/lib/livePreview';
import { renderStatusPreviewImage } from '@/lib/previewImage';

// An Irish train's link-preview image, listed by the page's
// `generateMetadata` as `/island-of-ireland/{network}/trains/{train}/{date}/card.png?v={digest}`
// (`lib/irelandPreview.ts`). Live: what the boards say about it now. One
// preview read (`lib/api.ts`), shared for a minute. Only Iarnród Éireann has
// live boards, so only it has train pages and cards.
export const revalidate = 60; // LIVE_PREVIEW_REVALIDATE_SECONDS: segment config must be a literal

export function generateStaticParams(): { network: string; train: string; date: string }[] {
  return [];
}

function notFound(): Response {
  return new Response('Not found', { status: 404, headers: { 'Cache-Control': LIVE_PREVIEW_CACHE_CONTROL } });
}

async function handle(
  _request: Request,
  { params }: { params: Promise<{ network: string; train: string; date: string }> },
): Promise<Response> {
  const { network, train: segment, date } = await params;
  const info = networkBySlug(network);
  if (info?.network !== 'republic-of-ireland') return notFound();
  let code: string;
  try {
    code = decodeURIComponent(segment).trim().toUpperCase();
  } catch {
    return notFound();
  }
  if (!IRELAND_TRAIN_CODE.test(code) || !IRELAND_SERVICE_DATE.test(date)) return notFound();
  const train = await getPreviewIrelandTrain(code, date);
  if (train === null) return notFound();
  return renderStatusPreviewImage(
    irelandTrainPreviewCard(train, info),
    plainCredits(['nta-gtfs', 'irish-rail-realtime']),
    { headers: { 'Cache-Control': LIVE_PREVIEW_CACHE_CONTROL } },
  );
}

export const GET = guardPreview(handle);
