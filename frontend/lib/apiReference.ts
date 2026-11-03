/** The personal API's reference (`/developers/api`), read at build time
 * from `lib/openapi-v1.json`: a byte-for-byte copy of the api's generated
 * OpenAPI document, `api-types/openapi/v1.json`, kept in step by
 * `scripts/sync-api-types.py` (docs/personal-api-tokens.md, "OpenAPI
 * document"). Nothing here fetches at runtime.
 *
 * The document's schema descriptions are the api's own code comments,
 * written for its developers, so the reference shows each field's name,
 * type and values but not those descriptions. The route summaries,
 * parameter descriptions and response descriptions are written for
 * clients, and are shown. */
import openapiDocument from './openapi-v1.json';

/** A JSON Schema, as far as the reference reads one. `true` is "any
 * value" (an untyped field). */
export type Schema =
  | boolean
  | {
      $ref?: string;
      type?: string | string[];
      format?: string;
      enum?: unknown[];
      const?: unknown;
      anyOf?: Schema[];
      oneOf?: Schema[];
      items?: Schema;
      properties?: Record<string, Schema>;
      required?: string[];
      default?: unknown;
      pattern?: string;
      description?: string;
    };

interface Parameter {
  name: string;
  in: string;
  required?: boolean;
  description?: string;
  schema?: Schema;
}

interface Header {
  description?: string;
  schema?: Schema;
}

interface Response {
  description?: string;
  headers?: Record<string, Header>;
  content?: Record<string, { schema?: Schema }>;
}

interface Operation {
  operationId: string;
  summary?: string;
  parameters?: Parameter[];
  responses: Record<string, Response>;
  security?: unknown[];
  'x-ds-scope'?: string;
}

export interface OpenApiDocument {
  openapi: string;
  info: { title: string; version: string; description?: string };
  servers: { url: string }[];
  paths: Record<string, Record<string, Operation>>;
  components: { schemas: Record<string, Schema> };
}

/** The committed document. The JSON import's inferred type must fit
 * `OpenApiDocument`, so a document this page can't read fails `tsc`. */
export const OPENAPI: OpenApiDocument = openapiDocument;

/** Where the API is served (`servers[0]`). */
export const API_BASE_URL: string = OPENAPI.servers[0]?.url ?? 'https://ds-api.cursed.solutions';

/** The live copy of the same document, which needs no token. */
export const OPENAPI_URL = `${API_BASE_URL}/v1/openapi.json`;

/** The poll interval the API asks for (its `DS-Poll-Interval` header). */
export const POLL_INTERVAL_SECONDS = 60;

/** The per-pod rate limits (docs/personal-api-tokens.md, "Limits"; chart
 * values `api.personalTokens.rateLimit`). The OpenAPI document doesn't
 * carry them; keep these in step with the chart's defaults. */
export const RATE_LIMITS: readonly { label: string; perMinute: number; burst: number }[] = [
  { label: 'Each token', perMinute: 30, burst: 10 },
  { label: 'Each token, on the train and departure routes', perMinute: 10, burst: 5 },
  { label: 'All of your tokens together', perMinute: 60, burst: 20 },
  { label: 'Requests with a bad token, from one address', perMinute: 10, burst: 10 },
];

/** What each status a route can answer means, with its error code. Every
 * status the document lists has an entry (`apiReference.test.ts`). */
export const STATUS_NOTES: Readonly<Record<string, { title: string; code: string | null; text: string }>> = {
  '200': { title: 'OK', code: null, text: 'The data, with its attribution.' },
  '304': {
    title: 'Not modified',
    code: null,
    text: 'Your If-None-Match header matched the ETag, so nothing changed. There is no body: keep using the copy you have.',
  },
  '401': {
    title: 'Unauthorized',
    code: 'invalid_token',
    text: 'No token, or one that is malformed, unknown, revoked, expired or unused for 90 days.',
  },
  '403': {
    title: 'Forbidden',
    code: 'insufficient_scope',
    text: "The token doesn't have the route's scope. Create a token that does.",
  },
  '404': { title: 'Not found', code: 'not_found', text: 'There is no route at this path.' },
  '405': { title: 'Method not allowed', code: null, text: 'Every route answers GET and HEAD only.' },
  '429': {
    title: 'Too many requests',
    code: 'rate_limited',
    text: 'Over a rate limit. Wait the number of seconds in the Retry-After header, then try again.',
  },
};

