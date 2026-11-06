import { describe, it, expect } from 'vitest';
import { asDivision, bankHolidayNote, divisionLabel } from './bankHolidays';

describe('divisionLabel', () => {
  it('names each division, England and Wales when none is chosen', () => {
    expect(divisionLabel(null)).toBe('England and Wales');
    expect(divisionLabel('scotland')).toBe('Scotland');
    expect(divisionLabel('northern-ireland')).toBe('Northern Ireland');
  });
});

describe('asDivision', () => {
  it('takes only the three divisions', () => {
    expect(asDivision('england-and-wales')).toBe('england-and-wales');
    expect(asDivision('wales')).toBeNull();
    expect(asDivision(null)).toBeNull();
  });
});

describe('bankHolidayNote', () => {
  it('names the bank holidays passed over, not a date skipped by hand', () => {
    expect(bankHolidayNote([])).toBeNull();
    expect(bankHolidayNote([{ date: '2027-05-28', reason: 'skipped' }])).toBeNull();
    expect(bankHolidayNote([{ date: '2027-05-31', reason: 'bank_holiday' }])).toBe('31 May 2027 is a bank holiday');
    expect(
      bankHolidayNote([
        { date: '2027-03-26', reason: 'bank_holiday' },
        { date: '2027-03-27', reason: 'skipped' },
        { date: '2027-03-29', reason: 'bank_holiday' },
      ]),
    ).toBe('26 Mar 2027 and 29 Mar 2027 are bank holidays');
    expect(
      bankHolidayNote([
        { date: '2027-12-27', reason: 'bank_holiday' },
        { date: '2027-12-28', reason: 'bank_holiday' },
        { date: '2028-01-03', reason: 'bank_holiday' },
      ]),
    ).toBe('27 Dec 2027, 28 Dec 2027 and 3 Jan 2028 are bank holidays');
  });
});
