/**
 * `?earlier=N` on the leg candidates route lists the trains just before the
 * search (ds-api's additive `earlier` field). An api from before that change
 * refuses any query parameter it doesn't know with a 400 (`unknown field
 * `earlier`, expected one of ...`), so the first refusal like that is
 * retried once without it and remembered for the page load: the picker then
 * simply has no earlier trains.
 */

let earlierUnsupported = false;

const UNKNOWN_EARLIER = /unknown field\s*[`'"]?earlier\b/i;

/** Forgets that the api refused `earlier` (for tests). */
export function resetEarlierSupport(): void {
  earlierUnsupported = false;
}

async function refusesEarlier(response: Response): Promise<boolean> {
  if (response.status !== 400) return false;
  try {
    return UNKNOWN_EARLIER.test(await response.clone().text());
  } catch {
    return false;
  }
}

/** Fetches the candidates' first page, asking for `earlier` trains when
 * `earlier > 0` and the api takes it. Any other failure comes back as it is. */
export async function fetchCandidates(path: string, params: URLSearchParams, earlier: number): Promise<Response> {
  const url = (p: URLSearchParams) => {
    const query = p.toString();
    return `${path}${query ? `?${query}` : ''}`;
  };
  if (earlier <= 0 || earlierUnsupported) return fetch(url(params));
  const asking = new URLSearchParams(params);
  asking.set('earlier', String(earlier));
  const response = await fetch(url(asking));
  if (!(await refusesEarlier(response))) return response;
  earlierUnsupported = true;
  return fetch(url(params));
}
