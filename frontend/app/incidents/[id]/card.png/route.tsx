import { guardPreview } from '@/lib/previewRoute';
import { ApiNotFoundError, getPreviewIncident, getPreviewStationName, getPreviewTocs } from '@/lib/api';
import { INCIDENT_ID } from '@/lib/incidents';
import { tocNameLookup } from '@/lib/displayLabels';
import { incidentPreviewCard, incidentStatusCard, MAX_PREVIEW_STATIONS } from '@/lib/incidentPreview';
import { LIVE_PREVIEW_CACHE_CONTROL } from '@/lib/livePreview';
import { renderStatusPreviewImage } from '@/lib/previewImage';
import { plainCredits } from '@/lib/creditText';

// An incident's link-preview image, listed by the page's `generateMetadata`
// as `/incidents/{id}/card.png?v={digest}` (`lib/livePreview.ts`). Not an
// `opengraph-image.tsx`: Next lists a file-convention image itself, at a
// URL the page can't version, and runs its `generateImageMetadata` again on
// every image request. `?v=` is never read here: the image always shows the
// incident as it is now, and its words come only from the api.
//
// Cheap to unfurl many times: every read is a preview read (`lib/api.ts`,
// "Reads for link-preview images"), the incident's for a minute and
// the names for an hour. The PNG is drawn per request (no ISR:
// `lib/livePreview.ts`, "Caching") and the CDN in front caches it by its
// `Cache-Control`, which the `.png` path lets it do.
export const dynamic = 'force-dynamic';

async function handle(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  // The page's own id check: never build a request from anything else.
  if (!INCIDENT_ID.test(id)) {
    return new Response('Not found', { status: 404, headers: { 'Cache-Control': LIVE_PREVIEW_CACHE_CONTROL } });
  }
  let incident;
  try {
    incident = await getPreviewIncident(id);
  } catch (err) {
    if (err instanceof ApiNotFoundError) {
      return new Response('Not found', { status: 404, headers: { 'Cache-Control': LIVE_PREVIEW_CACHE_CONTROL } });
    }
    throw err;
  }
  // Both degrade to codes, as on the page.
  const stationCodes = incident.affectedStations.slice(0, MAX_PREVIEW_STATIONS);
  const [tocs, stationNames] = await Promise.all([
    getPreviewTocs().catch(() => []),
    Promise.all(stationCodes.map((crs) => getPreviewStationName(crs).catch(() => null))),
  ]);
  const card = incidentPreviewCard(incident, {
    operatorNames: tocNameLookup(tocs),
    stationNames: new Map(stationCodes.map((crs, i) => [crs, stationNames[i] ?? null])),
    now: Date.now(),
  });
  return renderStatusPreviewImage(incidentStatusCard(card), plainCredits(['knowledgebase-incidents']), {
    headers: { 'Cache-Control': LIVE_PREVIEW_CACHE_CONTROL },
  });
}

export const GET = guardPreview(handle);
