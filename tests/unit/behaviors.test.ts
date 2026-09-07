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

  it('keeps the spread within the cone', () => {
    const s = newSim();
    s.giveWeapon('railgun', 8);
    s.setInput(1, 0);
    s.stepMany(40);
    for (const b of bolts(s)) {
      expect(Math.abs(Math.atan2(b.vy, b.vx))).toBeLessThanOrEqual((14 * Math.PI) / 180 + 1e-6);
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

describe('aiming is the player\'s job, and facing is left or right', () => {
  it('facing only ever points left or right, whatever direction the player walks', () => {
    const s = newSim();
    for (const [dx, dy, want] of [
      [1, 0, 0],
      [0.6, -0.8, 0], // up and to the right still faces right
      [-1, 0, Math.PI],
      [-0.3, 0.95, Math.PI], // mostly downwards, but the last horizontal input was left
    ] as const) {
      s.setInput(dx, dy);
      s.stepMany(1);
      expect(s.world.player.facing, `input ${dx},${dy}`).toBeCloseTo(want, 6);
    }
  });

  it('walking straight up or down leaves the facing alone', () => {
    const s = newSim();
    s.setInput(-1, 0);
    s.stepMany(1);
    s.setInput(0, -1);
    s.stepMany(30);
    expect(s.world.player.facing).toBeCloseTo(Math.PI, 6);
  });

  it('the blade sweeps both sides at once, so backing away is never hopeless', () => {
    const s = newSim();
    const right = tank(s, 'mech', 110);
    const left = tank(s, 'mech', -110);
    s.setInput(1, 0); // running right, away from the enemy on the left
    s.stepMany(10); // the mirrored swing follows one volley interval later
    expect(1e9 - right.hp, 'the swing missed what it was aimed at').toBeGreaterThan(0);
    expect(1e9 - left.hp, 'the mirrored swing never landed').toBeGreaterThan(0);
  });

  it('but the band is horizontal, so a crowd overhead is a crowd the blade misses', () => {
    const s = newSim();
    const above = tank(s, 'mech', 60, -170);
    s.setInput(1, 0);
    s.stepMany(10);
    expect(above.hp, 'the sweep should pass under a crowd that is above the player').toBe(1e9);
  });

  it('the sweep is a band, so it catches enemies off the centre line', () => {
    const s = newSim();
    const off = tank(s, 'drone', 90, 40);
    s.setInput(1, 0);
    s.stepMany(1);
    expect(1e9 - off.hp).toBeGreaterThan(0);
  });

  it('the railgun fires where the player faces, not at whatever is nearest', () => {
    const s = newSim();
    s.run.weapons.length = 0;
    s.world.weaponInstances.length = 0;
    s.giveWeapon('railgun', 1);
    s.spawn('mech', 1, { x: 0, y: -300 }); // directly above, and deliberately ignored
    s.setInput(1, 0);
    s.stepMany(2);
    const shots = bolts(s);
    expect(shots.length).toBeGreaterThan(0);
    for (const b of shots) expect(b.vx, 'the shot did not go where the player faces').toBeGreaterThan(0);
  });

  it('the guided laser is the one weapon that aims itself', () => {
    const s = newSim();
    s.run.weapons.length = 0;
    s.world.weaponInstances.length = 0;
    s.giveWeapon('guidedLaser', 1);
    s.spawn('mech', 1, { x: 0, y: -300 });
    s.setInput(1, 0); // facing right, away from the target
    s.stepMany(2);
    const shots = bolts(s);
    expect(shots.length, 'the guided laser did not fire').toBeGreaterThan(0);
    for (const b of shots) expect(b.vy, 'the guided laser should track its target').toBeLessThan(0);
  });

  it('a player pushing through the horde still kills things', () => {
    const s = newSim();
    s.setStatOverride('growth', 0);
    s.spawn('drone', 60, { radius: 200 });
    s.setInput(1, 0);
    s.stepMany(60 * 10);
    expect(s.run.kills, 'a moving player killed nothing').toBeGreaterThan(5);
  });
});
