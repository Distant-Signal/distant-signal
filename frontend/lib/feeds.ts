/** The api's Atom feeds of line status changes and incidents
 * (`crates/api/src/routes/feeds.rs`, docs/feeds.md), as the browser and a
 * feed reader reach them: through this app's `/api` proxy, which maps
 * `/api/feeds/...` to the api's `/public/feeds/...`. */

/** Every public National Rail and TfL line. */
export const NETWORK_FEED_PATH = '/api/feeds/network';

/** One line's feed, or null for a custom line: those are private, and the
 * api never puts them in a feed. */
export function lineFeedPath(id: string): string | null {
  return id.startsWith('custom-') ? null : `/api/feeds/lines/${encodeURIComponent(id)}`;
}

/** One operator's lines, as the operators page rolls them up. */
export function operatorFeedPath(code: string): string {
  return `/api/feeds/operators/${encodeURIComponent(code)}`;
}

/** A feed for `<link rel="alternate">` (`pageMetadata`'s `feed`). */
export interface FeedLinkTarget {
  url: string;
  title: string;
}

/** The `<link rel="alternate">` for the feed at `url`, which follows
 * `subject` (a line or operator name, or the whole network). */
export function feedTarget(url: string, subject: string): FeedLinkTarget {
  return { url, title: `${subject}: status changes and incidents` };
}
