import { createLogger } from './logger';
import { PREVIEW_ERROR_CACHE_CONTROL } from './livePreview';

const log = createLogger('lib/previewRoute');

/** Wraps a card route's `GET` so an api outage (anything thrown that the
 * route did not already turn into a 404) is a short-lived 503 a chat app
 * can retry, not an uncached 500 or a long-cached failure. */
export function guardPreview<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response>,
): (...args: Args) => Promise<Response> {
  return async (...args) => {
    try {
      return await handler(...args);
    } catch (err) {
      log.warn('link-preview image unavailable', { error: String(err) });
      return new Response('Preview unavailable', {
        status: 503,
        headers: { 'Cache-Control': PREVIEW_ERROR_CACHE_CONTROL, 'Retry-After': '30' },
      });
    }
  };
}
