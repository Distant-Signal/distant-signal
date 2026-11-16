import type { MetadataRoute } from 'next';

/** Path prefixes no crawler should ever fetch. Real route paths from
 * `app/`, listed explicitly rather than inferred (robots.txt paths are
 * case-sensitive, so these must match the frontend's lowercase routes, not
 * the backend's `/Journeys/...`-style API paths, which `/api/` covers).
 *
 * robots.txt is advisory and public: it keeps well-behaved crawlers away
 * from these paths, but it is not access control. Every private or
 * token-bearing page below is already gated server-side. */
export const DISALLOWED_PATHS: readonly string[] = [
  // Backend proxy (`app/api/[...path]/route.ts`): JSON, auth
  // (`/api/auth/login`, `/api/auth/logout`, ...) and every mutation.
  '/api/',
  // `/chat` is login-gated, and `/chat/callback` is the MCP OAuth callback.
  '/chat',
  // The retired MCP consent bridge; now only a "this moved" note
  // (`app/connect-claude/authorize/page.tsx`). `/connect-claude` itself is a
  // public instructions page and stays crawlable.
  '/connect-claude/authorize',
  // Every groups page is per-user. This also covers `/groups/join/<token>`
  // invite links, which carry a secret token and must never be crawled.
  '/groups',
  // `/journeys/<id>` and `/journeys/regular` are per-user, and
  // `/journeys/shared/<token>` share links carry a secret token.
  // `/journeys/new` redirects to `/plan` (DS-194), which is crawlable.
  '/journeys/',
  // The Journeys page itself (per-user), anchored so it adds nothing to
  // the prefix above, and its old paths `/track/mine` and
  // `/track/tickets`, which `next.config.mjs` redirects to it.
  '/journeys$',
  '/track/mine',
  '/track/tickets',
  // `trackingId` is one user's own subscription id, not a public train.
  // The public train page is `/train/<uid>/<date>`.
  '/train/by-id/',
  // Creating or editing a user's own custom line.
  '/lines/new',
  '/lines/*/edit',
  // Any URL with a query string: search results (`/trains?...`), filters
  // (`/incidents?...`), history ranges (`/lines/<id>/history?...`), and
  // `/track?ticketId=...` prefills. Each variant is an uncached,
  // backend-heavy render, and none of them is a canonical page. The bare
  // path of every public page stays crawlable. `*` and `$` are part of
  // RFC 9309 and Google and Bing honor them. Crawlers that don't support
  // wildcards ignore this line.
  '/*?',
];

/** Paths allowed explicitly. Google and Bing apply the most specific
 * (longest) matching rule, so a path here beats a shorter disallowed
 * prefix above. Nothing needs that now: `/journeys/new`, the one path that
 * did, redirects to `/plan` (DS-194). */
export const ALLOWED_PATHS: readonly string[] = ['/'];

/** Link-preview fetchers: what a chat app or social site sends to read a
 * pasted link's title, description and image. Slack's and X's obey
 * robots.txt, so under `*` they would never unfurl a share or invite link;
 * the others (Discord, iMessage, WhatsApp, Telegram, ...) mostly ignore it,
 * and are listed so the intent is on record. */
export const LINK_PREVIEW_FETCHERS: readonly string[] = [
  'Slackbot',
  'Slackbot-LinkExpanding',
  'Twitterbot',
  'facebookexternalhit',
  'LinkedInBot',
  'WhatsApp',
  'TelegramBot',
  'Discordbot',
];

/** The capability-token pages (`/journeys/shared/<token>` share links,
 * `/groups/join/<token>` invites), and the card images under them, which
 * only `LINK_PREVIEW_FETCHERS` may read. Under `*` they stay disallowed
 * (no search crawler sees them), the pages are `noindex, nofollow`, their
 * images send `X-Robots-Tag: noindex` and the sitemap never lists them.
 * These longer `Allow` rules beat the `/journeys/`, `/groups` and `/*?`
 * (the card's `?v=`) disallows for those agents. */
export const TOKEN_PAGE_PATHS: readonly string[] = ['/journeys/shared/', '/groups/join/'];

/** Every page's preview image, which only `LINK_PREVIEW_FETCHERS` need.
 * Each is listed with a query string: a live card as `.../card.png?v=<digest>`
 * (`livePreviewImage`), a file-convention image as
 * `.../opengraph-image?<hash>` (Next adds it). Under `*` the `/*?` disallow
 * keeps them out, deliberately: a search engine indexes the page, not its
 * card. For the fetchers these longer rules beat `/*?`; without them Slack
 * and X, which obey robots.txt (X shows no image it blocks), unfurl a page
 * with no card. The bare site-wide `/opengraph-image.png` has no query and
 * is allowed by `/` already. */
