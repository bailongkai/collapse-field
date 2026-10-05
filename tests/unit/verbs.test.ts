import { describe, it, expect } from 'vitest';
import { Simulation } from '../../src/core/sim/simulation';
import { World } from '../../src/core/sim/world';
import { spawnEnemy } from '../../src/core/sim/systems/spawnSystem';
import { stepProjectiles } from '../../src/core/sim/systems/projectileSystem';
import { resetProjectileExtras } from '../../src/core/sim/entities/projectile';
import { rollLimitBreak, rollLevelUp } from '../../src/core/levelup/roll';
import { CONTENT } from '../../src/core/content/registry';
import { Rng } from '../../src/core/rng';
import { VERBS, VERB_MAX_STACKS, VERB_TUNING } from '../../src/data/verbs';
import { FIXED_DT_MS, PROJECTILE_CAP } from '../../src/config';
import type { Enemy } from '../../src/core/sim/entities/enemy';
import type { WeaponBehaviorId } from '../../src/data/types';

/**
 * The limit-break verbs, one rule each. Every test holds everything else still: an empty floor,
 * the one weapon, bodies that do not move and cannot die unless the rule needs them to.
 */
const armed = (weaponId: string, verb: number, level = 1): Simulation => {
  const s = new Simulation({ seed: 9, characterId: 'survivor', stageId: 'station' });
  s.world.enemies.clear();
  s.run.weapons.length = 0;
  s.world.weaponInstances.length = 0;
  s.run.god = true;
  s.setStatOverride('growth', 0);
  s.setStatOverride('curse', -1);
  s.giveWeapon(weaponId, level);
  s.setVerb(weaponId, verb);
  return s;
};
const tank = (s: Simulation, x: number, y: number, def = 'mech'): Enemy => {
  s.spawn(def, 1, { x, y });
  const e = s.world.enemies.items.find((k) => k.active && k.x === x && k.y === y)!;
  e.hp = e.maxHp = 1e9;
  e.speedMult = 0;
  return e;
};
const taken = (e: Enemy): number => 1e9 - e.hp;
/** hits on one body, as [tick, damage] */
const hitsOn = (s: Simulation, e: Enemy, ticks: number): [number, number][] => {
  const out: [number, number][] = [];
  let last = e.hp;
  for (let t = 0; t < ticks; t++) {
    s.step();
    s.world.events.clear();
    if (e.hp < last) out.push([s.run.tick, Math.round(last - e.hp)]);
    last = e.hp;
  }
  return out;
};

