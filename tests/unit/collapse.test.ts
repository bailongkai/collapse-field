import { describe, it, expect } from 'vitest';
import { Simulation } from '../../src/core/sim/simulation';
import { STAGE_ORDER } from '../../src/data/stages';

const newSim = (seed = 9) => {
  const s = new Simulation({ seed, characterId: 'survivor', stageId: 'station' });
  s.setStatOverride('growth', 0);
  // nothing fires, so whatever happens to a body in these tests the floor did
  s.run.weapons.length = 0;
  s.world.weaponInstances.length = 0;
  return s;
};
const collapseIndex = (s: Simulation): number => s.stage.events.findIndex((e) => e.kind === 'collapse');
const open = (s: Simulation) => {
  s.triggerEvent(collapseIndex(s));
  return s.world.collapses[0];
};
const results = (s: Simulation): { lost: boolean; caught: boolean }[] => {
  const out: { lost: boolean; caught: boolean }[] = [];
  for (let i = 0; i < s.world.events.length; i++) {
    const e = s.world.events.at(i);
    if (e.type === 'collapseResult') out.push({ lost: e.n === 1, caught: e.big });
  }
  return out;
};
const caches = (s: Simulation): number => s.world.pickups.items.filter((p) => p.active && p.defId === 'riftCache').length;