export const PREVIEW_IMAGE_PATHS: readonly string[] = ['/*/card.png', '/*/opengraph-image'];

/** Crawlers that collect content to train AI models. **Blocked**: the
 * owner opted out of AI training (2026-09-27), so `BLOCK_AI_TRAINING_CRAWLERS`
 * is `true` and each of these user agents gets `Disallow: /`. Set it back to
 * `false` to allow them again. `Google-Extended` and
 * `Applebot-Extended` are control tokens rather than separate crawlers.
 * Blocking them opts out of AI training without affecting normal Google or
 * Apple search indexing.
 *
 * Deliberately not listed: the AI assistants' user-initiated fetchers
 * (`ChatGPT-User`, `Claude-User`, `Perplexity-User`). They fetch a page
 * because a person asked about it, which is closer to a browser than a
 * training crawler. */
export const AI_TRAINING_CRAWLERS: readonly string[] = [
  'GPTBot',
  'ClaudeBot',
  'CCBot',
  'Google-Extended',
  'Applebot-Extended',
  'Bytespider',
  'meta-externalagent',
  'Amazonbot',
  'PerplexityBot',
];

/** Owner toggle. See `AI_TRAINING_CRAWLERS`. */
export const BLOCK_AI_TRAINING_CRAWLERS = true;

/** Path of the app's sitemap (`app/sitemap.ts`), relative to the site
 * origin; robots.txt advertises it when an origin is configured. */
export const SITEMAP_PATH: string | null = '/sitemap.xml';

export interface RobotsOptions {
  /** Configured public origin (`https://host`, no trailing slash), or
   * `undefined` when none is configured. With no origin, the `Host` and
   * `Sitemap` lines are omitted: both must be absolute, and guessing an
   * origin from the request is worse than leaving them out. */
  origin: string | undefined;
  sitemapPath?: string | null;
  blockAiTrainingCrawlers?: boolean;
}

/** Pure builder behind `app/robots.ts`, kept here so it can be unit-tested
 * without a Next request context. */
export function buildRobots({
  origin,
  sitemapPath = SITEMAP_PATH,
  blockAiTrainingCrawlers = BLOCK_AI_TRAINING_CRAWLERS,
}: RobotsOptions): MetadataRoute.Robots {
  const rules: MetadataRoute.Robots['rules'] = [
    // Crawl-delay is deliberately not set. Googlebot ignores it, and the
    // expensive URLs (query-string variants and `/api/`) are disallowed
    // outright instead.
    { userAgent: '*', allow: [...ALLOWED_PATHS], disallow: [...DISALLOWED_PATHS] },
    // A crawler obeys only its most specific group, so this one repeats
    // every `*` rule and adds the token pages and the preview images.
    {
      userAgent: [...LINK_PREVIEW_FETCHERS],
      allow: [...ALLOWED_PATHS, ...TOKEN_PAGE_PATHS, ...PREVIEW_IMAGE_PATHS],
      disallow: [...DISALLOWED_PATHS],
    },
  ];
  if (blockAiTrainingCrawlers) {
    rules.push({ userAgent: [...AI_TRAINING_CRAWLERS], disallow: '/' });
  }
  return {
    rules,
    ...(origin ? { host: origin } : {}),
    ...(origin && sitemapPath ? { sitemap: `${origin}${sitemapPath}` } : {}),
  };
}

const asList = (value: string | readonly string[] | undefined): readonly string[] =>
  value === undefined ? [] : typeof value === 'string' ? [value] : value;

/** `buildRobots`' result as robots.txt text, in the layout Next's own
 * `app/robots.ts` convention produced (blank line after each group, then
 * `Host:` and `Sitemap:`). `app/robots.txt/route.ts` serves it, so the
 * response can carry an `ETag` and `Cache-Control` of its own. */
export function renderRobots(robots: MetadataRoute.Robots): string {
  const groups = Array.isArray(robots.rules) ? robots.rules : [robots.rules];
  let text = '';
  for (const rule of groups) {
    for (const agent of asList(rule.userAgent ?? '*')) text += `User-Agent: ${agent}\n`;
    for (const path of asList(rule.allow)) text += `Allow: ${path}\n`;
    for (const path of asList(rule.disallow)) text += `Disallow: ${path}\n`;
    text += '\n';
  }
  if (robots.host) text += `Host: ${robots.host}\n`;
  for (const url of asList(robots.sitemap)) text += `Sitemap: ${url}\n`;
  return text;
}