describe('the offer', () => {
  const full = CONTENT.characters.survivor ? ['plasmaBlade', 'railgun', 'guidedLaser', 'orbitalDrones', 'empField', 'arcPylons'] : [];
  const weapons = full.map((id) => ({ id, level: 8 }));

  it('a weapon offers its verb before its +% cards', () => {
    const cards = rollLimitBreak(weapons, CONTENT, 3, new Rng(1));
    expect(cards).toHaveLength(3);
    for (const c of cards) expect(c.kind).toBe('verb');
  });

  it('no +% card while any verb is short of its maximum; the verb is never offered past it', () => {
    const verbs = Object.fromEntries(full.map((id) => [id, VERB_MAX_STACKS]));
    verbs.plasmaBlade = 1;
    for (let seed = 1; seed < 30; seed++) {
      const cards = rollLimitBreak(weapons, CONTENT, 3, new Rng(seed), verbs);
      // one verb card left: it, and gold and a medkit to choose against, never a +% card
      expect(cards).toEqual([{ kind: 'verb', id: 'plasmaBlade', toStacks: 2 }, { kind: 'gold', amount: 25 }, { kind: 'heal', amount: 30 }]);
    }
  });

  it('the gate is the whole build: one maxed verb does not let its +% cards in', () => {
    const verbs = Object.fromEntries(full.map((id) => [id, 0]));
    verbs.railgun = VERB_MAX_STACKS;
    verbs.guidedLaser = VERB_MAX_STACKS;
    for (let seed = 1; seed < 30; seed++) {
      for (const c of rollLimitBreak(weapons, CONTENT, 3, new Rng(seed), verbs)) {
        expect(c.kind).toBe('verb');
        if (c.kind === 'verb') expect(['railgun', 'guidedLaser']).not.toContain(c.id);
      }
    }
  });

  it('once every verb is maxed the offer is +% cards', () => {
    const verbs = Object.fromEntries(full.map((id) => [id, VERB_MAX_STACKS]));
    for (let seed = 1; seed < 10; seed++) {
      const cards = rollLimitBreak(weapons, CONTENT, 3, new Rng(seed), verbs);
      expect(cards).toHaveLength(3);
      for (const c of cards) expect(c.kind).toBe('limit');
    }
  });

  it('rollLevelUp passes the stacks through once the build is full', () => {
    const passives = ['reactorCore', 'coolingSystem', 'fieldAmp', 'nanoArmor', 'lifeCore', 'stabilizer'].map((id) => ({ id, level: CONTENT.passives[id].maxLevel }));
    const verbs = Object.fromEntries(full.map((id) => [id, VERB_MAX_STACKS]));
    const cards = rollLevelUp({ weapons, passives, luck: 1, rng: new Rng(4), reg: CONTENT, verbs });
    for (const c of cards) expect(c.kind).toBe('limit');
  });

  it('every archetype has a verb with a name and a description', () => {
    for (const b of ['slash', 'stream', 'aimed', 'orbit', 'aura', 'pylon', 'chain', 'pivot'] as WeaponBehaviorId[]) {
      expect(VERBS[b].behavior).toBe(b);
      expect(VERBS[b].maxStacks).toBe(VERB_MAX_STACKS);
    }
  });

  it('picking the card raises the stack on the weapon', () => {
    const s = armed('plasmaBlade', 0);
    s.run.choices = [{ kind: 'verb', id: 'plasmaBlade', toStacks: 1 }];
    s.run.pendingLevelUps = 1;
    s.run.phase = 'levelup';
    s.applyChoice(0);
    expect(s.verbStacks().plasmaBlade).toBe(1);
    expect(s.setVerb('plasmaBlade', 99)).toBe(true);
    expect(s.verbStacks().plasmaBlade).toBe(VERB_MAX_STACKS);
  });
});

describe('回旋 (slash)', () => {
  it('each sweep comes back 250 ms later at half the damage, once per stack', () => {
    const plain = armed('plasmaBlade', 0);
    const plainHits = hitsOn(plain, tank(plain, 90, 0), 40);
    const s = armed('plasmaBlade', 2);
    const hits = hitsOn(s, tank(s, 90, 0), 40);
    expect(plainHits).toHaveLength(1);
    expect(hits).toHaveLength(3);
    const [t0, d0] = hits[0];
    const delay = Math.round(VERB_TUNING.slash.delayMs / FIXED_DT_MS);
    expect(hits[1][0] - t0).toBeGreaterThanOrEqual(delay - 1);
    expect(hits[1][0] - t0).toBeLessThanOrEqual(delay + 1);
    expect(hits[2][0] - t0).toBeGreaterThanOrEqual(2 * delay - 1);
    expect(hits[1][1]).toBeCloseTo(d0 * 0.5, -1);
  });
});

/** A bolt against bodies placed by hand, through the projectile system alone. */
const boltWorld = () => {
  const world = new World(1);
  const bodies: Enemy[] = [];
  const put = (x: number, y: number, hp = 1e9) => {
    const e = spawnEnemy(world, 'mech', { x, y })!;
    e.hp = e.maxHp = hp;
    bodies.push(e);
    return e;
  };
  const fire = (o: { pierce: number; bounces?: number; splits?: number; damage?: number }) => {
    const p = resetProjectileExtras(world.projectiles.spawn()!);
    p.kind = 'bolt';
    p.hostile = false;
    p.x = 0;
    p.y = 0;
    p.vx = 600;
    p.vy = 0;
    p.radius = 7;
    p.damage = o.damage ?? 10;
    p.pierce = o.pierce;
    p.ttlMs = 1200;
    p.bounces = o.bounces ?? 0;
    p.splits = o.splits ?? 0;
    p.hitSerials.length = 0;
    return p;
  };
  const hits: { e: Enemy; dmg: number }[] = [];
  const run = (ticks: number) => {
    for (let t = 0; t < ticks; t++) {
      world.rebuildGrid();
      stepProjectiles(
        world,
        FIXED_DT_MS,
        (e, dmg) => {
          hits.push({ e, dmg });
          e.hp -= dmg;
          if (e.hp <= 0) world.enemies.free(e);
        },
        () => {},
      );
    }
  };
  return { world, put, fire, run, hits };
};

