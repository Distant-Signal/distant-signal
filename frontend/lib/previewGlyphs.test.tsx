// @vitest-environment node
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { ImageResponse } from 'next/og';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { groupInvitePreviewCard } from './groupInvitePreview';
import { GEIST_RANGES, renderableText } from './previewGlyphs';
import { renderableCard, renderPreviewImage, renderStatusPreviewImage } from './previewImage';

/** The code points a TrueType font maps (its Windows Unicode BMP cmap,
 * format 4), as ranges. */
function cmapRanges(font: Buffer): [number, number][] {
  let cmap = -1;
  for (let i = 0; i < font.readUInt16BE(4); i++) {
    const at = 12 + 16 * i;
    if (font.toString('latin1', at, at + 4) === 'cmap') cmap = font.readUInt32BE(at + 8);
  }
  let table = -1;
  for (let i = 0; i < font.readUInt16BE(cmap + 2); i++) {
    const at = cmap + 4 + 8 * i;
    if (font.readUInt16BE(at) === 3 && font.readUInt16BE(at + 2) === 1) table = cmap + font.readUInt32BE(at + 4);
  }
  expect(font.readUInt16BE(table)).toBe(4);
  const segments = font.readUInt16BE(table + 6) / 2;
  const ends = table + 14;
  const starts = ends + 2 * segments + 2;
  const deltas = starts + 2 * segments;
  const offsets = deltas + 2 * segments;
  const ranges: [number, number][] = [];
  for (let i = 0; i < segments; i++) {
    const [start, end] = [font.readUInt16BE(starts + 2 * i), font.readUInt16BE(ends + 2 * i)];
    const [delta, offset] = [font.readInt16BE(deltas + 2 * i), font.readUInt16BE(offsets + 2 * i)];
    for (let c = start; c <= end && c !== 0xffff; c++) {
      const index = offset === 0 ? c : font.readUInt16BE(offsets + 2 * i + offset + 2 * (c - start));
      if (index === 0 || ((index + delta) & 0xffff) === 0) continue;
      const last = ranges.at(-1);
      if (last?.[1] === c - 1) last[1] = c;
      else ranges.push([c, c]);
    }
  }
  return ranges;
}

describe('GEIST_RANGES', () => {
  it("is next/og's bundled font's own character map", () => {
    const require = createRequire(import.meta.url);
    const font = readFileSync(require.resolve('next/dist/compiled/@vercel/og/Geist-Regular.ttf'));
    expect(GEIST_RANGES).toEqual(cmapRanges(font));
  });
});

describe('renderableText', () => {
  it.each([
    ['Commuters 🚆', 'Commuters'],
    ['🚆 Commuters 🚆 club', 'Commuters club'],
    ['Family 👨‍👩‍👧 trips', 'Family trips'],
    ['🚆🚆', ''],
    ['Baile Átha Cliath', 'Baile Átha Cliath'],
    ['Llanfair Caereinion: ŵ ŷ ẁ ẃ', 'Llanfair Caereinion: ŵ ŷ ẁ ẃ'],
    ['Café', 'Café'],
    ['東京 Tokyo', 'Tokyo'],
    ['Smiley ☺ here', 'Smiley here'],
    ['© National Transport Authority', '© National Transport Authority'],
    ['St Pancras\nInternational\t', 'St Pancras International'],
  ])('%j draws as %j', (text, drawn) => {
    expect(renderableText(text)).toBe(drawn);
  });

  it('drops an accent Geist lacks to its base letter', () => {
    // U+01F8 (N with grave) is not in Geist; N is.
    expect(renderableText('Ǹorth')).toBe('North');
  });
});

describe('renderableCard', () => {
  it('drops empty parts, counts dropped chips and never leaves the title empty', () => {
    const card = renderableCard({
      band: { tone: 'informational', label: 'Group invite 🚆', aside: '3 members' },
      title: '🚆',
      lead: '🚆',
      chips: { names: ['Southern', '🚆'], more: 1 },
      rows: ['🚆', 'Row'],
    });
    expect(card).toEqual({
      band: { tone: 'informational', label: 'Group invite', aside: '3 members' },
      title: 'Distant Signal',
      lead: null,
      chips: { names: ['Southern'], more: 2 },
      rows: ['Row'],
    });
  });
});

describe('cards never fetch a font or an emoji', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const stubFetch = () => {
    const fetch = vi.fn(() => Promise.reject(new Error('no network in a card render')));
    vi.stubGlobal('fetch', fetch);
    return fetch;
  };

  it('would, for text the font lacks, without renderableText (the control)', async () => {
    const fetch = stubFetch();
    const response = new ImageResponse(<div style={{ display: 'flex', fontSize: 40 }}>Commuters 🚆 東京</div>, {
      width: 200,
      height: 100,
    });
    await response.arrayBuffer().catch(() => null);
    expect(fetch).toHaveBeenCalled();
  });

  it.each([
    ['a group name with an emoji', 'Commuters 🚆'],
    ['a name in a script the font lacks', '東京 Tokyo'],
    ['Irish and Welsh names', 'Baile Átha Cliath and Caerdydd ŵ ŷ'],
    ['a symbol the renderer treats as an emoji', 'Smiley ☺'],
  ])(
    'for %s',
    async (_name, groupName) => {
      const fetch = stubFetch();
      const card = renderStatusPreviewImage(groupInvitePreviewCard({ groupName, memberCount: 3 }), 'Credit © Someone');
      expect((await card.arrayBuffer()).byteLength).toBeGreaterThan(0);
      const title = renderPreviewImage(groupName);
      expect((await title.arrayBuffer()).byteLength).toBeGreaterThan(0);
      expect(fetch).not.toHaveBeenCalled();
    },
    30_000,
  );
});
