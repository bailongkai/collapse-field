import { describe, it, expect } from 'vitest';
import { Simulation } from '../../src/core/sim/simulation';
import type { Enemy } from '../../src/core/sim/entities/enemy';
import { FIXED_DT_MS } from '../../src/config';

const newSim = (seed = 2) => {
  const s = new Simulation({ seed, characterId: 'survivor', stageId: 'station' });
  s.run.god = true;
  return s;
};
const tank = (s: Simulation, id: string, x: number, y = 0): Enemy => {
  s.spawn(id, 1, { x, y });
  const alive = s.world.enemies.aliveList();
  const e = s.world.enemies.items[alive[s.world.enemies.count - 1]];
  e.hp = 1e9;
  e.maxHp = 1e9;
  return e;
};
const bolts = (s: Simulation) => s.world.projectiles.items.filter((p) => p.active && p.kind === 'bolt');
const orbiters = (s: Simulation) => s.world.projectiles.items.filter((p) => p.active && p.kind === 'orbit');

describe('stream (磁轨炮)', () => {
  it('fires along the facing direction without needing a target', () => {
    const s = newSim();
    s.giveWeapon('railgun', 1);
    s.setInput(1, 0);
    s.stepMany(2);
    const shots = bolts(s);
    expect(shots.length).toBeGreaterThan(0);
    for (const b of shots) expect(b.vx).toBeGreaterThan(0);
  });

  it('keeps the spread within six degrees', () => {
    const s = newSim();
    s.giveWeapon('railgun', 8);
    s.setInput(1, 0);
    s.stepMany(40);
    for (const b of bolts(s)) {
      expect(Math.abs(Math.atan2(b.vy, b.vx))).toBeLessThanOrEqual((6 * Math.PI) / 180 + 1e-6);
    }
  });

  it('level 8 fires six rounds with three pierce', () => {
    const s = newSim();
    s.giveWeapon('railgun', 8);
    s.setStatOverride('cooldown', 10);
    s.setInput(1, 0);
    s.stepMany(60);
    expect(bolts(s).length).toBe(6);
    expect(bolts(s)[0].pierce).toBe(3);
  });
});

describe('orbit (轨道无人机)', () => {
  it('spawns evenly spaced drones that circle the player', () => {
    const s = newSim();
    s.giveWeapon('orbitalDrones', 5); // amount 3 at level 5
    s.stepMany(2);
    const ring = orbiters(s);
    expect(ring.length).toBeGreaterThanOrEqual(2);
    const angles = ring.map((p) => Math.atan2(p.y - s.world.player.y, p.x - s.world.player.x)).sort((a, b) => a - b);
    for (let i = 1; i < angles.length; i++) {
      expect(angles[i] - angles[i - 1]).toBeGreaterThan(0.5);
    }
    const before = angles[0];
    s.stepMany(15);
    const after = Math.atan2(orbiters(s)[0].y - s.world.player.y, orbiters(s)[0].x - s.world.player.x);
    expect(after).not.toBeCloseTo(before, 3);
  });

  it('follows the player as they move', () => {
    const s = newSim();
    s.giveWeapon('orbitalDrones', 1);
    s.stepMany(2);
    s.setInput(1, 0);
    s.stepMany(30);
    for (const p of orbiters(s)) {
      expect(Math.hypot(p.x - s.world.player.x, p.y - s.world.player.y)).toBeLessThan(140);
    }
  });

  it('re-arms its cooldown only after the last drone expires', () => {
    const s = newSim();
    s.giveWeapon('orbitalDrones', 1);
    s.stepMany(2);
    const inst = s.world.weaponInstances.find((i) => i.defId === 'orbitalDrones')!;
    expect(inst.cooldownLeft).toBe(Infinity);
    expect(orbiters(s).length).toBe(1);
    // duration is 3000 ms
    s.stepMany(Math.ceil(3000 / FIXED_DT_MS) + 2);
    expect(orbiters(s).length).toBe(0);
    expect(inst.cooldownLeft).toBeLessThan(Infinity);
    expect(inst.cooldownLeft).toBeGreaterThan(0);
  });

  it('hits a passing enemy on its own interval, not every tick', () => {
    const s = newSim();
    s.giveWeapon('orbitalDrones', 1);
    const e = tank(s, 'mech', 90);
    s.stepMany(120);
    const hits = (1e9 - e.hp) / 10;
    // 2 seconds with a 500 ms interval allows at most a handful of hits
    expect(hits).toBeGreaterThan(0);
    expect(hits).toBeLessThanOrEqual(6);
  });
});

describe('aura (EMP力场)', () => {
  it('damages everything inside the field without any projectile', () => {
    const s = newSim();
    s.giveWeapon('empField', 1);
    const near = tank(s, 'mech', 60);
    const far = tank(s, 'mech', 600);
    s.stepMany(5);
    expect(1e9 - near.hp).toBeGreaterThan(0);
    expect(far.hp).toBe(1e9);
    expect(s.world.projectiles.items.filter((p) => p.active && p.kind === 'bolt')).toHaveLength(0);
  });

  it('respects the per-enemy hit interval in whole ticks', () => {
    const s = newSim();
    s.giveWeapon('empField', 1);
    const e = tank(s, 'mech', 60);
    s.stepMany(1);
    const afterFirst = 1e9 - e.hp;
    expect(afterFirst).toBeGreaterThan(0);
    s.stepMany(60); // one second, interval is 1300 ms
    expect(1e9 - e.hp).toBe(afterFirst);
    s.stepMany(30);
    expect(1e9 - e.hp).toBeGreaterThan(afterFirst);
  });

  it('hits a freshly spawned enemy immediately even when it reuses a slot', () => {
    const s = newSim();
    s.giveWeapon('empField', 1);
    const first = tank(s, 'mech', 50);
    s.stepMany(2);
    expect(1e9 - first.hp).toBeGreaterThan(0);
    s.killEnemy(first);
    const second = tank(s, 'mech', 50);
    expect(second.id).toBe(first.id); // the slot really is reused
    s.stepMany(1);
    expect(1e9 - second.hp).toBeGreaterThan(0);
  });

  it('the area stat widens the field', () => {
    const s = newSim();
    s.giveWeapon('empField', 1);
    s.setStatOverride('area', 3);
    const e = tank(s, 'mech', 190);
    s.stepMany(2);
    expect(1e9 - e.hp).toBeGreaterThan(0);
  });

  it('pushes enemies away from the player', () => {
    const s = newSim();
    s.giveWeapon('empField', 1);
    const e = tank(s, 'drone', 40);
    s.stepMany(1);
    expect(e.kbx).toBeGreaterThan(0);
  });
});

describe('the whole kit together', () => {
  it('every weapon at level 4 clears a ring of a hundred drones', () => {
    for (const id of ['plasmaBlade', 'guidedLaser', 'railgun', 'orbitalDrones', 'empField']) {
      const s = newSim(7);
      s.setStatOverride('growth', 0); // no level-ups, so the run never freezes
      if (id !== 'plasmaBlade') s.run.weapons.length = 0;
      if (id !== 'plasmaBlade') s.world.weaponInstances.length = 0;
      s.giveWeapon(id, 4);
      s.spawn('drone', 100, { radius: 120 });
      // the player holds position and lets the horde converge; facing defaults to the right, which
      // is what the directional weapons fire along
      s.stepMany(60 * 8);
      expect(s.run.kills, `${id} killed ${s.run.kills}`).toBeGreaterThanOrEqual(20);
    }
  });
});