describe('跳弹 (stream)', () => {
  it('a round with its pierce spent turns towards the nearest body within 120 it has not hit', () => {
    const plain = boltWorld();
    plain.put(80, 0);
    const offline = plain.put(120, 90);
    plain.fire({ pierce: 0 });
    plain.run(60);
    expect(plain.hits.some((h) => h.e === offline)).toBe(false);

    const w = boltWorld();
    w.put(80, 0);
    const side = w.put(120, 90);
    const far = w.put(80, 400);
    w.fire({ pierce: 0, bounces: 1 });
    w.run(60);
    expect(w.hits.some((h) => h.e === side)).toBe(true);
    expect(w.hits.some((h) => h.e === far)).toBe(false);

    // and it says so, for the view to draw it in the verb's colour: a turned round looked like
    // every other one
    const t = boltWorld();
    t.put(80, 0);
    t.put(120, 90);
    const round = t.fire({ pierce: 0, bounces: 1 });
    let seen = 0;
    for (let i = 0; i < 30 && round.active; i++) {
      t.run(1);
      seen = Math.max(seen, round.turned);
    }
    expect(seen).toBe(1);
  });

  it('turns once per stack', () => {
    const w = boltWorld();
    w.put(80, 0);
    w.put(150, 60);
    w.put(220, 120);
    w.put(290, 180);
    w.fire({ pierce: 0, bounces: 2 });
    w.run(90);
    expect(new Set(w.hits.map((h) => h.e.id)).size).toBe(3);
  });
});

describe('分裂 (aimed)', () => {
  it('a bolt that kills throws splinters at half its damage, which do not split again, and keeps its pierce', () => {
    const w = boltWorld();
    w.put(80, 0, 5);
    const parent = w.fire({ pierce: 3, splits: 2, damage: 10 });
    w.run(12);
    const live = w.world.projectiles.items.filter((p) => p.active);
    expect(live).toHaveLength(3);
    // the parent carries on with one pierce spent, as it would have without the verb
    expect(parent.active).toBe(true);
    expect(parent.pierce).toBe(2);
    const splinters = live.filter((p) => p !== parent);
    for (const p of splinters) {
      expect(p.damage).toBe(5);
      expect(p.splits).toBe(0);
    }
  });

  it('every stack is worth more than no verb, on the laser and on the lance, in a minute-ten crowd', () => {
    // The split used to spend the bolt, so the lance's five bodies became one plus half-damage
    // splinters and the card was a trap: one stack cost it a fifth of its kills.
    const crowd = (weapon: string, level: number, verb: number, seed: number) => {
      const s = new Simulation({ seed, characterId: 'survivor', stageId: 'station' });
      s.run.weapons.length = 0;
      s.world.weaponInstances.length = 0;
      s.run.god = true;
      s.setStatOverride('growth', 0);
      s.giveWeapon(weapon, level);
      s.setVerb(weapon, verb);
      s.setTime(540);
      const k0 = s.run.kills;
      for (let t = 0; t < 60 * 60; t++) {
        s.step();
        s.takeChestResult();
        // a chest would raise the weapon or teach the verb; hold both where the test put them
        s.run.weapons.length = 1;
        s.world.weaponInstances.length = 1;
        s.run.weapons[0].level = level;
        s.world.weaponInstances[0].level = level;
        s.world.weaponInstances[0].verb = verb;
      }
      return { kills: s.run.kills - k0, dmg: s.run.damageBySlot[0] ?? 0 };
    };
    const seeds = [1, 2, 3];
    for (const [weapon, level] of [['fusionLance', 1], ['guidedLaser', 8]] as const) {
      const total = (verb: number) =>
        seeds.map((sd) => crowd(weapon, level, verb, sd)).reduce((a, r) => ({ kills: a.kills + r.kills, dmg: a.dmg + r.dmg }), { kills: 0, dmg: 0 });
      const none = total(0);
      for (let v = 1; v <= VERB_MAX_STACKS; v++) {
        const withVerb = total(v);
        expect(withVerb.kills, `${weapon} 分裂 ${v}: ${withVerb.kills} kills vs ${none.kills}`).toBeGreaterThan(none.kills);
        expect(withVerb.dmg, `${weapon} 分裂 ${v}: ${withVerb.dmg} damage vs ${none.dmg}`).toBeGreaterThan(none.dmg);
      }
    }
  }, 120_000);

  it('a bolt that does not kill does not split', () => {
    const w = boltWorld();
    w.put(80, 0);
    w.fire({ pierce: 3, splits: 2 });
    w.run(12);
    expect(w.world.projectiles.items.filter((p) => p.active)).toHaveLength(1);
  });
});

