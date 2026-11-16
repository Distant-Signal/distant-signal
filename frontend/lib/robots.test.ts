import { describe, it, expect } from 'vitest';
// Next's own serializer for `MetadataRoute.Robots` -- the same function the
// built `/robots.txt` route calls -- so these assertions check the text a
// crawler actually receives, not just the object. It's an internal module
// path; if a Next upgrade moves it, update this import.
import { resolveRobots } from 'next/dist/build/webpack/loaders/metadata/resolve-route-data';
import {
  AI_TRAINING_CRAWLERS,
  BLOCK_AI_TRAINING_CRAWLERS,
  buildRobots,
  LINK_PREVIEW_FETCHERS,
  renderRobots,
  TOKEN_PAGE_PATHS,
} from './robots';

const render = (...args: Parameters<typeof buildRobots>) => resolveRobots(buildRobots(...args));
const lines = (text: string) => text.split('\n');
/** Lines of the `User-Agent: *` group only: from its header up to the blank
 * line that ends it. The AI-crawler group's `Disallow: /` must not count
 * against the general rules. */
const starGroup = (text: string) => {
  const all = lines(text);
  const start = all.indexOf('User-Agent: *');
  const end = all.indexOf('', start);
  return all.slice(start, end === -1 ? undefined : end);
};

describe('buildRobots', () => {
  // `/journeys/new` was re-allowed under `/journeys/` until it became a
  // redirect to `/plan` (DS-194).
  it('allows the site by default and re-allows nothing under /journeys/', () => {
    const out = lines(render({ origin: undefined }));
    expect(out[0]).toBe('User-Agent: *');
    expect(out).toContain('Allow: /');
    expect(starGroup(out.join('\n')).filter((line) => line.startsWith('Allow: /journeys'))).toEqual([]);
  });

  it.each([
    '/api/',
    '/chat',
    '/connect-claude/authorize',
    '/groups',
    '/journeys/',
    '/journeys$',
    '/track/mine',
    '/track/tickets',
    '/train/by-id/',
    '/lines/new',
    '/lines/*/edit',
    '/*?',
  ])('disallows %s', (path) => {
    expect(lines(render({ origin: undefined }))).toContain(`Disallow: ${path}`);
  });

  it('keeps token-bearing share and invite links behind a disallowed prefix', () => {
    const disallowed = starGroup(render({ origin: undefined }))
      .filter((l) => l.startsWith('Disallow: '))
      .map((l) => l.slice('Disallow: '.length));
    for (const tokenPath of ['/journeys/shared/abc123', '/groups/join/abc123', '/chat/callback']) {
      expect(disallowed.some((prefix) => tokenPath.startsWith(prefix))).toBe(true);
    }
  });

  it.each(LINK_PREVIEW_FETCHERS)('lets %s read share and invite links, with every other rule kept', (agent) => {
    const out = lines(render({ origin: undefined }));
    const start = out.indexOf(`User-Agent: ${agent}`);
    expect(start).toBeGreaterThan(-1);
    const header = out.slice(0, start).lastIndexOf('') + 1;
    const group = out.slice(header, out.indexOf('', start));
    for (const path of TOKEN_PAGE_PATHS) expect(group).toContain(`Allow: ${path}`);
    const star = starGroup(out.join('\n')).filter((l) => l.startsWith('Disallow: '));
    for (const rule of star) expect(group).toContain(rule);
  });

  it('allows the token pages to the link-preview fetchers only', () => {
    const star = starGroup(render({ origin: undefined }));
    for (const path of TOKEN_PAGE_PATHS) expect(star).not.toContain(`Allow: ${path}`);
    expect(star).toContain('Disallow: /*?');
  });

  it('does not disallow the public pages', () => {
    const disallowed = starGroup(render({ origin: undefined }))
      .filter((l) => l.startsWith('Disallow: '))
      .map((l) => l.slice('Disallow: '.length))
      // Wildcard rules are checked separately above.
      .filter((p) => !p.includes('*'));
    for (const publicPath of [
      '/',
      '/status',
      '/lines',
      '/lines/bakerloo',
      '/lines/bakerloo/history',
      '/operators',
      '/network/history',
      '/stations',
      '/stations/KGX',
      '/trains',
      '/train/C12345/2026-09-27',
      '/incidents',
      '/incidents/42',
      '/connect-claude',
      '/track',
      '/attribution',
      '/privacy',
      '/terms',
      '/cookies',
      '/contact',
    ]) {
      expect(disallowed.filter((prefix) => publicPath.startsWith(prefix))).toEqual([]);
    }
  });

  it('omits Host and Sitemap when no origin is configured', () => {
    const text = render({ origin: undefined, sitemapPath: '/sitemap.xml' });
    expect(text).not.toMatch(/^Host:/m);
    expect(text).not.toMatch(/^Sitemap:/m);
    expect(text).not.toContain('undefined');
  });

  it('emits Host and no Sitemap when the sitemap path is cleared', () => {
    const text = render({ origin: 'https://ds.example', sitemapPath: null });
    expect(text).toMatch(/^Host: https:\/\/ds\.example$/m);
    expect(text).not.toMatch(/^Sitemap:/m);
  });

  it("advertises the app's own sitemap by default", () => {
    const text = render({ origin: 'https://ds.example' });
    expect(text).toMatch(/^Sitemap: https:\/\/ds\.example\/sitemap\.xml$/m);
  });

  it('never disallows the noindex pages, so crawlers can read their robots tag', () => {
    const text = render({ origin: 'https://ds.example' });
    for (const path of ['/train/', '/incidents/', '/network/history', '/lines/']) {
      expect(text).not.toMatch(new RegExp(`^Disallow: ${path}$`, 'm'));
    }
  });

  it('emits an absolute Sitemap line when a sitemap path and origin are both set', () => {
    const text = render({ origin: 'https://ds.example', sitemapPath: '/sitemap.xml' });
    expect(text).toMatch(/^Sitemap: https:\/\/ds\.example\/sitemap\.xml$/m);
  });

  it('blocks AI training crawlers by default (owner decision, 2026-09-27)', () => {
    expect(BLOCK_AI_TRAINING_CRAWLERS).toBe(true);
    const out = lines(render({ origin: undefined }));
    for (const ua of AI_TRAINING_CRAWLERS) {
      expect(out).toContain(`User-Agent: ${ua}`);
    }
    const lastUa = out.lastIndexOf(`User-Agent: ${AI_TRAINING_CRAWLERS.at(-1)}`);
    expect(out[lastUa + 1]).toBe('Disallow: /');
  });

  it('keeps the general rules for every other crawler when AI crawlers are blocked', () => {
    const out = lines(render({ origin: undefined }));
    expect(out[0]).toBe('User-Agent: *');
    expect(out).toContain('Allow: /');
  });

  it('does not block AI training crawlers when the toggle is off', () => {
    const text = render({ origin: undefined, blockAiTrainingCrawlers: false });
    for (const ua of AI_TRAINING_CRAWLERS) {
      expect(text).not.toContain(`User-Agent: ${ua}`);
    }
  });

  it('blocks every AI training crawler entirely when the toggle is on', () => {
    const out = lines(render({ origin: undefined, blockAiTrainingCrawlers: true }));
    for (const ua of AI_TRAINING_CRAWLERS) {
      expect(out).toContain(`User-Agent: ${ua}`);
    }
    const lastUa = out.lastIndexOf(`User-Agent: ${AI_TRAINING_CRAWLERS.at(-1)}`);
    expect(out[lastUa + 1]).toBe('Disallow: /');
  });
});

