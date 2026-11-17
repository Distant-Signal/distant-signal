/** Opaque ids for legs, tracked trains and push devices (DS-534). Each has a
 * `publicId` (a one-letter prefix, `_` and 32 lowercase hex digits: `l_` a
 * leg, `t_` a tracked train, `d_` a device; never all digits) beside the
 * deprecated numeric `id`. Every route takes either; the app sends the opaque
 * one. Journeys' `j_` ids are in `journeyId.ts`. */

const PUBLIC_TRACKING_ID = /^t_[0-9a-f]{32}$/;
const LEGACY_ID = /^\d+$/;

/** Whether `id` has the shape of a tracked train's `publicId`. */
export function isPublicTrackingId(id: string): boolean {
  return PUBLIC_TRACKING_ID.test(id);
}

/** Whether `id` is a deprecated numeric id. */
export function isLegacyId(id: string): boolean {
  return LEGACY_ID.test(id);
}

/** What to send the api for an object: its opaque id, or the numeric one
 * where the api returned none. Rows stored before the opaque ids carry an
 * empty `publicId` (an alternatives or break set, a replaced leg's entry in
 * `replacesLegPublicIds`), so a blank or missing id falls back. */
export function publicRef(publicId: string | null | undefined, id: number): string {
  return publicId ? publicId : String(id);
}

/** A journey leg's reference for a path, body or key. */
export function legRef(leg: { id: number; publicId: string }): string {
  return publicRef(leg.publicId, leg.id);
}

/** A tracked train's reference, from its state or list row. */
export function trackingRef(train: { id: number; publicId: string }): string {
  return publicRef(train.publicId, train.id);
}

/** Whether `leg` is the open break's trigger: by the opaque id, or by the
 * numeric one where a break stored before the opaque ids has none. */
export function isTriggerLeg(
  leg: { id: number; publicId: string },
  openBreak: { triggerLegId: number | null; triggerLegPublicId: string | null },
): boolean {
  if (openBreak.triggerLegPublicId) return leg.publicId === openBreak.triggerLegPublicId;
  return openBreak.triggerLegId !== null && leg.id === openBreak.triggerLegId;
}
