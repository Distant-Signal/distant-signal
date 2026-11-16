import { guardPreview } from '@/lib/previewRoute';
import { ApiNotFoundError, getPreviewLines, getPreviewLineStatus, getPreviewTocs } from '@/lib/api';
import { tocNameLookup } from '@/lib/displayLabels';
import { linePreviewCard } from '@/lib/linePreview';
import { LIVE_PREVIEW_CACHE_CONTROL } from '@/lib/livePreview';
import { renderStatusPreviewImage } from '@/lib/previewImage';
import type { LineStatusReport } from '@/lib/types';
import { plainCredits } from '@/lib/creditText';

// A line's link-preview image, listed by the page's `generateMetadata` as
// `/lines/{id}/card.png?v={digest}` (`lib/livePreview.ts`, and the incident
// card's route for why it isn't an `opengraph-image.tsx`). `?v=` is never
// read here: the image always shows the line's status as it is now.
//
// Every read is a preview read (`lib/api.ts`, "Reads for link-preview
// images"): the status for a minute, the names for an hour. Anonymous, so
// a private custom line is a 404 here, as its page is to anyone else.
// Rendered per request, never stored as an ISR entry (`lib/livePreview.ts`):
// its reads are cached, the PNG is cached by the CDN.
export const dynamic = 'force-dynamic';

function notFound(): Response {
  return new Response('Not found', { status: 404, headers: { 'Cache-Control': LIVE_PREVIEW_CACHE_CONTROL } });
}

async function handle(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  // The page's own id check: never build a request from anything else.
  if (!/^[a-z0-9-]+$/.test(id)) return notFound();

  let report: LineStatusReport | null = null;
  try {
    report = (await getPreviewLineStatus(id))[0] ?? null;
  } catch (err) {
    if (!(err instanceof ApiNotFoundError)) throw err;
  }
  let name = report?.name;
  let operators = report?.operators ?? [];
  if (report === null) {
    // No status row yet: a catalogue line still has a name ("No status yet").
    const summary = (await getPreviewLines()).find((line) => line.id === id);
    if (!summary) return notFound();
    name = summary.name;
    operators = summary.operators;
  }
  // No operator names (the list could not be read) is no operators row, never raw codes.
  const tocs = await getPreviewTocs().catch(() => null);
  const card = linePreviewCard(name ?? id, report, tocs ? operators : [], tocNameLookup(tocs ?? []));
  return renderStatusPreviewImage(
    card,
    plainCredits(id.startsWith('tfl-') ? ['tfl'] : ['national-rail', 'network-rail']),
    {
      headers: { 'Cache-Control': LIVE_PREVIEW_CACHE_CONTROL },
    },
  );
}

export const GET = guardPreview(handle);