describe('renderRobots', () => {
  it.each([
    { origin: undefined },
    { origin: 'https://ds.example' },
    { origin: 'https://ds.example', blockAiTrainingCrawlers: false },
    { origin: undefined, sitemapPath: null },
  ])("matches Next's own serializer byte for byte (%j)", (options) => {
    expect(renderRobots(buildRobots(options))).toBe(resolveRobots(buildRobots(options)));
  });
});

/** RFC 9309 matching in `agent`'s group of `text`: the longest matching
 * rule wins, `Allow` on a tie; `*` matches any run of characters and a
 * final `$` anchors the end. `path` includes its query string. */
function allowedFor(text: string, agent: string, path: string): boolean {
  const all = lines(text);
  const at = all.indexOf(`User-Agent: ${agent}`);
  if (at === -1) throw new Error(`no group for ${agent}`);
  const group = all.slice(all.slice(0, at).lastIndexOf('') + 1, all.indexOf('', at));
  let best: { length: number; allow: boolean } | null = null;
  for (const line of group) {
    const rule = /^(Allow|Disallow): (.*)$/.exec(line);
    if (!rule) continue;
    const pattern = rule[2]!;
    const anchored = pattern.endsWith('$');
    const body = (anchored ? pattern.slice(0, -1) : pattern)
      .split('*')
      .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
      .join('.*');
    if (!new RegExp(`^${body}${anchored ? '$' : ''}`).test(path)) continue;
    const allow = rule[1] === 'Allow';
    if (!best || pattern.length > best.length || (pattern.length === best.length && allow)) {
      best = { length: pattern.length, allow };
    }
  }
  return best === null || best.allow;
}

describe('preview images in robots.txt', () => {
  const text = render({ origin: undefined });
  const CARDS = [
    '/incidents/42/card.png?v=abcd1234',
    '/lines/southern/card.png?v=abcd1234',
    '/stations/KGX/card.png?v=abcd1234',
    '/train/C12345/2026-11-16/card.png?v=abcd1234',
    '/transit/metrolink/lines/blue/card.png?v=abcd1234',
    '/island-of-ireland/irish-rail/stations/CNLLY/card.png?v=abcd1234',
    '/operators/SN/history/card.png?v=abcd1234',
    '/journeys/shared/abc123/card.png?v=abcd1234',
    '/groups/join/abc123/card.png?v=abcd1234',
    '/lines/opengraph-image?3f2a1b0c',
  ];

  it.each(LINK_PREVIEW_FETCHERS.flatMap((agent) => CARDS.map((card) => [agent, card])))(
    'lets %s read %s',
    (agent, card) => {
      expect(allowedFor(text, agent, card)).toBe(true);
    },
  );

  it.each(CARDS)('keeps %s from every other crawler (a search engine indexes the page, not its card)', (card) => {
    expect(allowedFor(text, '*', card)).toBe(false);
  });

  it('still keeps the link-preview fetchers off query-string pages and private paths', () => {
    for (const agent of LINK_PREVIEW_FETCHERS) {
      expect(allowedFor(text, agent, '/trains?q=brighton')).toBe(false);
      expect(allowedFor(text, agent, '/train/by-id/7')).toBe(false);
      expect(allowedFor(text, agent, '/chat')).toBe(false);
      expect(allowedFor(text, agent, '/lines/bakerloo')).toBe(true);
      expect(allowedFor(text, agent, '/opengraph-image.png')).toBe(true);
    }
  });

  it('matches public pages and the anchored and prefix rules as a crawler does', () => {
    expect(allowedFor(text, '*', '/lines/bakerloo')).toBe(true);
    expect(allowedFor(text, '*', '/journeys')).toBe(false);
    expect(allowedFor(text, '*', '/journeys-x')).toBe(true);
    expect(allowedFor(text, '*', '/journeys/shared/abc')).toBe(false);
    expect(allowedFor(text, '*', '/lines/x/edit')).toBe(false);
  });
});
