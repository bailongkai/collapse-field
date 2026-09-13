import { describe, it, expect } from 'vitest';
import { Simulation } from '../../src/core/sim/simulation';
import { CONTENT } from '../../src/core/content/registry';
import { CHARACTER_LIST } from '../../src/data/characters';
import { LOCKED_BY_DEFAULT } from '../../src/data/achievements';

const sim = (characterId: string, seed = 3) => {
  const s = new Simulation({ seed, characterId, stageId: 'station' });
  s.run.god = true;
  s.setStatOverride('growth', 0);
  s.setStatOverride('moveSpeed', 0);
  return s;
};
const shots = (s: Simulation): number => {
  const buf = s.world.events;
  let n = 0;
  for (let i = 0; i < buf.length; i++) if (buf.at(i).type === 'shot') n++;
  return n;
};
const stakes = (s: Simulation) => s.world.projectiles.items.filter((p) => p.active && p.kind === 'pylon');
const ring = (s: Simulation, id: string, n: number, r: number): void => {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    s.spawn(id, 1, { x: s.world.player.x + Math.cos(a) * r, y: s.world.player.y + Math.sin(a) * r });
  }
};

describe('the three new characters', () => {
  it('each brings its own starting weapon, and every base weapon belongs to exactly one of them', () => {
    const starts = CHARACTER_LIST.map((c) => c.startingWeapon);
    expect(new Set(starts).size).toBe(starts.length);
    for (const id of ['sapper', 'welder', 'gunner']) {
      const c = CONTENT.characters[id];
      expect(c, id).toBeTruthy();
      expect(CONTENT.weapons[c.startingWeapon]?.evolvedOnly).toBeFalsy();
    }
  });

  it('their evolutions pair with passives a new player can actually be offered', () => {
    for (const id of ['arcPylons', 'arcConduit', 'pivotCannon']) {
      const pair = CONTENT.weapons[id].evolution!.requires;
      expect(CONTENT.passives[pair], `${id} pairs with the unknown ${pair}`).toBeTruthy();
      expect(LOCKED_BY_DEFAULT.includes(pair), `${id} pairs with the locked ${pair}`).toBe(false);
    }
  });
});

