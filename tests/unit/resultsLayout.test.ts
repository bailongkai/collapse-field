import { describe, it, expect } from 'vitest';
import { planResults, RESULTS_HEADER, RESULTS_BLOCK_GAP } from '../../src/game/ui/resultsLayout';

/** a run that opened a stage, earned achievements and used four weapons: the one from the report */
const FULL = { stats: 180 + 40 + 36, build: 184 };
/** a first death: five rows, icons, one bar */
const SHORT = { stats: 180, build: 118 };

const contentBottom = (p: ReturnType<typeof planResults>, b: typeof FULL): number =>
  RESULTS_HEADER + (p.columns === 2 ? Math.max(b.stats, b.build) : b.stats + RESULTS_BLOCK_GAP + b.build) * p.scale;

describe('the results screen fits what it shows', () => {
  const screens = [
    { name: 'reference', maxW: 1232, maxH: 672 },
    { name: 'landscape phone', maxW: 974, maxH: 424 },
    { name: 'portrait phone', maxW: 357, maxH: 829 },
    { name: 'small portrait phone', maxW: 312, maxH: 520 },
  ];
  for (const s of screens) {
    for (const footerH of [88, 144, 204]) {
      for (const blocks of [FULL, SHORT]) {
        it(`${s.name}, footer ${footerH}, ${blocks === FULL ? 'full' : 'short'} run: content ends above the buttons`, () => {
          const p = planResults({ ...s, footerH, one: blocks, two: s.maxW >= 680 ? blocks : null });
          expect(p.panelH).toBeLessThanOrEqual(s.maxH);
          expect(p.panelW).toBeLessThanOrEqual(s.maxW);
          expect(contentBottom(p, blocks)).toBeLessThanOrEqual(p.panelH - footerH + 0.001);
        });
      }
    }
  }

  it('a short run keeps the panel it always had', () => {
    const p = planResults({ maxW: 1232, maxH: 672, footerH: 88, one: SHORT, two: SHORT });
    expect(p).toEqual({ columns: 1, panelW: 720, panelH: 640, scale: 1 });
  });

  it('grows before it rearranges, and rearranges before it shrinks', () => {
    const grown = planResults({ maxW: 1232, maxH: 672, footerH: 88, one: FULL, two: FULL });
    expect(grown.columns).toBe(1);
    expect(grown.scale).toBe(1);
    expect(grown.panelH).toBeGreaterThan(640);

    const side = planResults({ maxW: 1232, maxH: 672, footerH: 144, one: FULL, two: FULL });
    expect(side.columns).toBe(2);
    expect(side.scale).toBe(1);

    const narrow = planResults({ maxW: 312, maxH: 520, footerH: 148, one: FULL, two: null });
    expect(narrow.columns).toBe(1);
    expect(narrow.scale).toBeLessThan(1);
  });
});
