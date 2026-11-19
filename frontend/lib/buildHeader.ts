import { BUILD_ID_HEADER, clientBuildId } from '@/lib/buildId';

/** Whether `input` names a call to the app's own `/api/*` proxy by string or
 * URL (a `Request` is left alone: no call site passes one). */
function isOwnApiCall(input: RequestInfo | URL): boolean {
  if (typeof input !== 'string' && !(input instanceof URL)) return false;
  try {
    const url = new URL(input, window.location.origin);
    return url.origin === window.location.origin && url.pathname.startsWith('/api/');
  } catch {
    return false;
  }
}

/** Puts this build's id on every same-origin `/api/*` call as `X-DS-Build`,
 * by wrapping `window.fetch` once (the app's components each call
 * `fetch('/api/...')` directly, as `installApiErrorReporting` notes). The
 * request stays same-origin, so no preflight; the proxy strips the header
 * before the api. A page with no build id (dev, tests) is left alone.
 * Returns the undo, for tests. */
export function installBuildHeader(): () => void {
  const id = clientBuildId();
  if (typeof window === 'undefined' || id === null) return () => undefined;
  // eslint-disable-next-line @typescript-eslint/unbound-method -- kept only to put the exact original back on undo; every call goes through the bound copy below
  const original = window.fetch;
  const wrapped = original.bind(window);
  const stamped: typeof fetch = (input, init) => {
    if (!isOwnApiCall(input)) return wrapped(input, init);
    const headers = new Headers(init?.headers);
    if (!headers.has(BUILD_ID_HEADER)) headers.set(BUILD_ID_HEADER, id);
    return wrapped(input, { ...init, headers });
  };
  window.fetch = stamped;
  return () => {
    window.fetch = original;
  };
}
