import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithMantine } from '@/test/render';
import { NON_AFFILIATION } from '@/lib/api-types';
import openapiDocument from '@/lib/openapi-v1.json';
import DevelopersPage, { metadata } from './page';

describe('/developers', () => {
  it('has its own title and description', () => {
    expect(metadata.title).toBe('Developers');
    expect(metadata.description).toBeTruthy();
  });

  it('says how to create a token and use it', () => {
    renderWithMantine(DevelopersPage());
    expect(screen.getByRole('heading', { level: 1, name: 'Developers' })).toBeInTheDocument();
    expect(screen.getByText(/can only read, never change anything/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Connected apps' })).toHaveAttribute('href', '/account/connected-apps');
    const base = openapiDocument.servers[0]?.url ?? '';
    expect(screen.getAllByText(base).length).toBeGreaterThan(0);
    expect(screen.getByText(/curl -H "Authorization: Bearer \$DS_TOKEN"/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'API reference' })).toHaveAttribute('href', '/developers/api');
  });

  it('lists every scope with what it reads', () => {
    renderWithMantine(DevelopersPage());
    const table = screen.getByRole('table', { name: 'Token scopes' });
    expect(table).toHaveTextContent('lines:read');
    expect(table).toHaveTextContent('See line status and station disruption');
  });

  it('links to the recipes and states that the service is unofficial', () => {
    renderWithMantine(DevelopersPage());
    expect(screen.getByRole('link', { name: 'Home Assistant (opens in a new tab)' })).toHaveAttribute(
      'href',
      expect.stringMatching(/\/blob\/main\/docs\/recipes\/home-assistant\.md$/),
    );
    expect(screen.getByRole('link', { name: 'Apple Shortcuts (opens in a new tab)' })).toBeInTheDocument();
    expect(screen.getAllByText(new RegExp(NON_AFFILIATION.slice(0, 40))).length).toBeGreaterThan(0);
  });
});
