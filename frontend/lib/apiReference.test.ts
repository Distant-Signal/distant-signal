import { describe, expect, it } from 'vitest';
import openapiDocument from './openapi-v1.json';
import {
  API_BASE_URL,
  attributionRows,
  errorRows,
  fieldRows,
  type OpenApiDocument,
  OPENAPI_URL,
  routeAnchor,
  routeDocs,
  routeGroups,
  STATUS_NOTES,
  typeInfo,
} from './apiReference';
import { isPersonalTokenScope } from './personalTokens';

/** Every method and path in the committed document, read without the
 * module under test. */
const DOCUMENT_ROUTES: [method: string, path: string][] = Object.entries(
  openapiDocument.paths as Record<string, Record<string, unknown>>,
).flatMap(([path, item]) => Object.keys(item).map((method): [string, string] => [method.toUpperCase(), path]));

function doc(schemas: OpenApiDocument['components']['schemas']): OpenApiDocument {
  return { openapi: '3.1.0', info: { title: 't', version: '1' }, servers: [], paths: {}, components: { schemas } };
}

describe('routeDocs', () => {
  it('lists every route in the OpenAPI document, once, in its order', () => {
    expect(DOCUMENT_ROUTES.length).toBeGreaterThan(0);
    expect(routeDocs().map((route) => [route.method, route.path])).toEqual(DOCUMENT_ROUTES);
  });

  it('gives every route a summary and a unique anchor', () => {
    const routes = routeDocs();
    for (const route of routes) expect(route.summary, route.path).not.toBe('');
    expect(new Set(routes.map((route) => route.id)).size).toBe(routes.length);
  });

  it('names only the scopes the Connected apps page offers', () => {
    for (const route of routeDocs()) {
      if (route.access.kind === 'scope') expect(isPersonalTokenScope(route.access.scope), route.path).toBe(true);
    }
  });

  it('explains every status a route can answer', () => {
    for (const route of routeDocs()) {
      for (const status of route.statuses) expect(STATUS_NOTES[status], `${route.path} ${status}`).toBeDefined();
    }
  });

  it('marks the TfL-shaped routes as open and the token-free ones as public', () => {
    const byPath = new Map(routeDocs().map((route) => [route.path, route]));
    expect(byPath.get('/v1/Line/{ids}/Status')?.data.kind).toBe('open');
    expect(byPath.get('/v1/status')?.access).toEqual({ kind: 'public' });
    expect(byPath.get('/v1/me')?.access).toEqual({ kind: 'anyToken' });
    expect(byPath.get('/v1/openapi.json')?.data).toEqual({ kind: 'document' });
    const journeys = byPath.get('/v1/Journeys/mine');
    expect(journeys?.data.kind).toBe('fields');
    if (journeys?.data.kind === 'fields') {
      expect(journeys.data.type.label).toBe('array of objects');
      expect(journeys.data.rows.length).toBeGreaterThan(0);
    }
  });

  it('puts every route in exactly one group', () => {
    const grouped = routeGroups().flatMap((group) => group.routes.map((route) => route.id));
    expect(grouped.sort()).toEqual(
      routeDocs()
        .map((route) => route.id)
        .sort(),
    );
  });
});

describe('the envelope', () => {
  it('describes the attribution and error bodies', () => {
    expect(attributionRows().map((row) => row.path)).toEqual(
      expect.arrayContaining(['sources', 'sources[].notice', 'statement']),
    );
    expect(errorRows().map((row) => row.path)).toEqual(['error', 'message']);
  });

  it('serves from the document own server', () => {
    expect(API_BASE_URL).toBe(openapiDocument.servers[0]?.url);
    expect(OPENAPI_URL).toBe(`${API_BASE_URL}/v1/openapi.json`);
  });
});

describe('typeInfo', () => {
  const schemas = doc({
    Kind: {
      oneOf: [
        { const: 'a', type: 'string' },
        { const: 'b', type: 'string' },
      ],
    },
    Thing: { type: 'object', properties: { id: { type: 'integer' } }, required: ['id'] },
  });

  it('reads nullable types, formats, arrays and listed values', () => {
    expect(typeInfo({ type: ['string', 'null'], format: 'date-time' }, schemas)).toEqual({
      label: 'date and time',
      nullable: true,
      values: [],
    });
    expect(typeInfo({ type: 'array', items: { $ref: '#/components/schemas/Thing' } }, schemas).label).toBe(
      'array of objects',
    );
    expect(typeInfo({ anyOf: [{ $ref: '#/components/schemas/Kind' }, { type: 'null' }] }, schemas)).toEqual({
      label: 'string',
      nullable: true,
      values: ['a', 'b'],
    });
    expect(typeInfo({ type: 'object' }, schemas).label).toBe('object (any fields)');
    expect(typeInfo(true, schemas).label).toBe('any value');
  });
});

describe('fieldRows', () => {
  it('lists nested fields by their whole path, after their parent', () => {
    const schemas = doc({
      Leg: {
        type: 'object',
        properties: { stop: { anyOf: [{ $ref: '#/components/schemas/Stop' }, { type: 'null' }] } },
      },
      Stop: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
    });
    const rows = fieldRows(
      { type: 'object', properties: { legs: { type: 'array', items: { $ref: '#/components/schemas/Leg' } } } },
      schemas,
    );
    expect(rows.map((row) => [row.path, row.parent, row.required])).toEqual([
      ['legs', '', false],
      ['legs[].stop', 'legs[].', false],
      ['legs[].stop.name', 'legs[].stop.', true],
    ]);
  });

  it('lists a type that contains itself once', () => {
    const schemas = doc({
      Node: { type: 'object', properties: { next: { $ref: '#/components/schemas/Node' }, id: { type: 'string' } } },
    });
    expect(fieldRows({ $ref: '#/components/schemas/Node' }, schemas).map((row) => row.path)).toEqual([
      'next',
      'next.next',
      'next.id',
      'id',
    ]);
  });
});

describe('routeAnchor', () => {
  it('turns an operation id into a page anchor', () => {
    expect(routeAnchor('getV1LineIdsStatus')).toBe('get-v1-line-ids-status');
  });
});
