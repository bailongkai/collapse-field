import { describe, it, expect } from 'vitest';
import { Simulation } from '../../src/core/sim/simulation';
import { rollLevelUp } from '../../src/core/levelup/roll';
import { CONTENT } from '../../src/core/content/registry';
import { Rng } from '../../src/core/rng';
import type { Enemy } from '../../src/core/sim/entities/enemy';

const newSim = (seed = 8) => {
  const s = new Simulation({ seed, characterId: 'survivor', stageId: 'station' });
  s.run.god = true;
  s.setStatOverride('growth', 0);
  return s;
};
const first = (s: Simulation, behavior: Enemy['behavior']): Enemy => {
  const alive = s.world.enemies.aliveList();
  for (let i = 0; i < s.world.enemies.count; i++) {
    const e = s.world.enemies.items[alive[i]];
    if (e.behavior === behavior) return e;
  }
  throw new Error(`no ${behavior}`);
};
const hostileBolts = (s: Simulation) => s.world.projectiles.items.filter((p) => p.active && p.hostile);

describe('酸液喷吐者 (ranged)', () => {
  it('keeps its distance instead of walking into the blade', () => {
    const s = newSim();
    s.setStatOverride('moveSpeed', 0);
    s.spawn('spitter', 1, { x: 500, y: 0 });
    const e = first(s, 'ranged');
    s.stepMany(60 * 8);
    const dist = Math.hypot(e.x, e.y);
    expect(dist).toBeGreaterThan(150);
    expect(dist).toBeLessThan(360);
  });

  it('fires bolts that hurt the player and never enemies', () => {
    const s = newSim();
    s.run.god = false;
    s.setStatOverride('moveSpeed', 0);
    s.run.weapons.length = 0;
    s.world.weaponInstances.length = 0;
    s.spawn('spitter', 1, { x: 240, y: 0 });
    s.spawn('robot', 1, { x: 120, y: 0 }); // in the line of fire
    const robot = first(s, 'chase');
    robot.hp = 1e6;
    const hp0 = s.world.player.hp;
    s.stepMany(60 * 4);
    expect(hostileBolts(s).length + (hp0 - s.world.player.hp)).toBeGreaterThan(0);
    expect(robot.hp).toBe(1e6);
    // move the robot away and let the bolts land
    robot.x = 2000;
    s.stepMany(60 * 6);
    expect(s.world.player.hp).toBeLessThan(hp0);
  });

  it('bolts respect god mode and i-frames', () => {
    const s = newSim();
    s.setStatOverride('moveSpeed', 0);
    s.spawn('spitter', 4, { x: 240, y: 0 });
    const hp0 = s.world.player.hp;
    s.stepMany(60 * 6);
    expect(s.world.player.hp).toBe(hp0);
  });
});

describe('突袭者 (dasher)', () => {
  it('telegraphs before lunging and moves far faster during the lunge', () => {
    const s = newSim();
    s.setStatOverride('moveSpeed', 0);
    s.spawn('dasher', 1, { x: 400, y: 0 });
    const e = first(s, 'dasher');
    // walk in until the trigger range
    let ticks = 0;
    while (e.aiState === 0 && ticks < 600) {
      s.stepMany(1);
      ticks++;
    }
    expect(e.aiState).toBe(1);
    const xAtTelegraph = e.x;
    s.stepMany(20); // still telegraphing (500 ms)
    expect(e.x).toBe(xAtTelegraph);
    expect(e.flashMs).toBeGreaterThan(0);
    s.stepMany(12); // into the dash
    expect(e.aiState).toBe(2);
    const before = e.x;
    s.stepMany(6);
    const perTick = Math.abs(e.x - before) / 6;
    expect(perTick).toBeGreaterThan((75 * 3) / 60);
  });

  it('is on cooldown after a lunge', () => {
    const s = newSim();
    s.setStatOverride('moveSpeed', 0);
    s.spawn('dasher', 1, { x: 200, y: 0 });
    const e = first(s, 'dasher');
    s.stepMany(60 * 2);
    expect(e.aiState).toBe(0);
    expect(e.aiTimer2).toBeGreaterThan(0);
  });
});

describe('母舰 boss mechanics', () => {
  it('charges on a timer with a warning, and summons drones', () => {
    const s = newSim();
    s.setStatOverride('moveSpeed', 0);
    s.spawnBoss();
    const boss = first(s, 'boss');
    const drones0 = s.world.enemies.count - 1;
    let sawTelegraph = false;
    let sawCharge = false;
    let maxStep = 0;
    let lastX = boss.x;
    for (let t = 0; t < 60 * 12; t++) {
      s.stepMany(1);
      if (boss.aiState === 1) sawTelegraph = true;
      if (boss.aiState === 2) {
        sawCharge = true;
        maxStep = Math.max(maxStep, Math.abs(boss.x - lastX));
      }
      lastX = boss.x;
    }
    expect(sawTelegraph).toBe(true);
    expect(sawCharge).toBe(true);
    expect(maxStep).toBeGreaterThan((55 * 3) / 60);
    expect(s.world.enemies.count - 1).toBeGreaterThan(drones0);
  });
});

describe('weapon evolution', () => {
  it('a chest evolves a maxed weapon whose passive is owned, in the same slot', () => {
    const s = newSim();
    s.giveWeapon('guidedLaser', 8);
    s.givePassive('coolingSystem', 1);
    expect(s.evolvableWeapon()).toEqual({ id: 'guidedLaser', into: 'fusionLance' });
    s.spawnPickup('chest', s.world.player.x, s.world.player.y);
    s.stepMany(2);
    expect(s.run.weapons.map((w) => w.id)).toContain('fusionLance');
    expect(s.run.weapons.map((w) => w.id)).not.toContain('guidedLaser');
    const inst = s.world.weaponInstances.find((i) => i.defId === 'fusionLance');
    expect(inst?.slot).toBe(1);
  });

  it('does not evolve without the passive, or below max level', () => {
    const a = newSim();
    a.giveWeapon('guidedLaser', 8);
    expect(a.evolvableWeapon()).toBeNull();
    const b = newSim();
    b.giveWeapon('guidedLaser', 7);
    b.givePassive('coolingSystem', 1);
    expect(b.evolvableWeapon()).toBeNull();
  });

  it('the evolved weapon is stronger and still fires', () => {
    const s = newSim();
    s.run.weapons.length = 0;
    s.world.weaponInstances.length = 0;
    s.giveWeapon('guidedLaser', 8);
    s.givePassive('coolingSystem', 1);
    s.evolveEligibleWeapon();
    s.spawn('mech', 30, { radius: 200 });
    s.stepMany(60 * 6);
    expect(s.run.kills).toBeGreaterThan(5);
  });

  it('every base weapon has a reachable evolution', () => {
    for (const w of CONTENT.weaponList) {
      if (w.evolvedOnly) continue;
      expect(w.evolution, w.id).toBeDefined();
      expect(CONTENT.weapons[w.evolution!.into].evolvedOnly).toBe(true);
    }
  });

  it('evolutions are never offered, and an evolved base cannot be picked up again', () => {
    for (let seed = 0; seed < 40; seed++) {
      const picks = rollLevelUp({
        weapons: [{ id: 'fusionLance', level: 8 }],
        passives: [],
        luck: 1,
        rng: new Rng(seed),
        reg: CONTENT,
      });
      for (const p of picks) {
        if (p.kind !== 'weapon') continue;
        expect(CONTENT.weapons[p.id].evolvedOnly, p.id).toBeFalsy();
        expect(p.id).not.toBe('guidedLaser');
      }
    }
  });
});
