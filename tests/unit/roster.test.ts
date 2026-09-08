import { describe, it, expect } from 'vitest';
import { Simulation } from '../../src/core/sim/simulation';
import { CHARACTER_LIST } from '../../src/data/characters';
import { STAGE_ORDER } from '../../src/data/stages';

describe('characters', () => {
  it('each starts with its own weapon and its own stats', () => {
    const seen = new Set<string>();
    for (const c of CHARACTER_LIST) {
      const s = new Simulation({ seed: 1, characterId: c.id, stageId: 'station' });
      expect(s.run.weapons.map((w) => w.id)).toEqual([c.startingWeapon]);
      expect(s.stats.maxHealth).toBeCloseTo(c.baseStats.maxHealth, 6);
      expect(s.world.player.hp).toBeCloseTo(c.baseStats.maxHealth, 6);
      seen.add(c.startingWeapon);
    }
    // five characters, five starting weapons: no two play the same opening
    expect(seen.size).toBe(CHARACTER_LIST.length);
  });

  it('level bonuses reach the stats', () => {
    const s = new Simulation({ seed: 1, characterId: 'unit', stageId: 'station' });
    const armor0 = s.stats.armor;
    s.setLevel(12);
    expect(s.stats.armor).toBe(armor0 + 1);
  });
});

describe('stages', () => {
  it('every stage runs a full minute from a cold start without throwing', () => {
    for (const st of STAGE_ORDER) {
      const s = new Simulation({ seed: 3, characterId: 'survivor', stageId: st.id });
      s.run.god = true;
      s.setStatOverride('growth', 0);
      s.stepMany(60 * 60);
      expect(s.run.timeMs).toBeGreaterThanOrEqual(59_999);
      expect(s.world.enemies.count, `${st.id} spawned nothing`).toBeGreaterThan(0);
    }
  });

  it('the orbit wave speed multiplier really moves enemies faster', () => {
    const speedOf = (stageId: string): number => {
      const s = new Simulation({ seed: 4, characterId: 'survivor', stageId });
      s.run.god = true;
      s.setStatOverride('might', 0);
      s.setStatOverride('moveSpeed', 0);
      // the orbit only starts pushing speed once a build has had a few minutes
      s.setTime(240);
      s.stepMany(60 * 20);
      const alive = s.world.enemies.aliveList();
      let best = 0;
      for (let i = 0; i < s.world.enemies.count; i++) best = Math.max(best, s.world.enemies.items[alive[i]].speedMult);
      return best;
    };
    expect(speedOf('station')).toBe(1);
    expect(speedOf('orbit')).toBeGreaterThan(1);
  });

  it('a wave speed multiplier scales the body the player sees, not just a number', () => {
    const s = new Simulation({ seed: 5, characterId: 'survivor', stageId: 'station' });
    s.run.god = true;
    s.setStatOverride('might', 0);
    s.setStatOverride('moveSpeed', 0);
    s.spawn('drone', 1, { x: 800, y: 0 });
    const alive = s.world.enemies.aliveList();
    const e = s.world.enemies.items[alive[s.world.enemies.count - 1]];
    e.speedMult = 1.5;
    const x0 = e.x;
    s.stepMany(60);
    expect(x0 - e.x).toBeCloseTo(70 * 1.5, -1);
  });
});