describe('the floor gives way', () => {
  it('marks a circle away from the player with a cache in the middle', () => {
    const s = newSim();
    const zone = open(s);
    expect(zone).toBeDefined();
    const d = Math.hypot(zone.x - s.world.player.x, zone.y - s.world.player.y);
    // the player starts outside it: walking in is the decision
    expect(d).toBeGreaterThanOrEqual(zone.radius + 59);
    expect(caches(s)).toBe(1);
    const cache = s.world.pickups.items.find((p) => p.active && p.defId === 'riftCache')!;
    expect(Math.hypot(cache.x - zone.x, cache.y - zone.y)).toBeLessThan(1);
  });

  it('is drawn where the player can see it, on any screen, and never on top of them', () => {
    for (const [w, h] of [[1280, 720], [1280, 591], [405, 877], [720, 720]]) {
      for (let seed = 1; seed <= 40; seed++) {
        const s = new Simulation({ seed, characterId: 'survivor', stageId: 'station', viewW: w, viewH: h });
        const zone = open(s);
        const dx = Math.abs(zone.x - s.world.player.x);
        const dy = Math.abs(zone.y - s.world.player.y);
        expect(dx, `${w}x${h} seed ${seed}`).toBeLessThanOrEqual(Math.max(w / 2 - 100, 0) + 1);
        expect(dy, `${w}x${h} seed ${seed}`).toBeLessThanOrEqual(Math.max(h / 2 - 100, 0) + 1);
        expect(Math.hypot(dx, dy), `${w}x${h} seed ${seed}`).toBeGreaterThanOrEqual(zone.radius + 59);
      }
    }
  });

  it('is the same circle for the same seed', () => {
    const a = open(newSim(21));
    const b = open(newSim(21));
    expect([a.x, a.y]).toEqual([b.x, b.y]);
  });

  it('leaves time to walk in, take the cache and walk out', () => {
    const s = newSim();
    const zone = open(s);
    const playerSpeed = 200;
    const there = Math.hypot(zone.x - s.world.player.x, zone.y - s.world.player.y);
    const out = zone.radius;
    expect(((there + out) / playerSpeed) * 1000).toBeLessThan(zone.totalMs - 1500);
  });

  it('takes the cache with it when nobody came', () => {
    const s = newSim();
    s.run.god = true;
    const zone = open(s);
    s.stepMany(Math.ceil(zone.totalMs / (1000 / 60)) + 2);
    expect(s.world.collapses).toHaveLength(0);
    expect(caches(s)).toBe(0);
    expect(s.run.chestsOpened).toBe(0);
    const result = results(s);
    expect(result).toEqual([{ lost: true, caught: false }]);
  });

  it('hurts a player who is standing on it, and not one who is not', () => {
    const inside = newSim();
    const zone = open(inside);
    inside.world.player.x = zone.x + zone.radius * 0.6;
    inside.world.player.y = zone.y;
    const before = inside.world.player.hp;
    inside.stepMany(Math.ceil(zone.totalMs / (1000 / 60)) + 2);
    expect(inside.world.player.hp).toBeLessThan(before);
    expect(inside.world.player.hp).toBeGreaterThan(0);

    const outside = newSim();
    outside.run.god = false;
    const z2 = open(outside);
    // no waves in the first nine seconds reach a player standing still, so any loss is the floor
    outside.setStatOverride('moveSpeed', 0);
    const hp = outside.world.player.hp;
    outside.stepMany(Math.ceil(z2.totalMs / (1000 / 60)) + 2);
    expect(outside.world.collapses).toHaveLength(0);
    expect(outside.world.player.hp).toBe(hp);
  });

  it('pays the chest to a player who walks in for it', () => {
    const s = newSim();
    s.run.god = true;
    s.giveWeapon('plasmaBlade', 2);
    const zone = open(s);
    s.world.player.x = zone.x;
    s.world.player.y = zone.y;
    s.stepMany(3);
    expect(s.run.chestsOpened).toBe(1);
    expect(caches(s)).toBe(0);
    // and when the floor goes, it reports the offer as taken, and the player still on it as caught
    s.stepMany(Math.ceil(zone.totalMs / (1000 / 60)));
    expect(results(s)).toEqual([{ lost: false, caught: true }]);
  });

  it('takes the ordinary bodies standing on it, and they are not kills', () => {
    const s = newSim();
    s.run.god = true;
    const zone = open(s);
    s.spawn('infected', 6, { x: zone.x, y: zone.y });
    s.spawn('infected', 1, { x: zone.x + zone.radius + 400, y: zone.y });
    s.world.enemies.forEach((e) => {
      e.speedMult = 0;
    });
    const kills = s.run.kills;
    s.setTime(0);
    s.stepMany(Math.ceil(zone.totalMs / (1000 / 60)) + 2);
    const left = s.world.enemies.items.filter((e) => e.active && e.defId === 'infected' && Math.hypot(e.x - zone.x, e.y - zone.y) <= zone.radius);
    expect(left).toHaveLength(0);
    expect(s.world.enemies.items.some((e) => e.active && e.defId === 'infected')).toBe(true);
    expect(s.run.kills).toBe(kills);
    // each one is announced, after the collapse itself, so the view can show it falling in
    const log: string[] = [];
    for (let i = 0; i < s.world.events.length; i++) log.push(s.world.events.at(i).type);
    expect(log.filter((t) => t === 'swallowed')).toHaveLength(6);
    expect(log.indexOf('collapse')).toBeLessThan(log.indexOf('swallowed'));
  });

  it('spares a boss', () => {
    const s = newSim();
    s.run.god = true;
    const zone = open(s);
    s.spawnBoss();
    const boss = s.world.enemies.items.find((e) => e.active && e.def?.bossBar)!;
    boss.x = zone.x;
    boss.y = zone.y;
    boss.speedMult = 0;
    s.world.player.x = zone.x + 3000;
    s.stepMany(Math.ceil(zone.totalMs / (1000 / 60)) + 2);
    expect(s.world.enemies.items.some((e) => e.active && e.def?.bossBar)).toBe(true);
  });

  it('never shares a minute with a boss, on any stage that has one', () => {
    for (const stage of STAGE_ORDER) {
      const bosses = stage.events.filter((e) => e.kind === 'boss' || e.kind === 'final').map((e) => e.at);
      for (const e of stage.events) {
        if (e.kind !== 'collapse') continue;
        for (const at of bosses) expect(Math.abs(e.at - at), `${stage.id} collapse at ${e.at}`).toBeGreaterThanOrEqual(60);
      }
    }
  });
});
