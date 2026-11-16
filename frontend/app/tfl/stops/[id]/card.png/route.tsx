import { guardPreview } from '@/lib/previewRoute';
import { ApiNotFoundError, getPreviewLinesStatus, getPreviewTflStop } from '@/lib/api';
import { plainCredits } from '@/lib/creditText';
import { LIVE_PREVIEW_CACHE_CONTROL } from '@/lib/livePreview';
import { renderStatusPreviewImage } from '@/lib/previewImage';
import { tflModeBadge, TFL_LINE_ID, TFL_STOP_ID } from '@/lib/tflStops';
import type { LineStatusReport } from '@/lib/types';
import { completeLineReports, tflStopPreviewCard } from '@/lib/transitPreview';

// A TfL stop's link-preview image, listed by the page's `generateMetadata`
// as `/tfl/stops/{id}/card.png?v={digest}` (`lib/transitPreview.ts`). Live:
// the worst status on the lines through the stop, as a station's card. Every
// read is a preview read (`lib/api.ts`, "Reads for link-preview images"). A
// status that can't be read draws "Status unavailable", never a guess.
// Rendered per request, never stored as an ISR entry (`lib/livePreview.ts`):
// its reads are cached, the PNG is cached by the CDN.
export const dynamic = 'force-dynamic';

function notFoundResponse(): Response {
  return new Response('Not found', { status: 404, headers: { 'Cache-Control': LIVE_PREVIEW_CACHE_CONTROL } });
}

async function handle(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  if (!TFL_STOP_ID.test(id)) return notFoundResponse();
  let stop;
  try {
    stop = await getPreviewTflStop(id);
  } catch (err) {
    if (err instanceof ApiNotFoundError) return notFoundResponse();
    throw err;
  }
  const ids = stop.lines.filter((line) => TFL_LINE_ID.test(line.id)).map((line) => `tfl-${line.id}`);
  let reports: LineStatusReport[] | null = null;
  if (ids.length === 0) reports = [];
  else {
    try {
      reports = await getPreviewLinesStatus(ids);
    } catch (err) {
      if (!(err instanceof ApiNotFoundError)) throw err;
    }
  }
  const card = tflStopPreviewCard(
    stop,
    stop.modes.map(tflModeBadge),
    completeLineReports(reports, ids.length),
    Date.now(),
  );
  return renderStatusPreviewImage(card, plainCredits(['tfl']), {
    headers: { 'Cache-Control': LIVE_PREVIEW_CACHE_CONTROL },
  });
}

export const GET = guardPreview(handle);
