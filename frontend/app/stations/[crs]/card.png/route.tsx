import { guardPreview } from '@/lib/previewRoute';
import { ApiNotFoundError, getPreviewStationName, getPreviewStopPointDisruption } from '@/lib/api';
import { LIVE_PREVIEW_CACHE_CONTROL } from '@/lib/livePreview';
import { renderStatusPreviewImage } from '@/lib/previewImage';
import { type StationDisruptionState, stationCreditIds, stationPreviewCard } from '@/lib/stationPreview';
import { plainCredits } from '@/lib/creditText';

// A station's link-preview image, listed by the page's `generateMetadata`
// as `/stations/{CRS}/card.png?v={digest}` (`lib/livePreview.ts`, and the
// incident card's route for why it isn't an `opengraph-image.tsx`). `?v=`
// is never read here: the image always shows the station as it is now.
//
// Every read is a preview read (`lib/api.ts`, "Reads for link-preview
// images"): the disruptions for a minute, the name for an hour.
export const revalidate = 60; // LIVE_PREVIEW_REVALIDATE_SECONDS: segment config must be a literal

export function generateStaticParams(): { crs: string }[] {
  return [];
}

function notFound(): Response {
  return new Response('Not found', { status: 404, headers: { 'Cache-Control': LIVE_PREVIEW_CACHE_CONTROL } });
}

async function handle(_request: Request, { params }: { params: Promise<{ crs: string }> }): Promise<Response> {
  const { crs: raw } = await params;
  // The page's own code check, and its upper-case canonical form.
  if (!/^[A-Za-z]{3}$/.test(raw)) return notFound();
  const crs = raw.toUpperCase();

  // The name is a nicety: without it the card is headed by the bare code.
  let name: string | null;
  try {
    name = await getPreviewStationName(crs);
  } catch {
    name = crs;
  }
  if (name === null) return notFound();
  let state: StationDisruptionState;
  try {
    state = { coverage: 'covered', reports: await getPreviewStopPointDisruption(crs) };
  } catch (err) {
    if (!(err instanceof ApiNotFoundError)) throw err;
    state = { coverage: 'none' };
  }
  const card = stationPreviewCard(`${name} (${crs})`, state, Date.now());
  const credit = plainCredits(stationCreditIds(state));
  return renderStatusPreviewImage(card, credit, { headers: { 'Cache-Control': LIVE_PREVIEW_CACHE_CONTROL } });
}

export const GET = guardPreview(handle);
