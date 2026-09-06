import { describe, it, expect } from 'vitest';
import { MemoryStorage } from '../../src/core/save/memoryStorage';
import { DEFAULT_SAVE, loadSave, writeSave } from '../../src/core/save/saveData';
import { buyUpgrade, metaBonuses, upgradeCost, upgradeLevel } from '../../src/core/save/upgrades';
import { UPGRADES } from '../../src/data/upgrades';
import { Simulation } from '../../src/core/sim/simulation';

const fresh = (gold = 0) => ({ ...DEFAULT_SAVE, settings: { ...DEFAULT_SAVE.settings }, upgrades: {}, gold });

describe('permanent upgrades', () => {
  it('costs escalate and end at max level', () => {
    expect(upgradeCost(UPGRADES.hull, 0)).toBe(100);
    expect(upgradeCost(UPGRADES.hull, 1)).toBeGreaterThan(100);
    expect(upgradeCost(UPGRADES.hull, UPGRADES.hull.maxLevel)).toBeNull();
  });

  it('buying deducts gold, raises the level and persists', () => {
    const st = new MemoryStorage();
    const r = buyUpgrade(st, fresh(500), 'hull');
    expect(r.result).toBe('bought');
    expect(r.save.gold).toBe(400);
    expect(upgradeLevel(r.save, 'hull')).toBe(1);
    expect(upgradeLevel(loadSave(st), 'hull')).toBe(1);
  });

  it('refuses when poor, maxed or unknown', () => {
    const st = new MemoryStorage();
    expect(buyUpgrade(st, fresh(10), 'hull').result).toBe('poor');
    const maxed = { ...fresh(99999), upgrades: { revival: 1 } };
    expect(buyUpgrade(st, maxed, 'revival').result).toBe('maxed');
    expect(buyUpgrade(st, fresh(999), 'nope').result).toBe('unknown');
  });

  it('bonuses add like a passive and reach the run', () => {
    const save = { ...fresh(), upgrades: { hull: 2, plating: 1 } };
    const bonuses = metaBonuses(save);
    expect(bonuses.maxHealth).toBeCloseTo(0.2, 6);
    expect(bonuses.armor).toBe(1);
    const s = new Simulation({ seed: 1, characterId: 'survivor', stageId: 'station', metaBonuses: bonuses });
    expect(s.stats.maxHealth).toBeCloseTo(120, 6);
    expect(s.stats.armor).toBe(1);
    expect(s.world.player.hp).toBeCloseTo(120, 6);
  });

  it('survives a save round trip and ignores garbage', () => {
    const st = new MemoryStorage();
    writeSave(st, { ...fresh(50), upgrades: { hull: 3, bogus: -2 } });
    const loaded = loadSave(st);
    expect(loaded.upgrades.hull).toBe(3);
    expect(loaded.upgrades.bogus).toBeUndefined();
    expect(loaded.gold).toBe(50);
  });

  it('revival from the shop actually revives once', () => {
    const s = new Simulation({ seed: 2, characterId: 'survivor', stageId: 'station', metaBonuses: { revival: 1 } });
    s.setStatOverride('moveSpeed', 0);
    s.spawn('mech', 8, { x: 0, y: 0 });
    s.stepMany(60 * 6);
    expect(s.run.revivalsUsed).toBe(1);
  });
});