describe('殉爆 (orbit)', () => {
  it('a drone that expires detonates where it is, and the blast reaches past the ring', () => {
    const run = (verb: number) => {
      const s = armed('orbitalDrones', verb);
      // round the player beyond the ring: whichever way the drone is facing when it goes, one of
      // them is inside the blast
      const near = [tank(s, 0, 95), tank(s, 0, -95), tank(s, 95, 0), tank(s, -95, 0)];
      let bursts = 0;
      for (let t = 0; t < 60 * 6; t++) {
        s.step();
        for (let i = 0; i < s.world.events.length; i++) if (s.world.events.at(i).type === 'verbBurst') bursts++;
        s.world.events.clear();
      }
      return { bursts, dealt: near.reduce((n, e) => n + taken(e), 0) };
    };
    const plain = run(0);
    const verb = run(1);
    expect(plain.bursts).toBe(0);
    expect(verb.bursts).toBeGreaterThan(0);
    expect(verb.dealt).toBeGreaterThan(plain.dealt);
  });
});

describe('脉冲 (aura)', () => {
  it('pulls the bodies within twice the field inward every four seconds, even with the field full', () => {
    const run = (verb: number) => {
      const s = armed('empField', verb);
      // three bodies in the field keep the base pulse quiet
      tank(s, 30, 0);
      tank(s, -30, 0);
      tank(s, 0, 30);
      const outer = tank(s, 0, -140, 'drone'); // light enough to be moved
      s.stepMany(Math.round((VERB_TUNING.aura.everyMs + 600) / FIXED_DT_MS));
      return Math.hypot(outer.x - s.world.player.x, outer.y - s.world.player.y);
    };
    const still = run(0);
    const pulled = run(1);
    expect(still).toBeGreaterThan(125);
    expect(still - pulled).toBeGreaterThan(VERB_TUNING.aura.px * 0.5);
  });
});

describe('接地 (pylon)', () => {
  it('an armed stake arcs into the nearest body within 120 that the lattice does not touch', () => {
    const run = (verb: number) => {
      const s = armed('arcPylons', verb);
      s.stepMany(2); // the first stake goes in at (90, 0)
      const stake = s.world.projectiles.items.find((p) => p.active && p.kind === 'pylon')!;
      const off = tank(s, stake.x, stake.y + 100);
      s.stepMany(90);
      return { dealt: taken(off), links: stake.links.length };
    };
    expect(run(0).dealt).toBe(0);
    const grounded = run(1);
    expect(grounded.dealt).toBeGreaterThan(0);
  });
});

describe('残留 (chain)', () => {
  it('the last link is marked, and the next hit from anything bursts it on the body and its neighbours', () => {
    const s = armed('arcConduit', 1);
    const a = tank(s, 60, 0);
    const b = tank(s, 110, 0);
    const neighbour = tank(s, 110, 40);
    s.stepMany(2);
    const marked = [a, b, neighbour].filter((e) => e.markUntilTick >= s.run.tick);
    expect(marked).toHaveLength(1);
    const m = marked[0];
    const before = [a, b, neighbour].map(taken);
    s.world.events.clear();
    s.world.rebuildGrid();
    s.damageEnemy(m, 1, 1, 0, 0, 0);
    const after = [a, b, neighbour].map(taken);
    const burst = m.markDamage;
    expect(after[[a, b, neighbour].indexOf(m)] - before[[a, b, neighbour].indexOf(m)]).toBeGreaterThanOrEqual(burst);
    expect(m.markUntilTick).toBe(-1);
    let events = 0;
    for (let i = 0; i < s.world.events.length; i++) if (s.world.events.at(i).type === 'verbBurst') events++;
    expect(events).toBe(1);
  });

  it('a mark runs out after two seconds', () => {
    const s = armed('arcConduit', 1);
    tank(s, 60, 0);
    s.stepMany(2);
    s.run.weapons.length = 0;
    s.world.weaponInstances.length = 0;
    s.stepMany(Math.round(VERB_TUNING.chain.markMs / FIXED_DT_MS) + 2);
    const e = s.world.enemies.items.find((k) => k.active)!;
    expect(e.markUntilTick).toBeLessThan(s.run.tick);
  });
});

