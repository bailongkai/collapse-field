import { describe, it, expect } from 'vitest';
import { xpToReach, totalXpToReach } from '../../src/core/stats/xpCurve';

describe('xpToReach', () => {
  it('matches the Vampire Survivors early curve', () => {
    expect(xpToReach(2)).toBe(5);
    expect(xpToReach(3)).toBe(15);
    expect(xpToReach(4)).toBe(25);
    expect(xpToReach(19)).toBe(175);
  });
  it('adds the level-20 jump exactly once', () => {
    expect(xpToReach(20)).toBe(185 + 600);
    expect(xpToReach(21)).toBe(198);
    expect(xpToReach(22)).toBe(211);
  });
  it('adds the level-40 jump exactly once', () => {
    expect(xpToReach(39)).toBe(432);
    expect(xpToReach(40)).toBe(445 + 2400);
    expect(xpToReach(41)).toBe(461);
    expect(xpToReach(42)).toBe(477);
  });
  it('is zero below level 2 and strictly positive after', () => {
    expect(xpToReach(1)).toBe(0);
    for (let l = 2; l < 60; l++) expect(xpToReach(l)).toBeGreaterThan(0);
  });
  it('accumulates totals', () => {
    expect(totalXpToReach(2)).toBe(5);
    expect(totalXpToReach(4)).toBe(45);
  });
});
