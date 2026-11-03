import { describe, expect, it } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { renderWithMantine } from '@/test/render';
import { elementsThatEndAParagraph } from '@/test/htmlNesting';
import openapiDocument from '@/lib/openapi-v1.json';
import ApiReferencePage, { metadata } from './page';

/** Every method and path in the committed OpenAPI copy, read directly, so
 * a route added to the document must show up on the page. */
const DOCUMENT_ROUTES: string[] = Object.entries(
  openapiDocument.paths as Record<string, Record<string, unknown>>,
).flatMap(([path, item]) => Object.keys(item).map((method) => `${method.toUpperCase()} ${path}`));

describe('/developers/api', () => {
  it('has its own title and description', () => {
    expect(metadata.title).toBe('API reference');
    expect(metadata.description).toMatch(/personal API/);
  });

  it('has a section, and a contents link, for every route in the OpenAPI document', () => {
    renderWithMantine(ApiReferencePage());
    const contents = screen.getByRole('navigation', { name: 'Routes' });
    expect(DOCUMENT_ROUTES.length).toBeGreaterThan(0);
    for (const route of DOCUMENT_ROUTES) {
      const section = screen.getByRole('region', { name: route });
      expect(within(section).getByRole('heading', { level: 3, name: route })).toBeInTheDocument();
      const link = within(contents).getByRole('link', { name: route });
      expect(link.getAttribute('href')).toBe(`#${section.id}`);
    }
    // No section for a route the document doesn't have.
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(DOCUMENT_ROUTES.length);
  });

  it("names each route's scope, parameters and response", () => {
    renderWithMantine(ApiReferencePage());
    const line = screen.getByRole('region', { name: 'GET /v1/Line/{ids}/Status' });
    expect(within(line).getByText('lines:read')).toBeInTheDocument();
    expect(within(line).getByRole('table', { name: 'Parameters of GET /v1/Line/{ids}/Status' })).toBeInTheDocument();
    expect(within(line).getByText(/in TfL's shape/)).toBeInTheDocument();

    const me = screen.getByRole('region', { name: 'GET /v1/me' });
    expect(within(me).getByText(/Needs any token/)).toBeInTheDocument();
    const fields = within(me).getByRole('table', { name: 'Response fields of GET /v1/me' });
    expect(within(fields).getByText('expiresAt')).toBeInTheDocument();
  });

  it('keeps a long field table behind a disclosure', async () => {
    renderWithMantine(ApiReferencePage());
    const journey = screen.getByRole('region', { name: 'GET /v1/Journeys/{journey_id}' });
    const toggle = within(journey).getByRole('button', { name: /GET \/v1\/Journeys\/\{journey_id\}: Response fields/ });
    expect(within(journey).queryByRole('table', { name: /Response fields/ })).not.toBeInTheDocument();
    fireEvent.click(toggle);
    const table = await within(journey).findByRole('table', {
      name: 'Response fields of GET /v1/Journeys/{journey_id}',
    });
    expect(within(table).getAllByText('legs[].').length).toBeGreaterThan(0);
  });

  it('explains the envelope, polling, rate limits and every error status', () => {
    renderWithMantine(ApiReferencePage());
    expect(screen.getByRole('table', { name: 'Fields of attribution' })).toBeInTheDocument();
    expect(screen.getByText(/Show the attribution wherever you show the data/)).toBeInTheDocument();
    expect(screen.getAllByText('If-None-Match').length).toBeGreaterThan(0);
    const limits = screen.getByRole('table', { name: 'Rate limits' });
    expect(within(limits).getByText('Each token')).toBeInTheDocument();
    const statuses = screen.getByRole('table', { name: 'Status codes' });
    for (const status of ['304 Not modified', '401 Unauthorized', '403 Forbidden', '429 Too many requests']) {
      expect(within(statuses).getByText(status)).toBeInTheDocument();
    }
    expect(within(statuses).getByText(/Retry-After/)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'TfL-shaped objects' })).toBeInTheDocument();
  });

  it('keeps its markup valid inside paragraphs, so the browser parses it as rendered', () => {
    const { container } = renderWithMantine(ApiReferencePage());
    expect(elementsThatEndAParagraph(container)).toEqual([]);
  });
});
