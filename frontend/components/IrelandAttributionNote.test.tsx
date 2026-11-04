import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithMantine } from '@/test/render';
import { IrelandAttributionNote } from './IrelandAttributionNote';

function credits(): string[] {
  return [...document.querySelectorAll('[data-credit]')].map((node) => node.getAttribute('data-credit') ?? '');
}

describe('IrelandAttributionNote', () => {
  it("credits the NTA's timetable for Iarnród Éireann, with the CC BY 4.0 statement", () => {
    renderWithMantine(<IrelandAttributionNote credits={['republic-of-ireland']} />);
    expect(credits()).toEqual(['nta-gtfs']);
    expect(screen.getByRole('link', { name: /National Transport Authority/ })).toBeTruthy();
    expect(screen.getByRole('link', { name: /CC BY 4\.0/ })).toBeTruthy();
    expect(document.body.textContent).toContain('"as is"');
  });

  it('credits OpenDataNI under OGL v3.0 for NI Railways', () => {
    renderWithMantine(<IrelandAttributionNote credits={['northern-ireland']} />);
    expect(credits()).toEqual(['opendatani']);
    expect(document.body.textContent).toContain('Translink data from OpenDataNI');
    expect(screen.getByRole('link', { name: /Open Government Licence v3\.0/ })).toBeTruthy();
  });

  it('adds the live data credit once, and always links the full credits', () => {
    renderWithMantine(<IrelandAttributionNote credits={['republic-of-ireland', 'live', 'live']} />);
    expect(credits()).toEqual(['nta-gtfs', 'irish-rail-realtime']);
    expect(screen.getByRole('link', { name: 'Data credits' }).getAttribute('href')).toBe('/attribution');
  });
});
