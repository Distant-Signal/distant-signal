/** Placeholder written in place of a secret. Matches the logger's own. */
export const REDACTED = '[REDACTED]';

/** Path shapes whose next segment is a capability token: a journey share
 * link (`/Journeys/shared/<token>`, `/journeys/shared/<token>`), a group
 * invite (`/groups/join/<token>`, `/public/groups/join/<token>`) and a
 * calendar feed (`/api/calendar/<token>.ics`). Case-insensitive; the token
 * runs to the next `/`, `?`, `#`, whitespace or quote. A `.ics` suffix on a
 * calendar token is kept. */
const PATH_TOKEN = /(\/(?:shared|join|invite|calendar)\/)([^/?#\s"'`]+?)(\.ics)?(?=[/?#\s"'`]|$)/gi;

/** A `token=value` (or `access_token`, `invite_token`, ...) query or fragment
 * parameter. */
const QUERY_TOKEN = /([?&#;][A-Za-z0-9_.-]*token[A-Za-z0-9_.-]*=)[^&#\s"'`]*/gi;

/** `text` with every share, invite or calendar token, and every `token`
 * query value, replaced by `[REDACTED]`. For a URL, or any message that
 * might embed one (an error's text, a request path), before it is logged. */
export function redactTokens(text: string): string {
  return text
    .replace(
      PATH_TOKEN,
      (_match, prefix: string, _token: string, ext: string | undefined) => `${prefix}${REDACTED}${ext ?? ''}`,
    )
    .replace(QUERY_TOKEN, (_match, prefix: string) => `${prefix}${REDACTED}`);
}
