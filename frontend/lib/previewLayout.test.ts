import { describe, expect, it } from 'vitest';
import { SNAPSHOT_NOTE } from './linePreview';
import type { StatusPreviewCard } from './livePreview';
import { creditHeight, estimateTitleLines, layoutStatusCard } from './previewLayout';

function card(overrides: Partial<StatusPreviewCard> = {}): StatusPreviewCard {
  return {
    band: { tone: 'mild', label: 'Minor delays', aside: 'As of 14:00' },
    title: 'Chatham Main Line',
    lead: 'Disruption through Rochester',
    chips: { names: ['Southeastern'], more: 0 },
    rows: ['2 disruptions', 'Southeastern', '5 of 42 trains delayed', SNAPSHOT_NOTE],
    ...overrides,
  };
}

const CREDIT = 'powered by NationalRail (Train Information Services Ltd) · Source: RSP';
const LONG_CREDIT = `${CREDIT} · ${'Contains Information of Network Rail Infrastructure Limited licensed under the following licence '.repeat(2)}https://www.networkrail.co.uk/who-we-are/transparency-and-ethics/transparency/open-data-feeds/network-rail-infrastructure-limited-data-feeds-licence/`;
const TWO_LINES = 'Northern: Manchester Victoria to Southport via Wigan Wallgate and Atherton and Bolton';
const THREE_LINES = 'Newcastle upon Tyne Central Station and Metro Interchange Facility Extended Name (NCL)';

describe('layoutStatusCard', () => {
  it('keeps everything on a card that fits', () => {
    const layout = layoutStatusCard(card({ rows: ['One fact', SNAPSHOT_NOTE] }), CREDIT, 1);
    expect(layout).toMatchObject({ showChips: true, rows: ['One fact', SNAPSHOT_NOTE], credit: CREDIT });
    expect(layout.used).toBeLessThanOrEqual(layout.available);
  });

  it('clamps a long title to two lines when there are three or more facts', () => {
    expect(layoutStatusCard(card({ title: THREE_LINES }), CREDIT, 1).titleLines).toBe(2);
    expect(layoutStatusCard(card({ title: THREE_LINES, rows: ['A'] }), CREDIT, 0).titleLines).toBe(3);
  });

  it('drops the lowest-priority facts first and keeps the snapshot note', () => {
    const layout = layoutStatusCard(card({ title: TWO_LINES }), LONG_CREDIT, 1);
    expect(layout.rows.at(-1)).toBe(SNAPSHOT_NOTE);
    expect(layout.rows).not.toContain('5 of 42 trains delayed');
    expect(layout.used).toBeLessThanOrEqual(layout.available);
  });

  it('moves the snapshot note into the credit, never losing it, when nothing else is left to drop', () => {
    const layout = layoutStatusCard(
      card({ title: THREE_LINES, rows: ['A fact', 'Another fact', SNAPSHOT_NOTE] }),
      `${LONG_CREDIT} ${LONG_CREDIT}`,
      1,
    );
    expect(layout.rows).not.toContain(SNAPSHOT_NOTE);
    expect(layout.credit).toContain(SNAPSHOT_NOTE);
    expect(layout.credit).toContain('Network Rail');
    expect(layout.titleLines).toBeLessThan(3);
    expect(layout.used).toBeLessThanOrEqual(layout.available);
  });

  it('always keeps the lead, the band and the credit text', () => {
    const layout = layoutStatusCard(card({ title: THREE_LINES }), LONG_CREDIT, 3);
    expect(layout.lead).toBe('Disruption through Rochester');
    expect(layout.credit).toContain(LONG_CREDIT);
  });

  it('always fits, whatever the card, as far as its estimates go', () => {
    const rows = Array.from({ length: 6 }, (_, i) => `Fact number ${i + 1}`);
    for (const title of ['A', TWO_LINES, THREE_LINES, 'x'.repeat(300)]) {
      for (const credit of ['', CREDIT, LONG_CREDIT]) {
        for (const chips of [0, 3]) {
          for (const count of [0, 1, 3, 6]) {
            const layout = layoutStatusCard(
              card({ title, rows: [...rows.slice(0, count), SNAPSHOT_NOTE] }),
              credit,
              chips,
            );
            expect(layout.used, `${title.length} ${credit.length} ${chips} ${count}`).toBeLessThanOrEqual(
              layout.available,
            );
            // The note is somewhere, or the card never needed it moved.
            expect(layout.rows.includes(SNAPSHOT_NOTE) || layout.credit.includes(SNAPSHOT_NOTE)).toBe(true);
          }
        }
      }
    }
  });
});

describe('estimates', () => {
  it('counts title lines on the safe side and credit lines by length', () => {
    expect(estimateTitleLines('Woking', 60)).toBe(1);
    expect(estimateTitleLines(TWO_LINES, 52)).toBeGreaterThanOrEqual(2);
    expect(creditHeight('')).toBe(28);
    expect(creditHeight(LONG_CREDIT)).toBeGreaterThan(creditHeight(CREDIT));
  });
});
