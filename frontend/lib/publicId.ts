/** Opaque ids for legs, tracked trains and push devices (DS-534). Each has a
 * `publicId` (a one-letter prefix, `_` and 32 lowercase hex digits: `l_` a
 * leg, `t_` a tracked train, `d_` a device, `r_` a regular journey (a
 * journey template), `b_` a journey break; never all digits) beside the
 * deprecated numeric `id`. Every route takes either; the app sends the opaque
 * one. Journeys' `j_` ids are in `journeyId.ts`. */

const PUBLIC_TRACKING_ID = /^t_[0-9a-f]{32}$/;
const PUBLIC_TEMPLATE_ID = /^r_[0-9a-f]{32}$/;
const PUBLIC_BREAK_ID = /^b_[0-9a-f]{32}$/;
const LEGACY_ID = /^\d+$/;

/** Whether `id` has the shape of a tracked train's `publicId`. */
export function isPublicTrackingId(id: string): boolean {
  return PUBLIC_TRACKING_ID.test(id);
}

/** Whether `id` has the shape of a regular journey's `publicId`. */
export function isPublicTemplateId(id: string): boolean {
  return PUBLIC_TEMPLATE_ID.test(id);
}

/** Whether `id` has the shape of a journey break's `publicId`. */
export function isPublicBreakId(id: string): boolean {
  return PUBLIC_BREAK_ID.test(id);
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

/** The references of a list of objects given as parallel arrays: the opaque
 * ids (`journeyPublicIds`) beside the deprecated numeric ones (`journeyIds`),
 * which an api may serve as 0. Compare these, never the numbers. */
export function refList(publicIds: readonly string[] | undefined, ids: readonly number[]): string[] {
  return ids.map((id, index) => publicRef(publicIds?.[index], id));
}

/** A journey's reference, from its list row or detail: the key to join on and
 * to send. Never its numeric id alone, which an api can serve as 0. */
export function journeyRef(journey: { id: number; publicId: string }): string {
  return publicRef(journey.publicId, journey.id);
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

/** A regular journey's reference for a path, body, link or key: its `r_` id,
 * or the numeric one from an api that has none yet. */
export function templateRef(template: { id: number; publicId?: string | null }): string {
  return publicRef(template.publicId, template.id);
}

/** A regular journey's reference from a response's pair of fields (a
 * `sourceTemplateId` beside its `sourceTemplatePublicId`), `null` for none. */
export function optionalTemplateRef(publicId: string | null | undefined, id: number | null): string | null {
  if (publicId) return publicId;
  return id === null ? null : String(id);
}

/** An open break's reference for a body or key: its `b_` id, else a real
 * numeric one, else `null`. A reader who is not the journey's owner gets
 * `id` 0, which is never an id. */
export function breakRef(openBreak: { id: number; publicId?: string | null }): string | null {
  if (openBreak.publicId) return openBreak.publicId;
  return openBreak.id > 0 ? String(openBreak.id) : null;
}

/** Whether a `?break=` link names this open break: by its `b_` id, or by the
 * numeric id a push queued before the opaque ids carries. */
export function matchesBreakParam(
  param: string | string[] | undefined,
  openBreak: { id: number; publicId?: string | null },
): boolean {
  if (typeof param !== 'string' || param === '') return false;
  if (openBreak.publicId && param === openBreak.publicId) return true;
  return openBreak.id > 0 && param === String(openBreak.id);
}
