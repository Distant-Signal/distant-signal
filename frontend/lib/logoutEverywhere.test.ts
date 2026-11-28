import { describe, it, expect } from 'vitest';
import { safeEndSessionUrl } from './logoutEverywhere';

describe('safeEndSessionUrl', () => {
  it('accepts an absolute https url unchanged', () => {
    const url = 'https://sso.example.invalid/application/o/ds/end-session/';
    expect(safeEndSessionUrl(url)).toBe(url);
  });

  it.each([
    ['http', 'http://sso.example.invalid/end-session/'],
    ['javascript', 'javascript:alert(1)'],
    ['data', 'data:text/html,<p>hi</p>'],
    ['protocol-relative', '//sso.example.invalid/end-session/'],
    ['relative', '/end-session/'],
    ['user info', 'https://user:pw@sso.example.invalid/end-session/'],
    ['empty', ''],
    ['not a url', 'not a url'],
  ])('refuses %s', (_name, value) => {
    expect(safeEndSessionUrl(value)).toBeNull();
  });

  it.each([[undefined], [null], [42], [{}], [['https://sso.example.invalid/']]])(
    'refuses the non-string %j',
    (value) => {
      expect(safeEndSessionUrl(value)).toBeNull();
    },
  );
});
