import { describe, it, expect } from 'vitest';
import { Simulation } from '../../src/core/sim/simulation';
import type { Enemy } from '../../src/core/sim/entities/enemy';

const newSim = (stageId = 'reactor') => {
  const s = new Simulation({ seed: 4, characterId: 'survivor', stageId });
  s.run.god = true;
  s.setStatOverride('growth', 0);
  s.setStatOverride('moveSpeed', 0);
  return s;
};
const only = (s: Simulation, id: string): Enemy[] => s.world.enemies.items.filter((e) => e.active && e.defId === id);
const put = (s: Simulation, id: string, x: number, y: number): Enemy => {
  s.spawn(id, 1, { x, y });
  const list = s.world.enemies.aliveList();
  return s.world.enemies.items[list[s.world.enemies.count - 1]];
};
/**
 * Whether that exact body is still on the field. A freed slot is reused immediately, so `active`
 * alone answers a different question than the one these tests are asking.
 */
const stillThere = (e: Enemy, serial: number): boolean => e.active && e.serial === serial;

describe('曲射炮艇: the mortar aims where the player is going', () => {
  it('lands its shells ahead of a moving player, and they go off on a clock', () => {
    const s = newSim();
    s.setStatOverride('moveSpeed', 1);
    s.setInput(1, 0);
    put(s, 'bombard', 480, 0);
    // the wind-up is 800 ms and the fuse 1150, so a shell exists for about a second and then does not
    s.stepMany(66);
    const shells = only(s, 'bombardShell');
    expect(shells.length, 'the skiff never fired').toBeGreaterThan(0);
    // the lead is along the input, so a shell lands ahead of where the player already is
    expect(shells.some((sh) => sh.x > s.world.player.x)).toBe(true);
    const serials = shells.map((sh) => sh.serial);
    s.stepMany(90);
    expect(only(s, 'bombardShell').every((sh) => !serials.includes(sh.serial)), 'the shells never went off').toBe(true);
  });

  it('never has more shells on the field than its cap', () => {
    const s = newSim();
    for (let i = 0; i < 6; i++) put(s, 'bombard', 460 + i * 8, i * 20);
    s.stepMany(60 * 30);
    expect(only(s, 'bombardShell').length).toBeLessThanOrEqual(6);
  });
});

describe('盾卫: the bulwark has to be flanked', () => {
  it('takes almost nothing from the front and everything from behind', () => {
    const s = newSim('foundry');
    // pointed squarely at the player: the shield is about the angle, and the angle is set here so
    // the assertion is about damage and not about how long a 45 deg/s turn takes
    const e = put(s, 'castwall', 120, 0);
    e.facing = Math.PI;
    const hp = e.hp;
    s.damageEnemy(e, 100, 1, 0, 0); // from the player's side: into the shield
    const fromFront = hp - e.hp;
    const hp2 = e.hp;
    s.damageEnemy(e, 100, -1, 0, 0); // from behind it
    const fromBehind = hp2 - e.hp;
    expect(fromFront, `front ${fromFront} vs back ${fromBehind}`).toBeLessThan(fromBehind / 2);
    expect(fromFront).toBeGreaterThan(0); // never immune, only armoured
  });

  it('turns at its stated rate rather than snapping round', () => {
    const s = newSim('foundry');
    const e = put(s, 'castwall', 300, 0);
    s.stepMany(4);
    e.facing = Math.PI; // pointed away
    s.stepMany(6); // 0.1 s at 45 deg/s = 4.5 degrees
    expect(Math.abs(e.facing - Math.PI)).toBeLessThan(0.25);
  });
});

