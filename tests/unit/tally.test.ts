import { describe, it, expect } from 'vitest';
import { Simulation } from '../../src/core/sim/simulation';
import { MemoryStorage } from '../../src/core/save/memoryStorage';
import { DEFAULT_SAVE, commitRun, type SaveData } from '../../src/core/save/saveData';

describe('damage attribution', () => {
  it('credits every point dealt to the weapon slot that landed it', () => {
    const s = new Simulation({ seed: 2, characterId: 'survivor', stageId: 'station' });
    s.run.god = true;
    s.setStatOverride('growth', 0);
    s.setStatOverride('curse', -1);
    s.giveWeapon('guidedLaser', 3);
    s.spawn('mech', 6, { ring: true, radius: 120 });
    for (const e of s.world.enemies.items) if (e.active) { e.hp = 1e9; e.maxHp = 1e9; }
    s.stepMany(60 * 6);
    const dealt = s.world.enemies.items.filter((e) => e.active).reduce((n, e) => n + (1e9 - e.hp), 0);
    const tallied = s.run.damageBySlot.reduce((n, d) => n + d, 0);
    expect(tallied).toBeGreaterThan(0);
    expect(tallied).toBe(dealt);
    expect(s.run.damageBySlot[0], 'the blade in slot 0 did some of it').toBeGreaterThan(0);
    expect(s.run.damageBySlot[1], 'the laser in slot 1 did some of it').toBeGreaterThan(0);
  });
});

describe('the bestiary', () => {
  it('remembers what a run met, across runs', () => {
    const s = new Simulation({ seed: 2, characterId: 'survivor', stageId: 'station' });
    s.run.god = true;
    s.stepMany(60 * 5);
    expect(s.world.seen.has('drone')).toBe(true);
    const st = new MemoryStorage();
    const fresh: SaveData = { ...DEFAULT_SAVE, settings: { ...DEFAULT_SAVE.settings }, upgrades: {}, unlocks: { characters: [], stages: [], items: [] }, achievements: [], seen: ['robot'], stageBest: {} };
    const next = commitRun(st, fresh, { timeSec: 5, kills: 0, gold: 0, seen: [...s.world.seen] });
    expect(next.seen).toContain('drone');
    expect(next.seen).toContain('robot');
    expect(new Set(next.seen).size).toBe(next.seen.length);
  });
});
