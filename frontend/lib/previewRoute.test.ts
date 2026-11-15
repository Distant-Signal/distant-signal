import { describe, expect, it } from 'vitest';
import { INCIDENT_ID } from './incidents';
import { boundedCredit, boundedTitle, isCalendarDate, PREVIEW_ERROR_CACHE_CONTROL } from './livePreview';
import { guardPreview } from './previewRoute';
import { stationCreditIds } from './stationPreview';
import { previewTitle } from './incidentPreview';

describe('guardPreview', () => {
  it('passes a response through', async () => {
    const response = new Response('ok');
    expect(await guardPreview(() => Promise.resolve(response))()).toBe(response);
  });

  it('turns anything thrown into a short-lived 503 a chat app can retry', async () => {
    const response = await guardPreview(() => Promise.reject(new Error('api down')))();
    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe(PREVIEW_ERROR_CACHE_CONTROL);
    expect(response.headers.get('cache-control')).toMatch(/max-age=10$|max-age=10,/);
    expect(response.headers.get('retry-after')).toBe('30');
  });
});

describe('isCalendarDate', () => {
  it.each(['2026-10-30', '2028-02-29', '2026-12-31'])('accepts %s', (value) => {
    expect(isCalendarDate(value)).toBe(true);
  });

  it.each(['2026-02-30', '2026-13-01', '2026-00-10', '2027-02-29', '2026-1-1', '26-10-30', '2026-10-30T00:00', ''])(
    'rejects %j',
    (value) => {
      expect(isCalendarDate(value)).toBe(false);
    },
  );
});

describe('INCIDENT_ID', () => {
  it.each(['12345', 'FIXTURE-INCIDENT-1', 'E879EB6C791C470AB6C2A7458AE68C3B', 'a_b-c'])('accepts %s', (id) => {
    expect(INCIDENT_ID.test(id)).toBe(true);
  });

  it.each(['', '../x', 'a b', 'a/b', 'a?b', 'x'.repeat(129)])('rejects %j', (id) => {
    expect(INCIDENT_ID.test(id)).toBe(false);
  });
});

describe('boundedTitle and boundedCredit', () => {
  it('tidies, keeps a short title whole and falls back when empty', () => {
    expect(boundedTitle('  Delays   at\nLewes ', 'Incident')).toBe('Delays at Lewes');
    expect(boundedTitle('   ', 'Incident')).toBe('Incident');
  });

  it('cuts a long title at a word, with no ellipsis or trailing punctuation', () => {
    const long = `Disruption between Chester and Llandudno Junction, ${'with a very long explanation, '.repeat(8)}`;
    const cut = boundedTitle(long, 'Incident');
    expect(cut.length).toBeLessThanOrEqual(100);
    expect(long.startsWith(cut)).toBe(true);
    expect(cut).not.toMatch(/[.,;:\s-]$|…|\.\.\./);
  });

  it('cuts one unbroken word at the limit', () => {
    expect(boundedTitle('x'.repeat(500), 'Incident')).toHaveLength(100);
  });

  it('bounds a credit and leaves an empty one empty', () => {
    expect(boundedCredit('licence text '.repeat(60)).length).toBeLessThanOrEqual(300);
    expect(boundedCredit('')).toBe('');
  });
});

describe('previewTitle', () => {
  it('is plain text, without a leading CLEARED, and never empty', () => {
    expect(previewTitle('CLEARED: <b>Delays</b> at&nbsp;Lewes')).toBe('Delays at Lewes');
    expect(previewTitle('   ')).toBe('Incident');
    expect(previewTitle('CLEARED:')).toBe('CLEARED:');
  });
});

describe('stationCreditIds', () => {
  const report = (id: string) => ({ id }) as never;

  it('credits Network Rail wherever a National Rail status makes the claim, even "No disruptions"', () => {
    expect(stationCreditIds({ coverage: 'covered', reports: [] })).toEqual(['national-rail', 'network-rail']);
    expect(stationCreditIds({ coverage: 'covered', reports: [report('southern-x')] })).toEqual([
      'national-rail',
      'network-rail',
    ]);
  });

  it('credits TfL, and not Network Rail, for TfL lines alone, and both for a mix', () => {
    expect(stationCreditIds({ coverage: 'covered', reports: [report('tfl-victoria')] })).toEqual([
      'national-rail',
      'tfl',
    ]);
    expect(stationCreditIds({ coverage: 'covered', reports: [report('tfl-victoria'), report('lner')] })).toEqual([
      'national-rail',
      'network-rail',
      'tfl',
    ]);
  });

  it('claims no status for a station with no tracked line', () => {
    expect(stationCreditIds({ coverage: 'none' })).toEqual(['national-rail']);
  });
});
