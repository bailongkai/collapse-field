import { describe, it, expect } from 'vitest';
import { Simulation } from '../../src/core/sim/simulation';
import { rollLevelUp, LIMIT_AMOUNT } from '../../src/core/levelup/roll';
import { CONTENT } from '../../src/core/content/registry';
import { Rng } from '../../src/core/rng';
import { metaCharges } from '../../src/core/save/upgrades';
import { DEFAULT_SAVE } from '../../src/core/save/saveData';

const sim = (charges = { reroll: 0, skip: 0, banish: 0 }, seed = 4) => {
  const s = new Simulation({ seed, characterId: 'survivor', stageId: 'station', charges });
  s.run.god = true;
  return s;
};
const maxEverything = (s: Simulation): void => {
  s.run.weapons.length = 0;
  s.world.weaponInstances.length = 0;
  // only six slots, so a maxed build is the six cheapest base weapons rather than every one
  for (const id of CONTENT.weaponList.filter((w) => !w.evolvedOnly).slice(0, 6).map((w) => w.id)) s.giveWeapon(id, 8);
  for (const id of Object.keys(CONTENT.passives)) s.givePassive(id, CONTENT.passives[id].maxLevel);
};

describe('limit break', () => {
  it('a build with nothing left to level is offered weapon stat cards, not gold', () => {
    const s = sim();
    maxEverything(s);
    const choices = rollLevelUp({ weapons: s.run.weapons, passives: s.run.passives, luck: 1, rng: new Rng(1), reg: CONTENT });
    expect(choices.length).toBeGreaterThanOrEqual(3);
    for (const c of choices) expect(c.kind).toBe('limit');
    // distinct cards
    const keys = choices.map((c) => (c.kind === 'limit' ? `${c.id}:${c.stat}` : c.kind));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('never offers a cooldown card for the aura, which never fires', () => {
    for (let seed = 0; seed < 30; seed++) {
      const s = sim(undefined, seed);
      maxEverything(s);
      const choices = rollLevelUp({ weapons: s.run.weapons, passives: s.run.passives, luck: 1, rng: new Rng(seed), reg: CONTENT });
      for (const c of choices) if (c.kind === 'limit' && c.id === 'empField') expect(c.stat).not.toBe('cooldown');
    }
  });

  it('taking a card really raises that weapon, and keeps raising it with no cap', () => {
    const s = sim();
    maxEverything(s);
    s.run.pendingLevelUps = 1;
    s.openLevelUp();
    const first = s.run.choices!.find((c) => c.kind === 'limit' && c.stat === 'damage');
    // force a known card into slot 0 so the test is about application, not about the roll
    s.run.choices![0] = { kind: 'limit', id: 'plasmaBlade', stat: 'damage', amount: LIMIT_AMOUNT.damage };
    void first;
    s.applyChoice(0);
    const inst = s.world.weaponInstances.find((i) => i.defId === 'plasmaBlade')!;
    expect(inst.limit.damage).toBeCloseTo(0.1, 6);
    for (let i = 0; i < 20; i++) {
      s.run.pendingLevelUps = 1;
      s.openLevelUp();
      s.run.choices![0] = { kind: 'limit', id: 'plasmaBlade', stat: 'damage', amount: LIMIT_AMOUNT.damage };
      s.applyChoice(0);
    }
    expect(inst.limit.damage).toBeCloseTo(2.1, 6);
  });

  it('a limit-broken blade hits harder', () => {
    const dmg = (limit: number): number => {
      const s = sim();
      s.setStatOverride('growth', 0);
      const inst = s.world.weaponInstances.find((i) => i.defId === 'plasmaBlade')!;
      inst.limit.damage = limit;
      s.spawn('mech', 1, { x: 110, y: 0 });
      const alive = s.world.enemies.aliveList();
      const e = s.world.enemies.items[alive[s.world.enemies.count - 1]];
      e.hp = 1e9;
      s.setInput(1, 0);
      s.stepMany(1);
      return 1e9 - e.hp;
    };
    expect(dmg(1)).toBeGreaterThan(dmg(0) * 1.8);
  });
});

describe('reroll, skip and banish', () => {
  it('the shop upgrades turn into charges for the run', () => {
    const save = { ...DEFAULT_SAVE, upgrades: { reroll: 2, skip: 1, banish: 3, hull: 2 } };
    expect(metaCharges(save)).toEqual({ reroll: 2, skip: 1, banish: 3 });
    const s = new Simulation({ seed: 1, characterId: 'survivor', stageId: 'station', charges: metaCharges(save) });
    expect(s.run.rerolls).toBe(2);
    expect(s.run.skips).toBe(1);
    expect(s.run.banishes).toBe(3);
  });

  it('a reroll changes the offer and spends a charge; none left means no reroll', () => {
    const s = sim({ reroll: 1, skip: 0, banish: 0 });
    s.run.pendingLevelUps = 1;
    s.openLevelUp();
    const before = JSON.stringify(s.run.choices);
    expect(s.rerollChoices()).toBe(true);
    expect(s.run.rerolls).toBe(0);
    expect(s.run.phase, 'a reroll keeps the offer open').toBe('levelup');
    expect(JSON.stringify(s.run.choices)).not.toBe(before);
    expect(s.rerollChoices()).toBe(false);
  });

  it('a skip closes the offer without picking and the level is kept', () => {
    const s = sim({ reroll: 0, skip: 1, banish: 0 });
    const build = [...s.run.weapons, ...s.run.passives].length;
    s.run.pendingLevelUps = 1;
    s.openLevelUp();
    expect(s.skipLevelUp()).toBe(true);
    expect(s.run.phase).toBe('running');
    expect([...s.run.weapons, ...s.run.passives].length).toBe(build);
    expect(s.skipLevelUp(), 'no charge left, and nothing open').toBe(false);
  });

  it('a banished item never appears again this run, and an owned one cannot be banished', () => {
    const s = sim({ reroll: 0, skip: 0, banish: 2 });
    s.run.pendingLevelUps = 1;
    s.openLevelUp();
    const idx = s.run.choices!.findIndex((c) => (c.kind === 'weapon' || c.kind === 'passive') && ![...s.run.weapons, ...s.run.passives].some((o) => o.id === c.id));
    expect(idx).toBeGreaterThanOrEqual(0);
    const target = s.run.choices![idx] as { id: string };
    expect(s.banishChoice(idx)).toBe(true);
    expect(s.run.banished).toContain(target.id);
    for (let i = 0; i < 40; i++) {
      s.rerollChoices();
      s.run.rerolls = 1;
      for (const c of s.run.choices!) if (c.kind === 'weapon' || c.kind === 'passive') expect(c.id).not.toBe(target.id);
    }
    const ownedIdx = s.run.choices!.findIndex((c) => c.kind === 'weapon' && c.id === 'plasmaBlade');
    if (ownedIdx >= 0) expect(s.banishChoice(ownedIdx)).toBe(false);
  });
});
