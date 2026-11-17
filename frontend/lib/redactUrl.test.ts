import { describe, it, expect } from 'vitest';
import { redactTokens } from './redactUrl';

describe('redactTokens', () => {
  it.each([
    ['http://api/Journeys/shared/abc123', 'http://api/Journeys/shared/[REDACTED]'],
    ['http://api/public/groups/join/abc%2Fdef?x=1', 'http://api/public/groups/join/[REDACTED]?x=1'],
    ['/journeys/shared/abc123/card.png', '/journeys/shared/[REDACTED]/card.png'],
    ['/api/calendar/s3cret.ics', '/api/calendar/[REDACTED].ics'],
    ['http://h/p?a=1&token=abc&b=2', 'http://h/p?a=1&token=[REDACTED]&b=2'],
    ['http://h/p?invite_token=abc', 'http://h/p?invite_token=[REDACTED]'],
    [
      'API request to http://api/Journeys/shared/abc failed: 500 Oops',
      'API request to http://api/Journeys/shared/[REDACTED] failed: 500 Oops',
    ],
    ['http://api/Line/victoria', 'http://api/Line/victoria'],
  ])('%s', (input, expected) => {
    expect(redactTokens(input)).toBe(expected);
  });
});