describe('回波 (pivot)', () => {
  it('300 ms after the beam, a half-strength beam fires the other way', () => {
    const plain = armed('pivotCannon', 0);
    const behindPlain = tank(plain, -150, 0);
    expect(hitsOn(plain, behindPlain, 40)).toHaveLength(0);
    const s = armed('pivotCannon', 1);
    const ahead = tank(s, 150, 0);
    const behind = tank(s, -150, 0);
    const all: [number, number][] = [];
    const front = hitsOn(s, ahead, 1);
    for (const h of hitsOn(s, behind, 40)) all.push(h);
    expect(all.length).toBeGreaterThan(0);
    const delay = Math.round(VERB_TUNING.pivot.delayMs / FIXED_DT_MS);
    expect(all[0][0]).toBeGreaterThanOrEqual(delay);
    expect(all[0][1]).toBeCloseTo(taken(ahead) * VERB_TUNING.pivot.scale, -1);
    expect(front.length).toBe(1);
  });
});

describe('budget', () => {
  it('a late-game crowd with every verb at its maximum stays inside the projectile pool and the step budget', () => {
    const builds = [
      ['plasmaBlade', 'railgun', 'guidedLaser', 'orbitalDrones', 'empField', 'arcPylons'],
      ['annihilationBlade', 'shredderRail', 'fusionLance', 'stormLattice', 'horizonWipe', 'arcConduit'],
    ];
    for (const build of builds) {
      const s = new Simulation({ seed: 21, characterId: 'survivor', stageId: 'station' });
      s.setStatOverride('maxHealth', 1e6);
      s.setStatOverride('growth', 0);
      s.setAutopilot(true);
      s.run.weapons.length = 0;
      s.world.weaponInstances.length = 0;
      for (const id of build) {
        s.giveWeapon(id, 8);
        s.setVerb(id, VERB_MAX_STACKS);
      }
      for (const id of ['reactorCore', 'coolingSystem', 'fieldAmp', 'magazine', 'stabilizer', 'heatsink']) s.givePassive(id, 5);
      s.setLevel(80);
      s.setTime(780);
      s.stepMany(60 * 20); // let the crowd build
      let peak = 0;
      const start = performance.now();
      const steps = 60 * 20;
      for (let i = 0; i < steps; i++) {
        while (s.takeChestResult());
        s.step();
        s.world.events.clear();
        peak = Math.max(peak, s.world.projectiles.count);
      }
      const msPerStep = (performance.now() - start) / steps;
      expect(peak, build.join(',')).toBeLessThan(PROJECTILE_CAP * 0.75);
      expect(msPerStep, `${msPerStep.toFixed(3)} ms/step`).toBeLessThan(4);
    }
  });
});

describe('a chest with nothing left to raise', () => {
  const full = (): Simulation => {
    // evolved already, so the chest cannot spend itself on an evolution
    const s = armed('annihilationBlade', 0, 8);
    for (const id of ['shredderRail', 'fusionLance', 'satelliteArray', 'singularityField', 'graviticLattice']) s.giveWeapon(id, 8);
    for (const id of ['reactorCore', 'coolingSystem', 'fieldAmp', 'nanoArmor', 'lifeCore', 'stabilizer']) s.givePassive(id, 99);
    return s;
  };

  it('teaches a weapon one verb stack instead of paying gold', () => {
    const s = full();
    const gold = s.run.gold;
    const r = s.openChest('standard', 0, 0);
    expect(r.gold).toBe(0);
    expect(s.run.gold).toBe(gold);
    expect(r.rewards).toHaveLength(1);
    const v = r.rewards[0];
    expect(v.kind).toBe('verb');
    if (v.kind === 'verb') expect(s.verbStacks()[v.id]).toBe(1);
  });

  it('pays gold only once every verb is learned', () => {
    const s = full();
    for (const id of Object.keys(s.verbStacks())) s.setVerb(id, VERB_MAX_STACKS);
    const r = s.openChest('standard', 0, 0);
    expect(r.rewards).toHaveLength(0);
    expect(r.gold).toBeGreaterThan(0);
  });
});
