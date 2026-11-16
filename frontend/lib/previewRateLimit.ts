/** A per-client limit on link-preview card renders (`guardPreview`).
 *
 * Every card read reaches the api without the visitor's `X-Real-IP` (so
 * Next's data cache is shared: `lib/api.ts`, "Reads for link-preview
 * images"), so the api's limiter puts all card traffic in the frontend
 * pod's bucket. Without a limit here, one client looping
 * `/train/<random uid>/<date>/card.png` would drain that bucket, and real
 * unfurls would fail, besides the image work each request costs.
 *
 * A fixed one-minute window per client IP, in memory, per pod. The IP is
 * the one the `/api/*` proxy trusts (`lib/clientIp.ts`); with none (local
 * development, a request that did not come through the tunnel) nothing is
 * limited, as there is nothing to key on. Generous enough for a chat
 * app's unfurler, whose requests mostly hit the CDN anyway. */

/** Renders one client may ask the origin for in a window. */
export const PREVIEW_RATE_LIMIT = 60;
export const PREVIEW_RATE_WINDOW_MS = 60_000;
/** Clients tracked at once; past this, finished windows are dropped, then
 * the oldest. Bounds the memory one address-hopping client can take. */
export const PREVIEW_RATE_MAX_CLIENTS = 10_000;

interface Window {
  start: number;
  count: number;
}

export class PreviewRateLimiter {
  private readonly windows = new Map<string, Window>();
  private readonly limit: number;
  private readonly windowMs: number;
  private readonly maxClients: number;

  constructor(limit = PREVIEW_RATE_LIMIT, windowMs = PREVIEW_RATE_WINDOW_MS, maxClients = PREVIEW_RATE_MAX_CLIENTS) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.maxClients = maxClients;
  }

  /** Counts one request from `client`: the seconds to wait when it is over
   * the limit, or null when it may go ahead. */
  take(client: string, now: number = Date.now()): number | null {
    const current = this.windows.get(client);
    if (current && now - current.start < this.windowMs) {
      if (current.count >= this.limit) return Math.max(1, Math.ceil((current.start + this.windowMs - now) / 1000));
      current.count += 1;
      return null;
    }
    if (current) this.windows.delete(client);
    else if (this.windows.size >= this.maxClients) this.evict(now);
    this.windows.set(client, { start: now, count: 1 });
    return null;
  }

  /** Clients tracked now (for tests). */
  get size(): number {
    return this.windows.size;
  }

  private evict(now: number): void {
    for (const [key, window] of this.windows) {
      if (now - window.start >= this.windowMs) this.windows.delete(key);
    }
    // Insertion order is window start order, so the first key is the oldest.
    while (this.windows.size >= this.maxClients) {
      const oldest = this.windows.keys().next().value;
      if (oldest === undefined) break;
      this.windows.delete(oldest);
    }
  }
}
