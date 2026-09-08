import { describe, it, expect } from 'vitest';
import { Simulation } from '../../src/core/sim/simulation';
import { rollChestCount, rollChestRewards } from '../../src/core/levelup/chest';
import { CONTENT } from '../../src/core/content/registry';
import { Rng } from '../../src/core/rng';

const newSim = (seed = 3) => {
  const s = new Simulation({ seed, characterId: 'survivor', stageId: 'station' });
  s.run.god = true;
  return s;
};
const chestAt = (s: Simulation) => {
  s.spawnPickup('chest', s.world.player.x, s.world.player.y);
  s.stepMany(2);
};

describe('what a chest pays out', () => {
  it('always one, three or five rewards', () => {
    const rng = new Rng(1);
    const seen = new Set<number>();
    for (let i = 0; i < 400; i++) seen.add(rollChestCount('standard', 1, rng));
    expect([...seen].sort()).toEqual([1, 3, 5]);
  });

  it('a boss chest never pays a single reward', () => {
    const rng = new Rng(2);
    for (let i = 0; i < 400; i++) expect(rollChestCount('boss', 1, rng)).not.toBe(1);
  });

  it('luck buys its way out of the one-reward bucket', () => {
    const share = (luck: number): number => {
      const rng = new Rng(9);
      let ones = 0;
      for (let i = 0; i < 600; i++) if (rollChestCount('standard', luck, rng) === 1) ones++;
      return ones / 600;
    };
    expect(share(2)).toBeLessThan(share(1));
  });

  it('never hands over a weapon or passive the player did not choose', () => {
    const s = newSim();
    const rewards = rollChestRewards({
      weapons: s.run.weapons,
      passives: s.run.passives,
      grade: 'boss',
      luck: 1,
      rng: s.world.rng,
      reg: CONTENT,
    });
    const owned = new Set([...s.run.weapons, ...s.run.passives].map((w) => w.id));
    for (const r of rewards) {
      if (r.kind === 'weapon' || r.kind === 'passive') expect(owned.has(r.id), `${r.id} was not owned`).toBe(true);
    }
  });

  it('never awards the same level twice in one chest', () => {
    for (let seed = 0; seed < 40; seed++) {
      const s = newSim(seed);
      s.giveWeapon('guidedLaser', 2);
      s.givePassive('reactorCore', 1);
      const rewards = rollChestRewards({
        weapons: s.run.weapons, passives: s.run.passives, grade: 'boss', luck: 2, rng: s.world.rng, reg: CONTENT,
      });
      const keys = rewards.map((r) => (r.kind === 'weapon' || r.kind === 'passive' ? `${r.id}@${r.toLevel}` : r.kind));
      expect(new Set(keys).size, `duplicate reward in ${keys.join(' ')}`).toBe(keys.length);
    }
  });

  it('pushes the weapon nearest to maxing rather than scattering', () => {
    // this is the whole difference between a chest and another level-up card
    let toNearlyMaxed = 0;
    let toTheOther = 0;
    for (let seed = 0; seed < 60; seed++) {
      const s = newSim(seed);
      s.run.weapons.length = 0;
      s.world.weaponInstances.length = 0;
      s.giveWeapon('plasmaBlade', 6);
      s.giveWeapon('guidedLaser', 1);
      const rewards = rollChestRewards({
        weapons: s.run.weapons, passives: s.run.passives, grade: 'standard', luck: 1, rng: s.world.rng, reg: CONTENT,
      });
      for (const r of rewards) {
        if (r.kind !== 'weapon') continue;
        if (r.id === 'plasmaBlade') toNearlyMaxed++;
        else toTheOther++;
      }
    }
    expect(toNearlyMaxed, `${toNearlyMaxed} to the near-maxed weapon vs ${toTheOther} to the fresh one`)
      .toBeGreaterThan(toTheOther * 2);
  });
});

