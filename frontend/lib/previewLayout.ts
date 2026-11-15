import { SNAPSHOT_NOTE } from './linePreview';
import { TITLE_FITS_LENGTH, type StatusPreviewCard } from './livePreview';

/** The vertical budget of a live card (`renderStatusPreviewImage`), worked
 * out before drawing instead of left to `overflow: hidden`, which clipped
 * a row in half or let it bleed into the credit. Everything is a fixed
 * height (single lines with an explicit line height), so the sum is exact
 * up to the title, whose line count is estimated from its length and font
 * size, on the safe side.
 *
 * When the card is too tall, in this order: the title is cut to two lines;
 * the lowest-priority facts go (the last row first, then the first); the
 * chips (operators, lines) go; the snapshot note moves into the credit
 * block, which is never clipped, so it can never be lost; the title is cut
 * to one line. The lead, the band and the credit always stay. */

export const CANVAS_HEIGHT = 630;
export const BAND_HEIGHT = 96;
const TOP_PADDING = 36;
/** A spacer under the facts instead of padding in the clipped container. */
export const FACTS_BOTTOM_SPACER = 16;
/** The wordmark (52) and its gap to the title (20). */
const WORDMARK_BLOCK = 72;
/** Least gap between the title block and the facts. */
const SECTION_GAP = 24;
const ITEM_GAP = 12;
export const LEAD_HEIGHT = 40;
export const CHIP_HEIGHT = 46;
export const ROW_HEIGHT = 35;
const CREDIT_LINE_HEIGHT = 23.4;
const CREDIT_PADDING = 28;
/** Plain credit text at 18px wraps under about this many characters a line
 * (a long unbroken address wraps earlier, so this is on the safe side). */
const CREDIT_CHARS_PER_LINE = 110;
const CONTENT_WIDTH = 1200 - 2 * 64;
const MAX_TITLE_LINES = 3;

/** Titles step down so three lines fit; past that the title is clamped. */
export function cardTitleFontSize(title: string): number {
  if (title.length <= 50) return 60;
  if (title.length <= TITLE_FITS_LENGTH) return 52;
  return 44;
}

/** Lines a title wraps to at `fontSize`, on the safe side (Geist averages
 * about half its size a character; words that do not fit wrap early). */
export function estimateTitleLines(title: string, fontSize: number): number {
  const perLine = Math.floor(CONTENT_WIDTH / (fontSize * 0.56));
  return Math.max(1, Math.ceil((title.length * 1.08) / perLine));
}

export function creditHeight(credit: string): number {
  if (credit === '') return CREDIT_PADDING;
  return Math.ceil(credit.length / CREDIT_CHARS_PER_LINE) * CREDIT_LINE_HEIGHT + CREDIT_PADDING;
}

export interface CardLayout {
  titleFontSize: number;
  /** Lines the title is clamped to. */
  titleLines: number;
  lead: string | null;
  showChips: boolean;
  rows: string[];
  /** The credit as drawn: the snapshot note joins it when it did not fit
   * among the facts. */
  credit: string;
  /** The estimated height of everything above the credit, and what the
   * layout has for it: `used <= available` always holds. */
  used: number;
  available: number;
}

export function layoutStatusCard(card: StatusPreviewCard, credit: string, chipCount: number): CardLayout {
  const titleFontSize = cardTitleFontSize(card.title);
  const titleNeeds = estimateTitleLines(card.title, titleFontSize);
  // Three or more facts leave room for two title lines only.
  let titleLines = Math.min(card.rows.length >= 3 ? 2 : MAX_TITLE_LINES, titleNeeds);
  let rows = [...card.rows];
  let showChips = chipCount > 0;
  let drawnCredit = credit;

  const measure = () => {
    const items = [card.lead ? LEAD_HEIGHT : 0, showChips ? CHIP_HEIGHT : 0, ...rows.map(() => ROW_HEIGHT)].filter(
      (height) => height > 0,
    );
    const facts = items.reduce((sum, height) => sum + height, 0) + Math.max(0, items.length - 1) * ITEM_GAP;
    const used =
      WORDMARK_BLOCK +
      titleLines * titleFontSize * 1.12 +
      (items.length > 0 ? SECTION_GAP + facts : 0) +
      FACTS_BOTTOM_SPACER;
    const available = CANVAS_HEIGHT - BAND_HEIGHT - TOP_PADDING - creditHeight(drawnCredit);
    return { used, available };
  };

  const steps: (() => boolean)[] = [
    () => {
      if (titleLines <= 2) return false;
      titleLines = 2;
      return true;
    },
    () => {
      // The last row that is not the snapshot note, then the first.
      const index = rows.findLastIndex((row) => row !== SNAPSHOT_NOTE);
      if (index < 0) return false;
      rows = rows.filter((_, i) => i !== index);
      return true;
    },
    () => {
      if (!showChips) return false;
      showChips = false;
      return true;
    },
    () => {
      if (!rows.includes(SNAPSHOT_NOTE)) return false;
      rows = rows.filter((row) => row !== SNAPSHOT_NOTE);
      drawnCredit = drawnCredit === '' ? SNAPSHOT_NOTE : `${SNAPSHOT_NOTE} · ${drawnCredit}`;
      return true;
    },
    () => {
      if (titleLines <= 1) return false;
      titleLines = 1;
      return true;
    },
  ];

  let { used, available } = measure();
  while (used > available) {
    let changed = false;
    for (const step of steps) {
      if (step()) {
        changed = true;
        break;
      }
    }
    if (!changed) break;
    ({ used, available } = measure());
  }
  return { titleFontSize, titleLines, lead: card.lead, showChips, rows, credit: drawnCredit, used, available };
}
