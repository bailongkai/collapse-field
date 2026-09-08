import { describe, it, expect } from 'vitest';
import { Simulation } from '../../src/core/sim/simulation';
import { PICKUP_CAP } from '../../src/config';
import { stageDef } from '../../src/core/content/registry';
import { spawnRingRadius } from '../../src/core/sim/systems/spawnSystem';
import { REF_H, REF_W } from '../../src/config';

const stage = stageDef('station');
const newSim = (seed = 12) => {
  const s = new Simulation({ seed, characterId: 'survivor', stageId: 'station' });
  s.run.god = true;
  s.setStatOverride('growth', 0);
  return s;
};
const onGround = (s: Simulation, defId: string): number => {
  const alive = s.world.pickups.aliveList();
  let n = 0;
  for (let i = 0; i < s.world.pickups.count; i++) if (s.world.pickups.items[alive[i]].defId === defId) n++;
  return n;
};

describe('pickups do not strand', () => {
  it('a consumable left far behind is recycled, so its ground limit frees up again', () => {
    const s = newSim();
    const far = spawnRingRadius(stage, REF_W, REF_H) * stage.despawnFactor + 400;
    for (let i = 0; i < 3; i++) expect(s.spawnPickup('heal', far + i * 50, 0)).toBe(true);
    expect(onGround(s, 'heal')).toBe(3);
    // the limit is reached, so nothing new can drop
    expect(s.spawnPickup('heal', 60, 0)).toBe(false);

    s.stepMany(2);
    expect(onGround(s, 'heal'), 'stranded pickups were never recycled').toBe(0);
    expect(s.spawnPickup('heal', 60, 0)).toBe(true);
  });

  it('a pickup within reach is left alone', () => {
    const s = newSim();
    s.spawnPickup('coin', 400, 0);
    s.stepMany(2);
    expect(onGround(s, 'coin')).toBe(1);
  });

  it('a boss chest is never recycled, however far the player runs', () => {
    const s = newSim();
    const far = spawnRingRadius(stage, REF_W, REF_H) * stage.despawnFactor + 2000;
    expect(s.spawnPickup('chest', far, 0)).toBe(true);
    s.stepMany(60);
    expect(onGround(s, 'chest'), 'the chest was thrown away').toBe(1);
  });

  it('a boss chest still spawns when every other pickup slot is taken', () => {
    const s = newSim();
    // fill the pool with capped consumables the way a long run does
    for (let i = 0; i < PICKUP_CAP + 10; i++) s.spawnPickup('coin', 300 + i, 0);
    s.spawnBoss();
    const alive = s.world.enemies.aliveList();
    const boss = s.world.enemies.items[alive[s.world.enemies.count - 1]];
    s.damageEnemy(boss, 1e9, 1, 0, 0);
    expect(onGround(s, 'bossChest'), 'the boss chest was dropped on the floor of a full pool').toBe(1);
  });
});

describe('a chest is never empty', () => {
  it('gives gold when there is nothing left to upgrade', () => {
    const s = newSim();
    // a single maxed, already evolved weapon and a maxed passive: nothing at all can be raised
    s.run.weapons.length = 0;
    s.world.weaponInstances.length = 0;
    s.giveWeapon('plasmaBlade', 8);
    s.givePassive('reactorCore', 1);
    expect(s.evolveEligibleWeapon()).toBe('annihilationBlade');
    s.givePassive('reactorCore', 5);
    const gold0 = s.run.gold;
    s.spawnPickup('chest', s.world.player.x, s.world.player.y);
    s.stepMany(3);
    expect(s.run.gold, 'a chest with nothing to give gave nothing').toBeGreaterThan(gold0);
  });

  it('prefers an evolution over levels when one is available', () => {
    const s = newSim();
    s.giveWeapon('guidedLaser', 8);
    s.givePassive('coolingSystem', 1);
    s.spawnPickup('chest', s.world.player.x, s.world.player.y);
    s.stepMany(3);
    expect(s.run.weapons.map((w) => w.id)).toContain('fusionLance');
  });
});

describe('the coin ground limit cannot saturate', () => {
  it('coins left behind are recycled, so new ones keep dropping all run', () => {
    const s = newSim();
    const far = spawnRingRadius(stage, REF_W, REF_H) * stage.despawnFactor + 300;
    let placed = 0;
    for (let i = 0; i < 40; i++) if (s.spawnPickup('coin', far + i * 20, 0)) placed++;
    expect(placed, 'the ground limit should cap what can be on the floor').toBe(24);
    expect(s.spawnPickup('coin', far, 0), 'the limit is reached').toBe(false);

    s.stepMany(2);
    expect(onGround(s, 'coin'), 'stranded coins were never recycled').toBe(0);
    // ...and the run can drop coins again
    expect(s.spawnPickup('coin', 200, 0)).toBe(true);
  });
});
