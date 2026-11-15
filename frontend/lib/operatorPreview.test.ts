import { describe, expect, it } from 'vitest';
import { operatorName, operatorPreviewCard, operatorPreviewImage } from './operatorPreview';

describe('operatorName', () => {
  const tocs = [{ code: 'SW', name: 'South Western Railway' }];

  it('uses the TOC name, else null (never the raw code), and never looks TfL up', () => {
    expect(operatorName('SW', tocs)).toBe('South Western Railway');
    expect(operatorName('ZZ', tocs)).toBeNull();
    expect(operatorName('TfL', tocs)).toBe('TfL');
  });
});

describe('operatorPreviewCard', () => {
  it('is a neutral card with the name and line count', () => {
    expect(operatorPreviewCard('South Western Railway', 12)).toEqual({
      band: { tone: 'informational', label: 'Operator history', aside: '' },
      title: 'South Western Railway',
      lead: '12 lines',
      chips: { names: [], more: 0 },
      rows: ['Delays and cancellations across its lines over time'],
    });
  });

  it('is headed "Train operator" when the name is unknown', () => {
    expect(operatorPreviewCard(null, 3).title).toBe('Train operator');
  });

  it('says "1 line" and leaves the count out when it is unknown or zero', () => {
    expect(operatorPreviewCard('X', 1).lead).toBe('1 line');
    expect(operatorPreviewCard('X', null).lead).toBeNull();
    expect(operatorPreviewCard('X', 0).lead).toBeNull();
  });

  it('lists its card route with a digest', () => {
    expect(operatorPreviewImage('SW', operatorPreviewCard('X', 1), 'alt').url).toMatch(
      /^\/operators\/SW\/history\/card\.png\?v=[0-9a-f]{8}$/,
    );
  });
});
