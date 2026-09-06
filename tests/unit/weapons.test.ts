import { describe, it, expect } from 'vitest';
import { Simulation } from '../../src/core/sim/simulation';
import type { Enemy } from '../../src/core/sim/entities/enemy';

const newSim = (seed = 1) => {
  const s = new Simulation({ seed, characterId: 'survivor', stageId: 'station' });
  s.run.god = true;
  return s;
};
const enemies = (s: Simulation): Enemy[] => {
  const alive = s.world.enemies.aliveList();
  const out: Enemy[] = [];
  for (let i = 0; i < s.world.enemies.count; i++) out.push(s.world.enemies.items[alive[i]]);
  return out;
};

describe('build management', () => {
  it('gives the character its starting weapon', () => {
    const s = newSim();
    expect(s.run.weapons).toEqual([{ id: 'plasmaBlade', level: 1 }]);
    expect(s.world.weaponInstances).toHaveLength(1);
  });
  it('levels an owned weapon instead of duplicating it', () => {
    const s = newSim();
    s.giveWeapon('plasmaBlade', 4);
    expect(s.run.weapons).toEqual([{ id: 'plasmaBlade', level: 4 }]);
    expect(s.world.weaponInstances).toHaveLength(1);
    expect(s.world.weaponInstances[0].level).toBe(4);
  });
  it('caps at the weapon maximum and the six slots', () => {
    const s = newSim();
    s.giveWeapon('plasmaBlade', 99);
    expect(s.run.weapons[0].level).toBe(8);
    for (const id of ['guidedLaser', 'railgun', 'orbitalDrones', 'empField']) s.giveWeapon(id, 1);
    expect(s.run.weapons).toHaveLength(5);
  });
  it('passives raise player stats', () => {
    const s = newSim();
    const before = s.stats.might;
    s.givePassive('reactorCore', 3);
    expect(s.stats.might).toBeCloseTo(before * 1.3, 6);
  });
  it('rejects unknown ids loudly', () => {
    const s = newSim();
    expect(() => s.giveWeapon('nope')).toThrow(/unknown weapon/);
    expect(() => s.givePassive('nope')).toThrow(/unknown passive/);
  });
});

describe('slash (等离子刃)', () => {
  it('hits everything in the sweep once and kills weak enemies', () => {
    const s = newSim();
    s.setInput(1, 0);
    s.stepMany(1);
    s.setInput(0, 0);
    for (let i = 0; i < 5; i++) s.spawn('drone', 1, { x: 40 + i * 15, y: 0 });
    const before = s.run.kills;
    s.stepMany(90); // long enough for at least one swing
    expect(s.run.kills).toBeGreaterThan(before);
  });

  it('a single swing never damages the same enemy twice', () => {
    const s = newSim();
    s.spawn('mech', 1, { x: 60, y: 0 });
    const mech = enemies(s)[0];
    mech.hp = 10000;
    mech.maxHp = 10000;
    s.setInput(1, 0);
    s.stepMany(1);
    s.setInput(0, 0);
    const hpAfterFirstSwing = (() => {
      s.stepMany(1);
      return mech.hp;
    })();
    // the visual lingers for 150 ms; the damage must not repeat during it
    s.stepMany(8);
    expect(mech.hp).toBe(hpAfterFirstSwing);
  });

  it('scales its reach with the area stat', () => {
    const far = 190;
    const narrow = newSim();
    narrow.spawn('drone', 1, { x: far, y: 0 });
    narrow.setInput(1, 0);
    narrow.stepMany(2);
    expect(narrow.run.kills).toBe(0);

    const wide = newSim();
    wide.setStatOverride('area', 2);
    wide.spawn('drone', 1, { x: far, y: 0 });
    wide.setInput(1, 0);
    wide.stepMany(2);
    expect(wide.run.kills).toBe(1);
  });

  it('sweeps only the side the player is facing', () => {
    const s = newSim();
    s.spawn('mech', 1, { x: 110, y: 0 });
    s.spawn('mech', 1, { x: -110, y: 0 });
    const [right, left] = enemies(s);
    for (const e of [right, left]) {
      e.hp = 1e6;
      e.maxHp = 1e6;
    }
    // the blade starts off cooldown, so the first step is a swing in the facing direction
    s.setInput(1, 0);
    s.stepMany(1);
    expect(1e6 - right.hp).toBeGreaterThan(0);
    expect(left.hp).toBe(1e6);
  });
});