describe('拾荒者: the scavenger robs the run', () => {
  it('eats gems off the floor and runs from the player', () => {
    const s = newSim('foundry');
    s.spawnGems(20, 'blue', { x: 600, y: 0 });
    const before = s.world.gems.items.filter((g) => g.active).length;
    put(s, 'reclaimer', 640, 0);
    s.stepMany(60 * 6);
    expect(s.world.gems.items.filter((g) => g.active).length, 'it ate nothing').toBeLessThan(before);
  });

  it('leaves with what it swallowed, and that is not a kill', () => {
    const s = newSim('foundry');
    // the starting weapon fires from the first tick and would count its own kills into this
    s.run.weapons.length = 0;
    s.world.weaponInstances.length = 0;
    const e = put(s, 'reclaimer', 600, 0);
    const serial = e.serial;
    const kills = s.run.kills;
    s.stepMany(60 * 20);
    expect(stillThere(e, serial), 'it never left').toBe(false);
    expect(s.run.kills, 'leaving counted as a kill').toBe(kills);
  });
});

describe('束缚者: a pair is a wall', () => {
  it('shoves the player out of the beam between two of them', () => {
    const s = newSim('singularity');
    const a = put(s, 'riftAnchor', -150, -200);
    const b = put(s, 'riftAnchor', 150, -200);
    s.world.player.x = 0;
    s.world.player.y = -200; // standing on the line between them
    s.stepMany(30);
    expect(Math.abs(s.world.player.y + 200), 'the beam did not move the player').toBeGreaterThan(10);
    expect(a.active && b.active).toBe(true);
  });

  it('a lone one has no beam and pushes nobody', () => {
    const s = newSim('singularity');
    put(s, 'riftAnchor', 0, -260);
    s.world.player.x = 0;
    s.world.player.y = 0;
    s.stepMany(20);
    expect(s.world.player.x).toBe(0);
  });
});

describe('腐蚀池: the mire is terrain', () => {
  it('slows a player standing in it, deals no damage, and dries up', () => {
    const s = newSim();
    s.setStatOverride('moveSpeed', 1);
    const pool = put(s, 'slagPool', 0, 0);
    const serial = pool.serial;
    s.world.player.x = 0;
    s.world.player.y = 0;
    s.setInput(1, 0);
    const hp = s.run.hp;
    s.stepMany(30);
    const slowed = s.world.player.x;
    expect(slowed, 'the pool did not slow the player').toBeLessThan(200 * 0.5 * 0.95);
    expect(s.run.hp, 'a pool bit the player').toBe(hp);
    s.stepMany(60 * 8);
    expect(stillThere(pool, serial), 'the pool never dried up').toBe(false);
  });

  it('is left behind by the body that dies, and two of them do not stack into a standstill', () => {
    const s = newSim();
    s.setStatOverride('moveSpeed', 1);
    const walker = put(s, 'slagger', 40, 0);
    s.damageEnemy(walker, 1e6, 1, 0, 0);
    expect(only(s, 'slagPool').length, 'no pool was left behind').toBe(1);
    put(s, 'slagPool', 0, 0);
    put(s, 'slagPool', 10, 0);
    s.world.player.x = 0;
    s.world.player.y = 0;
    s.setInput(1, 0);
    s.stepMany(30);
    // one pool's worth of drag, never two
    expect(s.world.player.x).toBeGreaterThan(200 * 0.5 * 0.4);
  });
});

describe('侧翼猎手: the flanker uses the axis the blade misses', () => {
  it('lines up directly above or below the player before it dives', () => {
    const s = newSim('derelict');
    const e = put(s, 'ventCrawler', 700, 40);
    s.stepMany(60 * 3);
    expect(Math.abs(e.x - s.world.player.x), 'it never found the column').toBeLessThan(140);
  });
});

describe('压制炮台: the suppressor is safe up close', () => {
  it('fires from range and is disarmed when the player closes', () => {
    const s = newSim();
    const far = put(s, 'pinner', 520, 0);
    s.stepMany(120);
    expect(s.world.projectiles.items.filter((p) => p.active && p.hostile).length, 'it never fired').toBeGreaterThan(0);
    s.world.projectiles.clear();
    far.x = 120; // the player walks into it
    s.stepMany(180);
    expect(s.world.projectiles.items.filter((p) => p.active && p.hostile).length, 'it fired from inside its own range').toBe(0);
  });
});
