/**
 * The api's typed refusals. A route that refuses for a reason a client acts
 * on answers JSON of the shape `{"error": "<snake_case code>", "message":
 * "<sentence>", ...scalar extras}` to a cookie session for `owner_must_delete`
 * and `group_changed` (with `memberCount`), `recent_login_required` and
 * `suggestion_stale`; the journey routes' `miss_window_closed`,
 * `leg_travelled` and `plan_changed` are the plain-text sentence to a cookie
 * session (ds-api's `RouteError::render` keeps the JSON for delegated
 * callers). The `/api` proxy hands the upstream status and body through as
 * they came, so a component matches on `code` first and falls back to the
 * message text.
 */

export type ApiErrorExtra = string | number | boolean | null;

export interface ApiError {
  status: number;
  /** The `error` code of a typed refusal, else `null` (plain text, HTML or
   * JSON of another shape). */
  code: string | null;
  /** The JSON `message`, else the raw body text. May not be fit to show:
   * see `apiErrorSentence` in `failure.ts`. */
  message: string;
  /** The scalar fields beside `error` and `message` (`memberCount`...). */
  extras: Readonly<Record<string, ApiErrorExtra>>;
}

const CODE_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;

/** `body` read as the api's error shape, for a response with `status`. */
export function parseApiError(status: number, body: string): ApiError {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return { status, code: null, message: body, extras: {} };
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { status, code: null, message: body, extras: {} };
  }
  const record = parsed as Record<string, unknown>;
  const code = typeof record.error === 'string' && CODE_PATTERN.test(record.error) ? record.error : null;
  const message = typeof record.message === 'string' ? record.message : '';
  const extras: Record<string, ApiErrorExtra> = {};
  for (const [key, value] of Object.entries(record)) {
    if (key === 'error' || key === 'message') continue;
    if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      extras[key] = value;
    }
  }
  return { status, code, message, extras };
}

/** Reads a failed `response`'s body once (call it at most once per
 * response, or on a clone). A body that can't be read is an empty message. */
export async function readApiError(response: Response): Promise<ApiError> {
  return parseApiError(response.status, await response.text().catch(() => ''));
}

/** A numeric extra (`memberCount`), or null when absent or not a number. */
export function numericExtra(error: ApiError, name: string): number | null {
  const value = error.extras[name];
  return typeof value === 'number' ? value : null;
}
