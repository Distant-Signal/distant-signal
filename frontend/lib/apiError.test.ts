import { describe, expect, it } from 'vitest';
import { numericExtra, parseApiError, readApiError } from './apiError';

describe('parseApiError', () => {
  it('reads the code, message and scalar extras of a typed refusal', () => {
    const error = parseApiError(
      409,
      JSON.stringify({
        error: 'owner_must_delete',
        message: 'Delete the group instead.',
        memberCount: 1,
        nested: { a: 1 },
      }),
    );
    expect(error.status).toBe(409);
    expect(error.code).toBe('owner_must_delete');
    expect(error.message).toBe('Delete the group instead.');
    expect(error.extras).toEqual({ memberCount: 1 });
    expect(numericExtra(error, 'memberCount')).toBe(1);
    expect(numericExtra(error, 'missing')).toBeNull();
  });

  it('has no code for plain text, which stays the message', () => {
    const error = parseApiError(409, 'that member is already an admin');
    expect(error.code).toBeNull();
    expect(error.message).toBe('that member is already an admin');
    expect(error.extras).toEqual({});
  });

  it('has no code for an error that is not a short snake_case word', () => {
    expect(parseApiError(400, '{"error":"Not A Code","message":"x"}').code).toBeNull();
    expect(parseApiError(400, '{"error":42}').code).toBeNull();
    expect(parseApiError(400, '[1,2]').code).toBeNull();
    expect(parseApiError(400, '').code).toBeNull();
  });

  it('reads a body from a response', async () => {
    const error = await readApiError(
      new Response('{"error":"group_changed","message":"m","memberCount":3}', { status: 409 }),
    );
    expect(error.code).toBe('group_changed');
    expect(numericExtra(error, 'memberCount')).toBe(3);
  });
});
