/** The app's own origin, for `request` calls: the api refuses a cookie
 * mutation that shows no same-origin signal (an `Origin`, or a `Referer`, or
 * `Sec-Fetch-Site: same-origin`), and a Playwright `request` sends none. A
 * browser always sends `Origin` on a non-GET, so only these calls need it:
 * `test.use({ extraHTTPHeaders: SAME_ORIGIN_HEADERS })`. */
export const SAME_ORIGIN_HEADERS = {
  Origin: new URL(process.env.E2E_BASE_URL ?? 'http://localhost:3000').origin,
};
