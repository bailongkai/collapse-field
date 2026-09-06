import { describe, it, expect } from 'vitest';
import { SpatialGrid } from '../../src/core/spatialGrid';
import { Rng } from '../../src/core/rng';

describe('SpatialGrid', () => {
  it('queryInto matches brute force on random points', () => {
    const rng = new Rng(11);
    const grid = new SpatialGrid(64, 64, 1000);
    const xs: number[] = [];
    const ys: number[] = [];
    for (let i = 0; i < 1000; i++) {
      xs.push(rng.range(-1500, 1500));
      ys.push(rng.range(-1500, 1500));
    }
    grid.begin(0, 0);
    for (let i = 0; i < 1000; i++) grid.insert(i, xs[i], ys[i]);

    const out = new Int32Array(1000);
    for (let trial = 0; trial < 40; trial++) {
      const cx = rng.range(-1200, 1200);
      const cy = rng.range(-1200, 1200);
      const r = rng.range(20, 300);
      const n = grid.queryInto(cx - r, cy - r, cx + r, cy + r, out);
      const got = new Set(Array.from(out.subarray(0, n)));
      const expected = new Set<number>();
      for (let i = 0; i < 1000; i++) {
        if (xs[i] >= cx - r && xs[i] <= cx + r && ys[i] >= cy - r && ys[i] <= cy + r) expected.add(i);
      }
      expect(got).toEqual(expected);
    }
  });

  it('ignores points outside the anchored window', () => {
    const grid = new SpatialGrid(64, 8, 10); // window is 512px wide, centred on the origin
    grid.begin(0, 0);
    grid.insert(0, 0, 0);
    grid.insert(1, 5000, 5000);
    expect(grid.inserted).toBe(1);
    const out = new Int32Array(10);
    expect(grid.queryInto(-10000, -10000, 10000, 10000, out)).toBe(1);
    expect(out[0]).toBe(0);
  });

  it('forEachPair visits each nearby pair exactly once', () => {
    const rng = new Rng(5);
    const grid = new SpatialGrid(64, 32, 200);
    const xs: number[] = [];
    const ys: number[] = [];
    for (let i = 0; i < 200; i++) {
      xs.push(rng.range(-400, 400));
      ys.push(rng.range(-400, 400));
    }
    grid.begin(0, 0);
    for (let i = 0; i < 200; i++) grid.insert(i, xs[i], ys[i]);

    const seen = new Map<string, number>();
    grid.forEachPair((a, b) => {
      const key = a < b ? `${a}:${b}` : `${b}:${a}`;
      seen.set(key, (seen.get(key) ?? 0) + 1);
    });
    for (const [key, times] of seen) expect(times, key).toBe(1);

    // every pair closer than one cell must be visited
    for (let i = 0; i < 200; i++) {
      for (let j = i + 1; j < 200; j++) {
        if (Math.hypot(xs[i] - xs[j], ys[i] - ys[j]) < 64) {
          const key = `${i}:${j}`;
          expect(seen.has(key), `missing pair ${key}`).toBe(true);
        }
      }
    }
  });

  it('begin() clears the previous contents', () => {
    const grid = new SpatialGrid(64, 16, 10);
    grid.begin(0, 0);
    grid.insert(0, 0, 0);
    grid.begin(0, 0);
    const out = new Int32Array(10);
    expect(grid.queryInto(-500, -500, 500, 500, out)).toBe(0);
  });
});
