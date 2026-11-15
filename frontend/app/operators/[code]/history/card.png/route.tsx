import { guardPreview } from '@/lib/previewRoute';
import { ApiNotFoundError, getPreviewOperator, getPreviewTocs } from '@/lib/api';
import { LIVE_PREVIEW_CACHE_CONTROL } from '@/lib/livePreview';
import { operatorName, operatorPreviewCard } from '@/lib/operatorPreview';
import { renderStatusPreviewImage } from '@/lib/previewImage';
import { plainCredits } from '@/lib/creditText';

// An operator history page's link-preview image, listed by the page's
// `generateMetadata` as `/operators/{code}/history/card.png?v={digest}`
// (`lib/operatorPreview.ts`). Both reads are preview reads (`lib/api.ts`,
// "Reads for link-preview images"). An unknown operator is a 404.
export const revalidate = 60; // LIVE_PREVIEW_REVALIDATE_SECONDS: segment config must be a literal

export function generateStaticParams(): { code: string }[] {
  return [];
}

function notFound(): Response {
  return new Response('Not found', { status: 404, headers: { 'Cache-Control': LIVE_PREVIEW_CACHE_CONTROL } });
}

async function handle(_request: Request, { params }: { params: Promise<{ code: string }> }): Promise<Response> {
  const { code } = await params;
  if (!/^[A-Za-z0-9]{1,8}$/.test(code)) return notFound();
  let lineCount: number;
  try {
    lineCount = (await getPreviewOperator(code)).lineIds.length;
  } catch (err) {
    if (err instanceof ApiNotFoundError) return notFound();
    throw err;
  }
  const tocs = await getPreviewTocs().catch(() => []);
  return renderStatusPreviewImage(
    operatorPreviewCard(operatorName(code, tocs), lineCount),
    plainCredits(code === 'TfL' ? ['tfl'] : ['national-rail', 'network-rail']),
    { headers: { 'Cache-Control': LIVE_PREVIEW_CACHE_CONTROL } },
  );
}

export const GET = guardPreview(handle);
