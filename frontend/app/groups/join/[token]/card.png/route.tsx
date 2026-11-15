import { guardPreview } from '@/lib/previewRoute';
import { ApiNotFoundError, getPreviewGroupJoin } from '@/lib/api';
import { groupInvitePreviewCard } from '@/lib/groupInvitePreview';
import { LIVE_PREVIEW_CACHE_CONTROL, NOINDEX_HEADER } from '@/lib/livePreview';
import { renderStatusPreviewImage } from '@/lib/previewImage';

// A group invite's link-preview image, listed by the page's
// `generateMetadata` as `/groups/join/{token}/card.png?v={digest}`
// (`lib/groupInvitePreview.ts`; the incident card's route for why it isn't
// an `opengraph-image.tsx`). `?v=` is never read.
//
// One preview read (`lib/api.ts`, "Reads for link-preview images"): the
// unauthenticated join preview, which gives a link holder the group's name
// and member count and nothing else, shared for a minute. An invalid or
// expired token, or a malformed one, is a 404 with the same short cache.
// There is no data to credit, so the card has no credit line.
export const revalidate = 60; // LIVE_PREVIEW_REVALIDATE_SECONDS: segment config must be a literal

export function generateStaticParams(): { token: string }[] {
  return [];
}

function notFound(): Response {
  return new Response('Not found', {
    status: 404,
    headers: { 'Cache-Control': LIVE_PREVIEW_CACHE_CONTROL, ...NOINDEX_HEADER },
  });
}

async function handle(_request: Request, { params }: { params: Promise<{ token: string }> }): Promise<Response> {
  const { token } = await params;
  // The page's own token check: never build a request from anything else.
  if (!/^[A-Za-z0-9_-]+$/.test(token)) return notFound();

  let preview;
  try {
    preview = await getPreviewGroupJoin(token);
  } catch (err) {
    if (err instanceof ApiNotFoundError) return notFound();
    throw err;
  }
  return renderStatusPreviewImage(groupInvitePreviewCard(preview), '', {
    headers: { 'Cache-Control': LIVE_PREVIEW_CACHE_CONTROL, ...NOINDEX_HEADER },
  });
}

export const GET = guardPreview(handle);
