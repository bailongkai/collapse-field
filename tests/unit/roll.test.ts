import { describe, it, expect } from 'vitest';
import { rollLevelUp, describeDeltas } from '../../src/core/levelup/roll';
import { CONTENT } from '../../src/core/content/registry';
import { Rng } from '../../src/core/rng';
import type { OwnedItem } from '../../src/core/sim/runState';

const roll = (o: Partial<Parameters<typeof rollLevelUp>[0]> = {}) =>
  rollLevelUp({ weapons: [], passives: [], luck: 1, rng: new Rng(7), reg: CONTENT, ...o });

describe('rollLevelUp', () => {
  it('offers three cards by default', () => {
    expect(roll()).toHaveLength(3);
  });

  it('never offers the same item twice in one roll', () => {
    for (let seed = 0; seed < 50; seed++) {
      const picks = roll({ rng: new Rng(seed) });
      const ids = picks.map((p) => ('id' in p ? p.id : p.kind));
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('never offers a maxed item', () => {
    const weapons: OwnedItem[] = Object.values(CONTENT.weapons).map((w) => ({ id: w.id, level: w.maxLevel }));
    const passives: OwnedItem[] = Object.values(CONTENT.passives).map((p) => ({ id: p.id, level: p.maxLevel }));
    for (let seed = 0; seed < 20; seed++) {
      const picks = rollLevelUp({ weapons, passives, luck: 1, rng: new Rng(seed), reg: CONTENT });
      for (const p of picks) expect(['gold', 'heal']).toContain(p.kind);
    }
  });

  it('falls back to gold and heal when nothing can be offered', () => {
    const weapons: OwnedItem[] = Object.values(CONTENT.weapons).map((w) => ({ id: w.id, level: w.maxLevel }));
    const passives: OwnedItem[] = Object.values(CONTENT.passives).map((p) => ({ id: p.id, level: p.maxLevel }));
    const picks = rollLevelUp({ weapons, passives, luck: 1, rng: new Rng(3), reg: CONTENT });
    expect(picks.map((p) => p.kind).sort()).toEqual(['gold', 'heal']);
  });

  it('only offers new items while a slot is free', () => {
    const weapons: OwnedItem[] = Object.values(CONTENT.weapons).map((w) => ({ id: w.id, level: 1 }));
    // five weapons owned, one slot left, so a sixth weapon could still be offered if one existed
    const picks = rollLevelUp({ weapons, passives: [], luck: 1, rng: new Rng(2), reg: CONTENT });
    for (const p of picks) {
      if (p.kind === 'weapon') expect(p.toLevel).toBe(2);
    }
  });

  it('luck above 1 grants a fourth card proportionally', () => {
    let four = 0;
    for (let seed = 0; seed < 200; seed++) {
      if (rollLevelUp({ weapons: [], passives: [], luck: 1.5, rng: new Rng(seed), reg: CONTENT }).length === 4) four++;
    }
    expect(four).toBeGreaterThan(60);
    expect(four).toBeLessThan(140);

    let anyFour = 0;
    for (let seed = 0; seed < 100; seed++) {
      if (roll({ rng: new Rng(seed) }).length === 4) anyFour++;
    }
    expect(anyFour).toBe(0);
  });

  it('is deterministic for the same seed', () => {
    expect(roll({ rng: new Rng(123) })).toEqual(roll({ rng: new Rng(123) }));
  });

  it('respects the exclusion set', () => {
    const excluded = new Set(['plasmaBlade', 'guidedLaser']);
    for (let seed = 0; seed < 30; seed++) {
      for (const p of roll({ rng: new Rng(seed), excluded })) {
        if ('id' in p) expect(excluded.has(p.id)).toBe(false);
      }
    }
  });
});

describe('describeDeltas', () => {
  it('renders flat and percentage deltas with a sign', () => {
    expect(describeDeltas({ damage: 5, amount: 1 })).toEqual([
      { key: 'delta.damage', value: '+5' },
      { key: 'delta.amount', value: '+1' },
    ]);
    expect(describeDeltas({ area: 0.1 })).toEqual([{ key: 'delta.area', value: '+10%' }]);
    expect(describeDeltas({ cooldown: -200 })).toEqual([{ key: 'delta.cooldown', value: '-200' }]);
  });
  it('skips zero and undefined entries', () => {
    expect(describeDeltas({ damage: 0, area: undefined })).toEqual([]);
  });
});
