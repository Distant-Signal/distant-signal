/** Journey ids in a URL (DS-534). A journey has an opaque `publicId`
 * (`j_` and 32 lowercase hex digits, never all digits) and a deprecated
 * numeric `id`. `/journeys/{id}` takes either; links use the opaque one. */

const PUBLIC_JOURNEY_ID = /^j_[0-9a-f]{32}$/;
const LEGACY_JOURNEY_ID = /^\d+$/;

/** Whether `id` has the shape of a `publicId`. */
export function isPublicJourneyId(id: string): boolean {
  return PUBLIC_JOURNEY_ID.test(id);
}

/** Whether `id` is a deprecated numeric journey id. */
export function isLegacyJourneyId(id: string): boolean {
  return LEGACY_JOURNEY_ID.test(id);
}

/** `/journeys/{publicId}` with `query`'s entries, in order; a repeated key
 * keeps every value. Empty values are kept: `?break=` stays `?break=`. */
export function journeyUrlWithQuery(
  publicId: string,
  query: Record<string, string | string[] | undefined>,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue;
    for (const one of Array.isArray(value) ? value : [value]) params.append(key, one);
  }
  const search = params.toString();
  return `/journeys/${publicId}${search === '' ? '' : `?${search}`}`;
}
