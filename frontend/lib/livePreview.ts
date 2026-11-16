import { formatTime, formatWeekdayShortDate, londonDayKey } from './dateFormat';
import type { PreviewImage } from './pageMetadata';
import type { SeverityGroup } from './severity';

/** Link-preview cards that show live data (an incident, a line, a
 * station, a train): what they have in common. Each page maps its own data
 * to a `StatusPreviewCard` (`lib/incidentPreview.ts`, `lib/linePreview.ts`,
 * `lib/stationPreview.ts`, `lib/trainPreview.ts`), `renderStatusPreviewImage` draws it, and the
 * page lists the image itself with a `?v=` digest of what it shows.
 *
 * Chat apps cache a preview image by URL, often for hours, and some never
 * fetch it again. So:
 * - the image says when its data is from, and that it is a snapshot;
 * - the page's `og:image` carries `?v=`, a digest of the state the card
 *   shows (never of a timestamp), so a changed state is a new URL and a
 *   link shared afterwards gets a fresh card, while an unchanged one keeps
 *   its cached image;
 * - the image route reads anonymously through Next's data cache for
 *   `LIVE_PREVIEW_REVALIDATE_SECONDS` and answers with
 *   `LIVE_PREVIEW_CACHE_CONTROL`, so a burst of unfurls costs one api call
 *   per minute per page and the CDN can serve the rest;
 * - `og:description` stays evergreen: the live part is in the image only.
 *
 * Caching: every card route is `dynamic = 'force-dynamic'`, never ISR.
 * Next's ISR keeps an entry for a year and serves a stale one once while
 * it regenerates, so a revoked share link's card would come back once, a
 * failed read's 503 would replace a good card for a minute, and every
 * well-formed id a client tried would leave a file on disk. Instead the
 * api reads are cached (only 200s are stored), the PNG is drawn per
 * request, the CDN in front caches it by `Cache-Control`, and
 * `guardPreview` (`lib/previewRoute.ts`) limits each client's renders.
 * The capability-token cards (`TOKEN_PREVIEW_CACHE_CONTROL`) cache
 * nothing anywhere. */

/** How long an image route's api reads are shared, in seconds. */
export const LIVE_PREVIEW_REVALIDATE_SECONDS = 60;

/** A minute fresh, then served stale while one request fetches the new
 * state. A changed state also gets a new `?v=` on the page, so a link
 * shared after the change never waits for this. */
export const LIVE_PREVIEW_CACHE_CONTROL = `public, max-age=${LIVE_PREVIEW_REVALIDATE_SECONDS}, s-maxage=${LIVE_PREVIEW_REVALIDATE_SECONDS}, stale-while-revalidate=300`;

/** A capability-token card (`/journeys/shared/<token>/card.png`,
 * `/groups/join/<token>/card.png`), its 404 and its errors: stored by no
 * CDN or shared cache, so once the owner revokes the link the next fetch
 * of its card is a 404. Its api read is uncached too
 * (`getPreviewSharedJourney`, `getPreviewGroupJoin`). A chat app that
 * already copied the image keeps its copy: nothing here can reach that. */
export const TOKEN_PREVIEW_CACHE_CONTROL = 'private, no-store';

/** Sent with a capability-token page's card image
 * (`/journeys/shared/<token>/card.png`, `/groups/join/<token>/card.png`) so
 * no search engine that reaches it indexes it. */
export const NOINDEX_HEADER = { 'X-Robots-Tag': 'noindex' } as const;

/** A title this long always shows whole on the card (two or three lines
 * at `cardTitleFontSize`); a longer one may be clamped. */
export const TITLE_FITS_LENGTH = 90;

/** A band's colour: a severity group's (`StatusBadge`), or a delay's
 * (`DelayBadge`'s orange late and teal early, for a train card). */
export type PreviewBandTone = SeverityGroup | 'late' | 'early';

/** What `renderStatusPreviewImage` draws. */
export interface StatusPreviewCard {
  /** The coloured band, in the severity pill's colours: `label` carries
   * the state in words, the colour only repeats it. `aside` is its time
   * ("Updated Fri 30 Oct, 13:58", "As of 14:03"). */
  band: { tone: PreviewBandTone; label: string; aside: string };
  /** The page's subject, clamped to three lines. */
  title: string;
  /** The first fact, a little larger: where an incident is, what is wrong
   * on a line or at a station. */
  lead: string | null;
  /** Lines, as chips: those that fit, then "and N more". */
  chips: { names: string[]; more: number };
  /** Facts, one line each, cut short with an ellipsis. Empty ones are
   * left out by the mapper, never drawn blank. */
  rows: string[];
}

/** An 8-hex-digit digest (FNV-1a, 32-bit) of `value` as JSON, for `?v=`.
 * A collision only costs a stale cached image. */
export function previewDigest(value: unknown): string {
  const input = JSON.stringify(value);
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/** The page's own preview image, listed explicitly in its metadata. */
export function livePreviewImage(path: string, digest: string, alt: string): PreviewImage {
  return { url: `${path}?v=${digest}`, alt, width: 1200, height: 630, type: 'image/png' };
}

/** "Fri 30 Oct, 13:50" in UK time. */
export function previewWhen(value: string): string {
  return `${formatWeekdayShortDate(value)}, ${formatTime(value)}`;
}

/** "Fri 30 Oct, 12:20 to 12:56", or both dates when the days differ. */
export function previewSpan(from: string, to: string): string {
  return londonDayKey(from) === londonDayKey(to)
    ? `${previewWhen(from)} to ${formatTime(to)}`
    : `${previewWhen(from)} to ${previewWhen(to)}`;
}

/** "A", "A and B", "A, B and C", "A, B, C and 2 more". */
export function listPhrase(items: readonly string[], max = 3): string {
  if (items.length <= 1) return items[0] ?? '';
  if (items.length > max) return `${items.slice(0, max).join(', ')} and ${items.length - max} more`;
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** Whitespace collapsed, ends trimmed. */
export function tidy(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** Plain text from a status reason that may carry HTML (Knowledgebase
 * text): tags dropped, the few entities it uses decoded, whitespace
 * collapsed. The image renderer draws text, never markup. */
export function plainText(text: string): string {
  return tidy(
    text
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&#39;|&apos;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&'),
  );
}

/** A failed read of the api behind a card: the chat app can retry, so it
 * is cached for seconds, never as long as a card (`LIVE_PREVIEW_CACHE_CONTROL`). */
export const PREVIEW_ERROR_CACHE_CONTROL = 'public, max-age=10, s-maxage=10';

/** True for a real calendar date, `YYYY-MM-DD` ("2026-02-30" is not). */
export function isCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** An api-supplied title for `<title>` and `og:title`: whitespace tidied,
 * cut at a word boundary under `max` characters, with no ellipsis (the
 * copy rules ban one), `fallback` when nothing is left. */
export function boundedTitle(text: string, fallback: string, max = 100): string {
  const tidied = tidy(text);
  if (tidied === '') return fallback;
  if (tidied.length <= max) return tidied;
  const cut = tidied.slice(0, max);
  const space = cut.lastIndexOf(' ');
  const atWord = space > 0 ? cut.slice(0, space).replace(/[\s,;:.-]+$/, '') : '';
  return atWord === '' ? cut : atWord;
}

/** An api-supplied credit for a card, tidied and bounded so it can't take
 * the card's room. */
export function boundedCredit(text: string, max = 300): string {
  return boundedTitle(text, '', max);
}