describe('chests and evolutions', () => {
  it('evolves a weapon the same chest just finished', () => {
    // The ordering this pins down used to be the other way round: evolving ran first and returned
    // early, so a chest whose own levels maxed a weapon could not act on the condition it had just
    // created, and the player had to find another chest. There were only ever two in a run.
    const s = newSim();
    s.run.weapons.length = 0;
    s.world.weaponInstances.length = 0;
    s.giveWeapon('plasmaBlade', 7); // one level short
    s.givePassive('reactorCore', 1); // the paired passive
    chestAt(s);
    expect(s.run.weapons.map((w) => w.id), 'the chest maxed the blade but left it unevolved').toContain('annihilationBlade');
  });

  it('reports what it did so the reveal can show it', () => {
    const s = newSim();
    s.run.weapons.length = 0;
    s.world.weaponInstances.length = 0;
    s.giveWeapon('plasmaBlade', 7);
    s.givePassive('reactorCore', 1);
    chestAt(s);
    const result = s.takeChestResult();
    expect(result).not.toBeNull();
    expect(result!.grade).toBe('standard');
    expect(result!.evolved).toContain('annihilationBlade');
    expect(result!.rewards.length).toBeGreaterThan(0);
  });

  it('a handful of chests is enough to reach an evolution at all', () => {
    // Before chests existed in quantity this was arithmetically out of reach: evolving needs seven
    // levels on one weapon, and a whole run only hands out about nine level-ups spread over ten
    // possible items. Not one run in sixteen ever saw an evolution.
    let evolvedIn = 0;
    for (let seed = 0; seed < 12; seed++) {
      const s = newSim(seed);
      s.givePassive('reactorCore', 1);
      for (let i = 0; i < 5; i++) chestAt(s);
      if (s.run.weapons.some((w) => w.id === 'annihilationBlade')) evolvedIn++;
    }
    // measured 7 of 12 at the time of writing; the gate is on the claim, not the exact figure
    expect(evolvedIn, `only ${evolvedIn}/12 builds evolved from five chests`).toBeGreaterThanOrEqual(6);
  });
});

describe('a chest reaches the player', () => {
  it('homes in from across the field rather than waiting to be walked over', () => {
    const s = newSim();
    s.spawnPickup('chest', s.world.player.x + 900, s.world.player.y);
    s.setInput(0, 0);
    s.stepMany(60 * 8);
    expect(s.run.chestsOpened, 'a chest dropped across the field never arrived').toBe(1);
  });

  it('is not recycled when the player walks away, the way a coin is', () => {
    const s = newSim();
    s.spawnPickup('chest', s.world.player.x + 2600, s.world.player.y);
    const before = s.world.pickups.count;
    s.stepMany(30);
    expect(s.world.pickups.count, 'the chest was swept up as litter').toBe(before);
  });
});

describe('the sentinel', () => {
  it('walks in on its own and leaves a chest', () => {
    const s = newSim();
    s.spawn('sentinel', 1, { x: 200, y: 0 });
    const alive = s.world.enemies.aliveList();
    const sentinel = s.world.enemies.items[alive[s.world.enemies.count - 1]];
    s.damageEnemy(sentinel, 1e6, 1, 0, 0);
    expect(sentinel.active).toBe(false);
    const chests = s.world.pickups.items.filter((p) => p.active && p.defId === 'chest');
    expect(chests, 'the sentinel died without dropping anything').toHaveLength(1);
  });

  it('cannot be outrun to skip its chest', () => {
    const s = newSim();
    s.spawn('sentinel', 1, { x: 300, y: 0, isEvent: true } as never);
    const alive = s.world.enemies.aliveList();
    const sentinel = s.world.enemies.items[alive[s.world.enemies.count - 1]];
    sentinel.isEvent = true;
    // shove it far past the point where an ordinary event enemy is simply freed
    sentinel.x = s.world.player.x + 9000;
    s.stepMany(3);
    expect(sentinel.active, 'the sentinel was dropped once it fell behind').toBe(true);
    expect(Math.hypot(sentinel.x - s.world.player.x, sentinel.y - s.world.player.y))
      .toBeLessThan(4000);
  });
});
