import { describe, it, expect } from 'vitest';
import { Rng, hash2 } from '../../src/core/rng';

describe('Rng', () => {
  it('same seed gives the same sequence', () => {
    const a = new Rng(123);
    const b = new Rng(123);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });
  it('different seeds differ', () => {
    expect(new Rng(1).next()).not.toBe(new Rng(2).next());
  });
  it('next() stays in [0,1) and int() in bounds', () => {
    const r = new Rng(7);
    for (let i = 0; i < 1000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      const n = r.int(3, 5);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(5);
    }
  });
  it('weightedIndex respects weights and handles empty', () => {
    const r = new Rng(9);
    const counts = [0, 0, 0];
    for (let i = 0; i < 3000; i++) counts[r.weightedIndex([1, 0, 3])]++;
    expect(counts[1]).toBe(0);
    expect(counts[2]).toBeGreaterThan(counts[0] * 2);
    expect(r.weightedIndex([])).toBe(-1);
    expect(r.weightedIndex([0, 0])).toBe(-1);
  });
  it('hash2 is deterministic and spreads', () => {
    expect(hash2(3, 4)).toBe(hash2(3, 4));
    expect(hash2(3, 4)).not.toBe(hash2(4, 3));
  });
});
