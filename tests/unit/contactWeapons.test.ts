import { describe, it, expect } from 'vitest';
import { Simulation } from '../../src/core/sim/simulation';
import { PULSE_MS } from '../../src/core/weapons/behaviors/aura';
import type { Enemy } from '../../src/core/sim/entities/enemy';

/**
 * The two contact weapons and the player who keeps their distance. Measured over the first two
 * minutes, a kiting Maintenance Unit killed eight and a kiting Navigator one, because an aura of
 * eighty units and a ring of fifty never touch a body that follows at arm's length. The field now
 * breathes the followers in while it is empty, and the ring leans towards a body within reach.
 */
const quiet = (seed = 2) => {
  const s = new Simulation({ seed, characterId: 'survivor', stageId: 'station' });
  // the station opens with bodies on both sides of the player; these tests want an empty floor
  s.world.enemies.clear();
  s.run.god = true;
  s.setStatOverride('growth', 0);
  s.setStatOverride('curse', -1);
  s.run.weapons.length = 0;
  s.world.weaponInstances.length = 0;
  return s;
};
const tank = (s: Simulation, id: string, x: number, y = 0): Enemy => {
  s.spawn(id, 1, { x, y });
  const alive = s.world.enemies.aliveList();
  const e = s.world.enemies.items[alive[s.world.enemies.count - 1]];
  e.hp = 1e9;
  e.maxHp = 1e9;
  e.speedMult = 0;
  return e;
};

describe('the drones lean towards a body in reach', () => {
  it('reach a body a plain ring of fifty could not, and settle back when it is gone', () => {
    const s = quiet();
    s.giveWeapon('orbitalDrones', 1);
    const e = tank(s, 'drone', 100); // 50 + 14 + 14 = 78 is as far as a plain ring touches
    s.stepMany(120);
    expect(1e9 - e.hp, 'the ring never reached the body').toBeGreaterThan(0);
    const inst = s.world.weaponInstances[0];
    expect(inst.lean).toBeCloseTo(1, 6);
    s.killEnemy(e);
    s.stepMany(60);
    expect(inst.lean).toBe(0);
    for (const p of s.world.projectiles.items) {
      if (p.active && p.kind === 'orbit') expect(Math.hypot(p.x - s.world.player.x, p.y - s.world.player.y)).toBeCloseTo(50, 1);
    }
  });

  it('the lean turns rather than snaps when the nearest body changes', () => {
    const s = quiet();
    s.giveWeapon('orbitalDrones', 1);
    const right = tank(s, 'drone', 110, 0);
    s.stepMany(90);
    const inst = s.world.weaponInstances[0];
    expect(Math.abs(inst.leanAngle)).toBeLessThan(0.05);
    s.killEnemy(right);
    tank(s, 'drone', 0, 110);
    s.stepMany(2);
    // two ticks later it has turned a little of the quarter turn, not all of it
    expect(inst.leanAngle).toBeGreaterThan(0.05);
    expect(inst.leanAngle).toBeLessThan(Math.PI / 2 - 0.5);
  });

  it('does not lean with nothing in reach, so an empty field is the plain ring', () => {
    const s = quiet();
    s.giveWeapon('orbitalDrones', 1);
    tank(s, 'drone', 400);
    s.stepMany(60);
    expect(s.world.weaponInstances[0].lean).toBe(0);
  });
});

describe('the field breathes in', () => {
  it('pulls a follower just outside the field into it every three seconds, and says so', () => {
    const s = quiet();
    s.giveWeapon('empField', 1);
    const e = tank(s, 'drone', 130); // outside the 80 field, inside its 160 reach
    const d0 = Math.hypot(e.x, e.y);
    let pulses = 0;
    for (let t = 0; t < Math.ceil(PULSE_MS / (1000 / 60)) + 30; t++) {
      s.step();
      for (let i = 0; i < s.world.events.length; i++) if (s.world.events.at(i).type === 'auraPulse') pulses++;
      s.world.events.clear();
    }
    expect(pulses).toBe(1);
    expect(d0 - Math.hypot(e.x, e.y), 'the body was not drawn in').toBeGreaterThan(20);
    expect(1e9 - e.hp, 'and it was not hit once it was in').toBeGreaterThan(0);
  });

  it('holds its breath while the crowd is already on the player', () => {
    const s = quiet();
    s.giveWeapon('empField', 1);
    for (const [x, y] of [[40, 0], [-40, 0], [0, 40], [0, -40]]) tank(s, 'drone', x, y);
    const far = tank(s, 'drone', 130, 60);
    const d0 = Math.hypot(far.x, far.y);
    let pulses = 0;
    for (let t = 0; t < Math.ceil((PULSE_MS * 2) / (1000 / 60)) + 10; t++) {
      s.step();
      for (let i = 0; i < s.world.events.length; i++) if (s.world.events.at(i).type === 'auraPulse') pulses++;
      s.world.events.clear();
    }
    expect(pulses).toBe(0);
    expect(Math.hypot(far.x, far.y)).toBeGreaterThanOrEqual(d0 - 1);
  });

  it('spares a boss and respects knockback resistance', () => {
    const s = quiet();
    s.giveWeapon('empField', 1);
    s.spawnBoss();
    const boss = s.world.enemies.items.find((e) => e.active && e.def?.bossBar)!;
    boss.x = 130;
    boss.y = 0;
    boss.speedMult = 0;
    boss.hp = boss.maxHp = 1e9;
    const mech = tank(s, 'mech', -130, 0); // resist 0.8
    const drone = tank(s, 'drone', 0, 130); // resist 0
    s.stepMany(Math.ceil(PULSE_MS / (1000 / 60)) + 20);
    expect(boss.x).toBe(130);
    expect(130 - Math.hypot(mech.x, mech.y)).toBeLessThan(130 - Math.hypot(drone.x, drone.y));
  });
});
