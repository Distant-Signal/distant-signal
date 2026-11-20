/** The shape an api serves with `API_SERVE_NUMERIC_IDS=false`: every numeric
 * id that has an opaque sibling is 0 (DS-534). A fixture run through
 * `zeroNumericIds` is that response, so a test can run the same assertions
 * on the real-id shape (`keepNumericIds`) and the zeroed one:
 *
 *   describe.each(ID_SHAPES)('... (%s)', (_name, shape) => { ... shape(fixture) ... })
 *
 * The siblings are found by name, as the api's own rule does: `publicId`
 * beside `id`, `<x>PublicId` beside `<x>Id`, `<x>PublicIds` beside `<x>Ids`.
 * A numeric id with no opaque sibling (`deletedJourneyIds`, which sits
 * beside `deletedJourneyCount`) is left alone, and so is every opaque id. An id
 * already `null` stays `null`; an array of ids keeps its length and order,
 * each entry 0. */
export function zeroNumericIds<T>(value: T): T {
  return zero(value) as T;
}

/** The identity, for the real-id half of `ID_SHAPES`. */
export function keepNumericIds<T>(value: T): T {
  return value;
}

/** Both shapes, for `describe.each`. The opaque families it covers: `j_`
 * journeys, `l_` legs, `t_` tracked trains, `d_` devices, `r_` regular
 * journeys, `b_` breaks, `x_` deleted-journey records, `k_` personal tokens,
 * `w_` webhook destinations and `a_` time-away periods. */
export const ID_SHAPES: readonly (readonly [string, <T>(value: T) => T])[] = [
  ['numeric ids', keepNumericIds],
  ['numeric ids zeroed', zeroNumericIds],
];

function zero(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(zero);
  if (value === null || typeof value !== 'object') return value;
  const source = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(source)) {
    out[key] = hasOpaqueSibling(source, key) ? zeroed(entry) : zero(entry);
  }
  return out;
}

function zeroed(entry: unknown): unknown {
  if (typeof entry === 'number') return 0;
  if (Array.isArray(entry)) return entry.map((item) => (typeof item === 'number' ? 0 : item));
  return entry;
}

function hasOpaqueSibling(source: Record<string, unknown>, key: string): boolean {
  if (key === 'id') return 'publicId' in source;
  const match = /^(.+)(Ids?)$/.exec(key);
  if (match === null) return false;
  const [, stem = '', suffix = ''] = match;
  return `${stem}Public${suffix}` in source;
}
