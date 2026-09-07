import { describe, it, expect } from 'vitest';
import { Simulation } from '../../src/core/sim/simulation';
import { MAX_ENEMY_RADIUS, REF_H, REF_W } from '../../src/config';
import { ENEMY_LIST } from '../../src/data/enemies';
import { stageDef } from '../../src/core/content/registry';
import type { Enemy } from '../../src/core/sim/entities/enemy';

const newSim = (seed = 31) => {
  const s = new Simulation({ seed, characterId: 'survivor', stageId: 'station' });
  s.run.god = true;
  s.setStatOverride('growth', 0);
  return s;
};
const byBehavior = (s: Simulation, b: Enemy['behavior']): Enemy[] => {
  const out: Enemy[] = [];
  const alive = s.world.enemies.aliveList();
  for (let i = 0; i < s.world.enemies.count; i++) {
    const e = s.world.enemies.items[alive[i]];
    if (e.behavior === b) out.push(e);
  }
  return out;
};

describe('broadphase padding', () => {
  it('MAX_ENEMY_RADIUS covers every enemy in the data', () => {
    for (const e of ENEMY_LIST) expect(e.radius, e.id).toBeLessThanOrEqual(MAX_ENEMY_RADIUS);
  });

  it('the aura reaches a large body whose centre is outside the field', () => {
    const s = newSim();
    s.run.weapons.length = 0;
    s.world.weaponInstances.length = 0;
    s.giveWeapon('empField', 1);
    s.setStatOverride('area', 2); // field radius 160
    s.setStatOverride('moveSpeed', 0);
    // the mothership's radius is 60, so at 200 px the bodies overlap but its centre is not in the field
    s.spawn('mothership', 1, { x: 200, y: 0 });
    const boss = byBehavior(s, 'boss')[0];
    boss.hp = 1e9;
    boss.maxHp = 1e9;
    s.stepMany(3);
    expect(1e9 - boss.hp, 'a body overlapping the field took no damage').toBeGreaterThan(0);
  });

  it('the blade sweep reaches a large body at the edge of its rectangle', () => {
    const s = newSim();
    s.setStatOverride('moveSpeed', 0);
    s.spawn('mothership', 1, { x: 175, y: 0 }); // 140 px reach + 60 px radius overlaps at 175
    const boss = byBehavior(s, 'boss')[0];
    boss.hp = 1e9;
    boss.maxHp = 1e9;
    s.setInput(1, 0);
    s.stepMany(1);
    expect(1e9 - boss.hp).toBeGreaterThan(0);
  });
});

describe('swarm shape', () => {
  it('a diagonal rush arrives as a wall across its travel direction, not a column along it', () => {
    const stage = stageDef('station');
    const diag = stage.events.findIndex((e) => e.kind === 'swarm' && e.pattern === 'diag');
    expect(diag).toBeGreaterThanOrEqual(0);
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const s = newSim(seed);
      s.setStatOverride('moveSpeed', 0);
      s.triggerEvent(diag);
      const line = byBehavior(s, 'line');
      expect(line.length).toBeGreaterThan(10);
      const dirX = line[0].dirX;
      const dirY = line[0].dirY;
      // spread measured across the direction of travel must dominate the spread along it
      const along = line.map((e) => e.x * dirX + e.y * dirY);
      const across = line.map((e) => -e.x * dirY + e.y * dirX);
      const span = (v: number[]) => Math.max(...v) - Math.min(...v);
      expect(span(across), `seed ${seed}: across ${span(across)} vs along ${span(along)}`).toBeGreaterThan(span(along) * 4);
    }
  });
});

describe('event ring capacity', () => {
  it('a screen clear at late-game density does not lose its own event', () => {
    const s = new Simulation({ seed: 41, characterId: 'survivor', stageId: 'station', viewW: 1760, viewH: REF_H });
    s.run.god = true;
    s.setStatOverride('growth', 0);
    s.setStatOverride('moveSpeed', 0);
    s.spawn('drone', 400, { radius: 300 });
    s.world.events.clear();
    s.spawnPickup('nuke', s.world.player.x, s.world.player.y);
    s.stepMany(2);
    const types: string[] = [];
    for (let i = 0; i < s.world.events.length; i++) types.push(s.world.events.at(i).type);
    expect(types, 'the nuke event was dropped by a full ring').toContain('nuke');
    expect(s.world.events.length).toBeLessThan(4096);
  });
});

void REF_W;