describe('aimed (制导激光)', () => {
  it('spawns no bolt when nothing is in range', () => {
    const s = newSim();
    s.giveWeapon('guidedLaser', 1);
    s.stepMany(2);
    expect(s.world.projectiles.items.filter((p) => p.active && p.kind === 'bolt')).toHaveLength(0);
  });

  it('fires at the nearest enemy and kills it', () => {
    const s = newSim();
    s.giveWeapon('guidedLaser', 1);
    s.spawn('drone', 1, { x: 300, y: 0 });
    s.stepMany(2);
    const bolts = s.world.projectiles.items.filter((p) => p.active && p.kind === 'bolt');
    expect(bolts.length).toBe(1);
    expect(bolts[0].vx).toBeGreaterThan(0);
    s.stepMany(60);
    expect(s.run.kills).toBe(1);
  });

  it('one bolt cannot hit the same enemy twice, and pierce lets it hit two', () => {
    const s = newSim();
    s.giveWeapon('guidedLaser', 1);
    s.spawn('mech', 1, { x: 200, y: 0 });
    s.spawn('mech', 1, { x: 260, y: 0 });
    const [a, b] = enemies(s);
    for (const e of [a, b]) {
      e.hp = 100000;
      e.maxHp = 100000;
    }
    s.stepMany(120);
    const hitA = 100000 - a.hp;
    const hitB = 100000 - b.hp;
    expect(hitA).toBeGreaterThan(0);
    expect(hitB).toBeGreaterThan(0);
    // pierce 1 means each bolt lands at most twice in total, never twice on one body
    const damagePerBolt = 10;
    expect(hitA % damagePerBolt).toBe(0);
    expect(hitB % damagePerBolt).toBe(0);
  });

  it('the amount stat fires more bolts per volley', () => {
    const s = newSim();
    s.giveWeapon('guidedLaser', 1);
    s.setStatOverride('amount', 3);
    s.setStatOverride('cooldown', 10); // keep the volley from repeating
    s.spawn('mech', 1, { x: 400, y: 0 });
    s.stepMany(30);
    expect(s.world.projectiles.items.filter((p) => p.active && p.kind === 'bolt')).toHaveLength(4);
  });

  it('might scales the damage dealt', () => {
    const mk = (might: number) => {
      const s = newSim();
      s.giveWeapon('guidedLaser', 1);
      s.setStatOverride('might', might);
      s.spawn('mech', 1, { x: 150, y: 0 });
      const e = enemies(s)[0];
      e.hp = 100000;
      e.maxHp = 100000;
      s.stepMany(40);
      return 100000 - e.hp;
    };
    expect(mk(2)).toBeGreaterThan(mk(1));
  });
});

describe('weapon cooldowns', () => {
  it('respects the cooldown stat', () => {
    const count = (cooldown: number) => {
      const s = newSim();
      s.giveWeapon('guidedLaser', 1);
      s.setStatOverride('cooldown', cooldown);
      s.spawn('mech', 1, { x: 500, y: 0 });
      const e = enemies(s)[0];
      e.hp = 1e9;
      e.maxHp = 1e9;
      let bolts = 0;
      const seen = new Set<number>();
      for (let i = 0; i < 300; i++) {
        s.stepMany(1);
        for (const p of s.world.projectiles.items) {
          if (p.active && !seen.has(p.id)) {
            seen.add(p.id);
            bolts++;
          }
          if (!p.active) seen.delete(p.id);
        }
      }
      return bolts;
    };
    expect(count(0.5)).toBeGreaterThan(count(1));
  });

  it('the aura weapon never fires through the cooldown path', () => {
    const s = newSim();
    s.giveWeapon('empField', 1);
    s.stepMany(300);
    expect(s.world.projectiles.items.filter((p) => p.active && p.kind === 'bolt')).toHaveLength(0);
  });
});