/** A field's type, in words. */
export interface TypeInfo {
  /** "string", "integer", "array of objects", "object (any fields)". */
  label: string;
  /** May be `null`. */
  nullable: boolean;
  /** The values a string can take, when the schema lists them. */
  values: string[];
}

/** One row of a response's field table. */
export interface FieldRow {
  /** The field's whole path, `legs[].stops[].platform`. */
  path: string;
  /** The part before the field's own name, `legs[].stops[].`, or ''. */
  parent: string;
  name: string;
  type: TypeInfo;
  /** In every response (the schema's `required`), even if `null`. */
  required: boolean;
}

export interface ParameterDoc {
  name: string;
  /** "path" or "query". */
  location: string;
  required: boolean;
  type: TypeInfo;
  description: string;
  /** The default, as JSON text, when it has one. */
  defaultValue: string | null;
}

/** Who may call a route: anyone, any token, or a token with this scope. */
export type RouteAccess = { kind: 'public' } | { kind: 'anyToken' } | { kind: 'scope'; scope: string };

/** What a route's `data` is. */
export type RouteData =
  /** `rows` are the object's fields, or each item's for an array. */
  | { kind: 'fields'; type: TypeInfo; rows: FieldRow[] }
  /** TfL-shaped objects whose fields the document leaves open on purpose. */
  | { kind: 'open'; type: TypeInfo }
  /** The OpenAPI document itself, not wrapped in `{data, attribution}`. */
  | { kind: 'document' };

export interface RouteDoc {
  /** The page anchor, from the operation id. */
  id: string;
  method: string;
  path: string;
  summary: string;
  access: RouteAccess;
  parameters: ParameterDoc[];
  data: RouteData;
  /** The 200's `Cache-Control`, when the document names it. */
  cacheControl: string | null;
  /** Every status the document lists for it, in order. */
  statuses: string[];
}

function refName(ref: string): string {
  return ref.slice(ref.lastIndexOf('/') + 1);
}

/** `schema` with every `$ref` followed. */
export function resolve(schema: Schema | undefined, doc: OpenApiDocument = OPENAPI): Schema {
  let current: Schema = schema ?? true;
  for (let hops = 0; typeof current === 'object' && current.$ref && hops < 32; hops += 1) {
    current = doc.components.schemas[refName(current.$ref)] ?? true;
  }
  return current;
}

function isNullSchema(schema: Schema): boolean {
  return typeof schema === 'object' && schema.type === 'null';
}

/** A listed value as the page shows it: a string bare, anything else as
 * JSON (`true`, `3`). */
