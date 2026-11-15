import { livePreviewImage, previewDigest, type StatusPreviewCard } from './livePreview';
import type { PreviewImage } from './pageMetadata';

/** An operator's link preview (`/operators/[code]/history/card.png`), drawn
 * by `renderStatusPreviewImage` (`lib/livePreview.ts`). The operator's
 * history page has no status of its own (it charts delays over time), so
 * the card is neutral: the operator's name, how many lines it runs and what
 * the page shows. Pure: the name the page resolves and the line count. */

/** An operator's name: its TOC name, or `null` when the list can't name it
 * (the card then says "Train operator", never a raw code). `TfL` is not a
 * TOC. */
export function operatorName(code: string, tocs: readonly { code: string; name: string }[]): string | null {
  if (code === 'TfL') return 'TfL';
  return tocs.find((toc) => toc.code === code)?.name ?? null;
}

export function operatorPreviewCard(name: string | null, lineCount: number | null): StatusPreviewCard {
  return {
    band: { tone: 'informational', label: 'Operator history', aside: '' },
    title: name ?? 'Train operator',
    lead: lineCount === null || lineCount <= 0 ? null : `${lineCount} line${lineCount === 1 ? '' : 's'}`,
    chips: { names: [], more: 0 },
    rows: ['Delays and cancellations across its lines over time'],
  };
}

export function operatorPreviewImage(code: string, card: StatusPreviewCard, alt: string): PreviewImage {
  return livePreviewImage(`/operators/${encodeURIComponent(code)}/history/card.png`, previewDigest(card), alt);
}
