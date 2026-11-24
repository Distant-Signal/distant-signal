import { describe, expect, it } from 'vitest';
import { missingFieldsReason } from './missingFields';

describe('missingFieldsReason', () => {
  it('is null when nothing is missing', () => {
    expect(missingFieldsReason([])).toBeNull();
  });

  it('names one field', () => {
    expect(missingFieldsReason(['From'])).toBe('Fill in From.');
  });

  it('joins two and three fields in words', () => {
    expect(missingFieldsReason(['From', 'To'])).toBe('Fill in From and To.');
    expect(missingFieldsReason(['From', 'To', 'Time'])).toBe('Fill in From, To and Time.');
  });
});