function valueText(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

/** The string values a schema lists (`enum`, `const`, or a `oneOf` of
 * them), or null when it isn't such a list. */
function listedValues(schema: Schema, doc: OpenApiDocument): string[] | null {
  const s = resolve(schema, doc);
  if (typeof s !== 'object') return null;
  if (s.enum) return s.enum.filter((value) => value !== null).map(valueText);
  if (s.const !== undefined) return [valueText(s.const)];
  const variants = s.oneOf ?? s.anyOf;
  if (!variants) return null;
  const values: string[] = [];
  for (const variant of variants) {
    if (isNullSchema(variant)) continue;
    const inner = listedValues(variant, doc);
    if (!inner) return null;
    values.push(...inner);
  }
  return values;
}

function formatLabel(format: string | undefined): string | null {
  switch (format) {
    case 'date-time':
      return 'date and time';
    case 'date':
      return 'date';
    case 'uri':
      return 'URL';
    default:
      return null;
  }
}

function isOpenObject(s: Schema): boolean {
  return typeof s === 'object' && s.type === 'object' && !s.properties;
}

function joinAlternatives(labels: string[]): string {
  return [...new Set(labels)].join(' or ');
}

/** A schema's type in words. */
export function typeInfo(schema: Schema | undefined, doc: OpenApiDocument = OPENAPI): TypeInfo {
  const s = resolve(schema, doc);
  if (s === true || s === false) return { label: 'any value', nullable: false, values: [] };

  const variants = s.anyOf ?? s.oneOf;
  if (variants) {
    const nullable = variants.some(isNullSchema);
    const values = listedValues(s, doc);
    if (values) return { label: 'string', nullable, values };
    const rest = variants.filter((variant) => !isNullSchema(variant)).map((variant) => typeInfo(variant, doc));
    return {
      label: joinAlternatives(rest.map((info) => info.label)),
      nullable: nullable || rest.some((info) => info.nullable),
      values: rest.flatMap((info) => info.values),
    };
  }

  const types = Array.isArray(s.type) ? s.type : s.type ? [s.type] : [];
  const nullable = types.includes('null');
  const values = s.enum || s.const !== undefined ? (listedValues(s, doc) ?? []) : [];
  const labels = types
    .filter((type) => type !== 'null')
    .map((type) => {
      if (type === 'array') {
        const item = typeInfo(s.items, doc);
        return `array of ${item.label === 'object' || item.label === 'object (any fields)' ? 'objects' : item.label}`;
      }
      if (type === 'object') return isOpenObject(s) ? 'object (any fields)' : 'object';
      if (type === 'string') return formatLabel(s.format) ?? 'string';
      return type;
    });
  if (labels.length === 0) return { label: s.properties ? 'object' : 'any value', nullable, values };
  return { label: joinAlternatives(labels), nullable, values };
}

/** The object a field holds, looking through `null`, arrays and refs, or
 * null when it holds no object with fields. `array` says it was a list. */
function innerObject(
  schema: Schema,
  doc: OpenApiDocument,
): { object: Schema; ref: string | null; array: boolean } | null {
  let current: Schema = schema;
  let array = false;
  let ref: string | null = null;
  for (let hops = 0; hops < 32; hops += 1) {
    if (typeof current !== 'object') return null;
    if (current.$ref) {
      ref = refName(current.$ref);
      current = resolve(current, doc);
      continue;
    }
    const variants = current.anyOf ?? current.oneOf;
    if (variants) {
      const rest = variants.filter((variant) => !isNullSchema(variant));
      if (rest.length !== 1 || !rest[0]) return null;
      current = rest[0];
      continue;
    }
    const types = Array.isArray(current.type) ? current.type : [current.type];
    if (types.includes('array')) {
      array = true;
      current = current.items ?? true;
      continue;
    }
    return current.properties ? { object: current, ref, array } : null;
  }
  return null;
}

/** Every field of an object schema, nested fields after their parent,
 * each named by its whole path. A type that contains itself is listed
 * once. */
export function fieldRows(
  schema: Schema,
  doc: OpenApiDocument = OPENAPI,
  parent = '',
  seen: ReadonlySet<string> = new Set(),
): FieldRow[] {
  const s = resolve(schema, doc);
  if (typeof s !== 'object' || !s.properties) return [];
  const required = new Set(s.required ?? []);
  const rows: FieldRow[] = [];
  for (const [name, property] of Object.entries(s.properties)) {
    const path = `${parent}${name}`;
    rows.push({ path, parent, name, type: typeInfo(property, doc), required: required.has(name) });
    const inner = innerObject(property, doc);
    if (inner && !(inner.ref && seen.has(inner.ref))) {
      const nextSeen = inner.ref ? new Set([...seen, inner.ref]) : seen;
      rows.push(...fieldRows(inner.object, doc, `${path}${inner.array ? '[]' : ''}.`, nextSeen));
    }
  }
  return rows;
}

function routeAccess(operation: Operation): RouteAccess {
  const scope = operation['x-ds-scope'];
  if (scope) return { kind: 'scope', scope };
  if (Array.isArray(operation.security) && operation.security.length === 0) return { kind: 'public' };
  return { kind: 'anyToken' };
}

function routeData(operation: Operation, doc: OpenApiDocument): RouteData {
  const schema = resolve(operation.responses['200']?.content?.['application/json']?.schema, doc);
  const envelope = typeof schema === 'object' ? schema.properties : undefined;
  const data = envelope?.data;
  if (!data || !envelope.attribution) return { kind: 'document' };
  const type = typeInfo(data, doc);
  const inner = innerObject(data, doc);
  if (!inner) return { kind: 'open', type };
  // A list's rows describe each item: `data` is "array of objects", and
  // its rows are the item's fields.
  return { kind: 'fields', type, rows: fieldRows(inner.object, doc, '', new Set(inner.ref ? [inner.ref] : [])) };
}

/** "getV1LineIdsStatus" to "get-v1-line-ids-status", a page anchor. */
export function routeAnchor(operationId: string): string {
  return operationId
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .toLowerCase();
}

/** Every route in the document, in the document's order. */
export function routeDocs(doc: OpenApiDocument = OPENAPI): RouteDoc[] {
  const routes: RouteDoc[] = [];
  for (const [path, item] of Object.entries(doc.paths)) {
    for (const [method, operation] of Object.entries(item)) {
      const cache = operation.responses['200']?.headers?.['Cache-Control']?.description ?? null;
      routes.push({
        id: routeAnchor(operation.operationId),
        method: method.toUpperCase(),
        path,
        summary: operation.summary ?? '',
        access: routeAccess(operation),
        parameters: (operation.parameters ?? []).map((parameter) => {
          const s = resolve(parameter.schema, doc);
          const defaultValue = typeof s === 'object' && s.default !== undefined ? JSON.stringify(s.default) : null;
          return {
            name: parameter.name,
            location: parameter.in,
            required: parameter.required ?? false,
            type: typeInfo(parameter.schema, doc),
            description: parameter.description ?? '',
            defaultValue,
          };
        }),
        data: routeData(operation, doc),
        cacheControl: cache,
        statuses: Object.keys(operation.responses),
      });
    }
  }
  return routes;
}

/** The headings the reference groups routes under, in page order. A
 * scope the page doesn't know yet gets its own group, named by itself. */
const KNOWN_GROUPS: readonly { key: string; title: string }[] = [
  { key: 'public', title: 'No token needed' },
  { key: 'anyToken', title: 'Your token' },
  { key: 'journeys:read', title: 'Journeys' },
  { key: 'lines:read', title: 'Lines and stations' },
  { key: 'trains:read', title: 'Trains' },
  { key: 'preferences:read', title: 'Preferences' },
];

export interface RouteGroup {
  key: string;
  title: string;
  /** The scope its routes need, when they need one. */
  scope: string | null;
  routes: RouteDoc[];
}

function groupKey(access: RouteAccess): string {
  return access.kind === 'scope' ? access.scope : access.kind;
}

/** The routes grouped by who may call them. */
export function routeGroups(routes: readonly RouteDoc[] = routeDocs()): RouteGroup[] {
  const keys = [...KNOWN_GROUPS.map((group) => group.key)];
  for (const route of routes) {
    const key = groupKey(route.access);
    if (!keys.includes(key)) keys.push(key);
  }
  return keys
    .map((key) => ({
      key,
      title: KNOWN_GROUPS.find((group) => group.key === key)?.title ?? key,
      scope: key === 'public' || key === 'anyToken' ? null : key,
      routes: routes.filter((route) => groupKey(route.access) === key),
    }))
    .filter((group) => group.routes.length > 0);
}

/** The fields of `{data, attribution}`'s attribution. */
export function attributionRows(doc: OpenApiDocument = OPENAPI): FieldRow[] {
  return fieldRows({ $ref: '#/components/schemas/Attribution' }, doc);
}

/** The fields of an error body, `{error, message}`. */
export function errorRows(doc: OpenApiDocument = OPENAPI): FieldRow[] {
  return fieldRows({ $ref: '#/components/schemas/ErrorBody' }, doc);
}
