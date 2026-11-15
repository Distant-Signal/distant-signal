import { getPreviewLineStatus } from './api';
import { linePreviewImage } from './linePreview';
import type { PreviewImage } from './pageMetadata';

/** A line's own card (`/lines/{id}/card.png`), for the pages that are about
 * the same line but not its status page (its history, its timetable): the
 * same image and the same minute-cached preview read the card route uses,
 * so the version and the image agree. An outage or a line with no status
 * row leaves the URL versioned by "no status": the card route still draws
 * it. */
export async function lineCardImage(id: string, name: string, alt: string): Promise<PreviewImage> {
  const report = await getPreviewLineStatus(id)
    .then((reports) => reports[0] ?? null)
    .catch(() => null);
  return linePreviewImage(id, name, report, alt);
}