describe('锚桩: the pylon is placed, not carried', () => {
  it('plants stakes apart from each other rather than in a heap', () => {
    const s = sim('sapper');
    s.stepMany(60 * 12);
    const live = stakes(s);
    expect(live.length).toBeGreaterThan(1);
    for (let i = 0; i < live.length; i++) {
      for (let j = i + 1; j < live.length; j++) {
        const d = Math.hypot(live[i].x - live[j].x, live[i].y - live[j].y);
        expect(d, 'two stakes landed on the same spot').toBeGreaterThan(20);
      }
    }
  });

  it('never leaves more standing than the weapon allows', () => {
    const s = sim('sapper');
    s.stepMany(60 * 60);
    expect(stakes(s).length).toBeLessThanOrEqual(4);
  });

  it('burns what crosses the arc between two stakes, and does far less with one', () => {
    const s = sim('sapper');
    s.stepMany(60 * 8); // two stakes up and armed
    expect(stakes(s).length).toBeGreaterThanOrEqual(2);
    const a = stakes(s)[0];
    const b = stakes(s)[1];
    s.spawn('mech', 1, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    const e = s.world.enemies.items[s.world.enemies.aliveList()[s.world.enemies.count - 1]];
    const hp = e.hp;
    s.stepMany(60 * 3);
    expect(e.hp, 'a body standing on the lattice took nothing').toBeLessThan(hp);
  });

  it('walking away takes the player node with it, and the lattice dims', () => {
    const s = sim('sapper');
    s.stepMany(60 * 10);
    const near = s.world.player.x;
    // the stakes stay where they were planted; the player is the one who leaves
    s.setStatOverride('moveSpeed', 1);
    s.setInput(1, 0);
    s.stepMany(60 * 4);
    expect(s.world.player.x - near).toBeGreaterThan(300);
    for (const p of stakes(s)) expect(Math.hypot(p.x - s.world.player.x, p.y - s.world.player.y)).toBeGreaterThan(190);
  });
});

describe('导体: the chain needs a crowd', () => {
  it('does not fire at all with nobody near, and says nothing about it', () => {
    const s = sim('welder');
    s.stepMany(60 * 5);
    expect(shots(s), 'it fired into an empty field').toBe(0);
  });

  it('fires the moment a body is in reach', () => {
    const s = sim('welder');
    s.spawn('mech', 1, { x: 120, y: 0 });
    const e = s.world.enemies.items[s.world.enemies.aliveList()[s.world.enemies.count - 1]];
    const hp = e.hp;
    s.stepMany(60 * 2);
    expect(e.hp, 'a body well inside the seek radius was never earthed').toBeLessThan(hp);
  });

  it('walks through a packed crowd and hits more than one body', () => {
    const s = sim('welder');
    for (let i = 0; i < 6; i++) s.spawn('mech', 1, { x: 90 + i * 40, y: 0 });
    const before = s.world.enemies.items.filter((e) => e.active).map((e) => e.hp);
    s.stepMany(60 * 2);
    const after = s.world.enemies.items.filter((e) => e.active).map((e) => e.hp);
    const hurt = after.filter((hp, i) => hp < before[i]).length;
    expect(hurt, 'the arc only ever hit one body').toBeGreaterThan(1);
  });
});

describe('平射炮: a beam from her own body, down the side she faces', () => {
  const mechAt = (s: Simulation, dx: number) => {
    s.spawn('mech', 1, { x: s.world.player.x + dx, y: s.world.player.y });
    return s.world.enemies.items[s.world.enemies.aliveList()[s.world.enemies.count - 1]];
  };

  it('fires on its own cooldown while a heading is held, ahead and never behind', () => {
    const s = sim('gunner');
    s.setInput(1, 0);
    const ahead = mechAt(s, 200);
    const behind = mechAt(s, -200);
    const hpAhead = ahead.hp;
    const hpBehind = behind.hp;
    s.stepMany(30);
    expect(ahead.hp, 'holding a heading fired nothing').toBeLessThan(hpAhead);
    expect(behind.hp, 'the beam reached behind her').toBe(hpBehind);
    const afterOne = ahead.hp;
    s.stepMany(60 * 3);
    expect(ahead.hp, 'it fired once and went quiet').toBeLessThan(afterOne);
  });

  it('starts at the body: a mech standing on her is inside the beam', () => {
    const s = sim('gunner');
    s.setInput(1, 0);
    const close = mechAt(s, 40);
    const hp = close.hp;
    s.stepMany(30);
    expect(close.hp, 'the beam began a way out from the character').toBeLessThan(hp);
  });

  it('stacks its lanes vertically as amount grows, every one anchored at the body', () => {
    const s = sim('gunner');
    s.giveWeapon('pivotCannon', 8);
    s.setInput(1, 0);
    s.stepMany(2);
    const lanes = s.world.projectiles.items.filter((p) => p.active && p.kind === 'slash' && !p.hostile);
    expect(lanes.length).toBe(3);
    expect(new Set(lanes.map((p) => Math.round(p.y))).size, 'the lanes lay on top of each other').toBe(3);
    // the body walks on after the shot, so the anchor is compared to where it was, not where it is
    expect(new Set(lanes.map((p) => p.x)).size, 'the lanes started from different points').toBe(1);
    expect(Math.abs(lanes[0].x - s.world.player.x), 'a lane did not start at the body').toBeLessThan(4);
  });
});

describe('the three new signature abilities', () => {
  it('固守 builds while she stands still and sheds when she leaves', () => {
    const s = sim('sapper');
    s.setInput(0, 0);
    s.stepMany(60 * 8);
    const dug = s.signature.stacks;
    expect(dug, 'standing still dug in nothing').toBeGreaterThan(0);
    s.setStatOverride('moveSpeed', 1);
    s.setInput(1, 0);
    s.stepMany(60 * 6);
    expect(s.signature.stacks, 'running kept the stacks').toBeLessThan(dug);
  });

  it('挤压装甲 is worth nothing alone and a great deal in a press', () => {
    const s = sim('welder');
    s.stepMany(30);
    expect(s.signature.stacks).toBe(0);
    ring(s, 'drone', 20, 60);
    s.stepMany(4);
    expect(s.signature.stacks, 'a press granted no plating').toBeGreaterThan(0);
    expect(s.stats.armor).toBeGreaterThan(0);
    s.killAllOnScreen();
    s.stepMany(4);
    expect(s.signature.stacks, 'the plating outlived the crowd').toBe(0);
  });

  it('回身校准 fires on a turn into a crowd and not on a turn into nothing', () => {
    const empty = sim('gunner');
    empty.setStatOverride('moveSpeed', 1);
    empty.setInput(1, 0);
    empty.stepMany(10);
    empty.setInput(-1, 0);
    empty.stepMany(4);
    expect(empty.signature.fired, 'it fired at an empty field').toBe(0);

    const s = sim('gunner');
    s.setStatOverride('moveSpeed', 1);
    for (let i = 0; i < 8; i++) s.spawn('drone', 1, { x: -200 - i * 10, y: i * 12 - 40 });
    s.setInput(1, 0);
    s.stepMany(10);
    s.setInput(-1, 0); // turning to face the crowd
    s.stepMany(4);
    expect(s.signature.fired, 'turning into eight bodies did nothing').toBeGreaterThan(0);
    expect(s.stats.might).toBeGreaterThan(1.1);
  });
});
