import { describe, it, expect } from 'vitest';
import { Simulation } from '../../src/core/sim/simulation';
import { stageDef } from '../../src/core/content/registry';
import { spawnRingRadius } from '../../src/core/sim/systems/spawnSystem';
import { REF_H, REF_W } from '../../src/config';
import type { Enemy } from '../../src/core/sim/entities/enemy';

const stage = stageDef('station');
const newSim = (seed = 6) => {
  const s = new Simulation({ seed, characterId: 'survivor', stageId: 'station' });
  s.run.god = true;
  s.setStatOverride('growth', 0); // no level-ups interrupting long batches
  return s;
};
const byBehavior = (s: Simulation, behavior: Enemy['behavior']): Enemy[] => {
  const out: Enemy[] = [];
  const alive = s.world.enemies.aliveList();
  for (let i = 0; i < s.world.enemies.count; i++) {
    const e = s.world.enemies.items[alive[i]];
    if (e.behavior === behavior) out.push(e);
  }
  return out;
};

describe('wave events', () => {
  it('fires each event exactly once', () => {
    const s = newSim();
    s.setTime(89);
    s.stepMany(120);
    const first = byBehavior(s, 'line').length;
    expect(first).toBeGreaterThan(20);
    s.stepMany(60);
    expect(byBehavior(s, 'line').length).toBeLessThanOrEqual(first);
  });

  it('setTime skips the events it jumps over instead of firing them all at once', () => {
    const s = newSim();
    s.setTime(600); // past two swarms and the first boss
    s.stepMany(2);
    expect(byBehavior(s, 'line')).toHaveLength(0);
    // the boss scheduled exactly at 600 s is in the past too
    expect(byBehavior(s, 'boss')).toHaveLength(0);
  });

  it('a swarm crosses the field instead of being recycled behind the player', () => {
    const s = newSim();
    s.setTime(89);
    s.stepMany(120);
    const line = byBehavior(s, 'line');
    expect(line.length).toBeGreaterThan(20);
    const before = line.length;
    s.stepMany(60);
    // line enemies keep travelling: none is teleported back to the spawn ring
    expect(byBehavior(s, 'line').length).toBe(before);
    for (const e of byBehavior(s, 'line')) expect(Math.abs(e.dirX) + Math.abs(e.dirY)).toBeGreaterThan(0);
  });

  it('a swarm is removed only after it has crossed the view, at every view width', () => {
    for (const viewW of [REF_W, 1760]) {
      const s = new Simulation({ seed: 6, characterId: 'survivor', stageId: 'station', viewW, viewH: REF_H });
      s.run.god = true;
      s.setStatOverride('growth', 0);
      s.setStatOverride('moveSpeed', 0);
      s.setTime(89);
      s.stepMany(70);
      expect(byBehavior(s, 'line').length).toBeGreaterThan(20);
      let vanishedWhileVisible = 0;
      let last = byBehavior(s, 'line').length;
      for (let t = 0; t < 60 * 20; t++) {
        const before = byBehavior(s, 'line').map((e) => ({ x: e.x - s.world.player.x, y: e.y - s.world.player.y }));
        s.stepMany(1);
        const after = byBehavior(s, 'line').length;
        if (after < last) {
          const inside = before.filter((p) => Math.abs(p.x) < viewW / 2 && Math.abs(p.y) < REF_H / 2).length;
          vanishedWhileVisible += Math.max(0, inside - after);
        }
        last = after;
      }
      expect(vanishedWhileVisible, `view ${viewW}`).toBe(0);
      expect(byBehavior(s, 'line'), `view ${viewW}: the rush must have finished`).toHaveLength(0);
    }
  });

  it('a swarm despawns once its lifetime runs out', () => {
    const s = newSim();
    s.setTime(89);
    s.stepMany(120);
    expect(byBehavior(s, 'line').length).toBeGreaterThan(0);
    s.stepMany(60 * 20); // long past any crossing
    expect(byBehavior(s, 'line')).toHaveLength(0);
  });
});

describe('boss', () => {
  it('spawns with scaled health, is never relocated and drops a chest on death', () => {
    const s = newSim();
    s.spawnBoss();
    const boss = byBehavior(s, 'boss')[0];
    expect(boss).toBeDefined();
    expect(boss.maxHp).toBe(1500);

    // even far away it keeps chasing rather than being teleported to the ring
    boss.x = s.world.player.x + spawnRingRadius(stage, REF_W, REF_H) * 5;
    s.stepMany(2);
    expect(Math.hypot(boss.x - s.world.player.x, boss.y - s.world.player.y)).toBeGreaterThan(spawnRingRadius(stage, REF_W, REF_H) * 2);

    s.damageEnemy(boss, 1e6, 1, 0, 0);
    expect(boss.active).toBe(false);
    const chests = s.world.pickups.items.filter((p) => p.active && p.defId === 'chest');
    expect(chests).toHaveLength(1);
    expect(s.world.gems.count).toBeGreaterThanOrEqual(10);
  });

  it('ignores knockback', () => {
    const s = newSim();
    s.spawnBoss();
    const boss = byBehavior(s, 'boss')[0];
    s.damageEnemy(boss, 1, 1, 0, 10);
    expect(boss.kbx).toBe(0);
  });
});

describe('reaper', () => {
  it('spawns at the end of the run and is flagged', () => {
    const s = newSim();
    s.setStatOverride('moveSpeed', 0);
    s.setTime(899.5);
    s.stepMany(60);
    expect(s.run.reaperSpawned).toBe(true);
    expect(byBehavior(s, 'reaper').length).toBe(1);
  });

  it('always closes on the player, however fast they run', () => {
    const s = newSim();
    s.spawnReaper();
    const reaper = byBehavior(s, 'reaper')[0];
    reaper.x = s.world.player.x + 900;
    reaper.y = s.world.player.y;
    s.setStatOverride('moveSpeed', 4); // 800 px/s
    s.setInput(1, 0);
    const gap = () => Math.hypot(reaper.x - s.world.player.x, reaper.y - s.world.player.y);
    const before = gap();
    s.stepMany(120);
    expect(gap()).toBeLessThan(before);
  });

  it('cannot be killed, ignores screen clears, and kills through god mode', () => {
    const s = newSim();
    s.setStatOverride('moveSpeed', 0);
    s.spawnReaper();
    const reaper = byBehavior(s, 'reaper')[0];
    s.damageEnemy(reaper, 1e9, 1, 0, 5);
    expect(reaper.active).toBe(true);
    s.killAllOnScreen();
    expect(byBehavior(s, 'reaper').length).toBe(1);

    reaper.x = s.world.player.x;
    reaper.y = s.world.player.y;
    s.run.god = true;
    s.stepMany(2);
    expect(s.run.phase).toBe('ended');
  });
});

describe('pickups', () => {
  it('heals, and never past the maximum', () => {
    const s = newSim();
    s.world.player.hp = 40;
    s.spawnPickup('heal', s.world.player.x, s.world.player.y);
    s.stepMany(2);
    expect(s.world.player.hp).toBe(70);
    s.world.player.hp = 95;
    s.spawnPickup('heal', s.world.player.x, s.world.player.y);
    s.stepMany(2);
    expect(s.world.player.hp).toBe(100);
  });

  it('gold is scaled by greed', () => {
    const s = newSim();
    s.setStatOverride('greed', 2);
    s.spawnPickup('coin', s.world.player.x, s.world.player.y);
    s.stepMany(2);
    expect(s.run.gold).toBe(20);
  });

  it('the magnet pulse attracts every gem on the field', () => {
    const s = newSim();
    s.spawnGems(30, 'blue', { x: 2000, y: 0 });
    s.spawnPickup('vacuum', s.world.player.x, s.world.player.y);
    s.stepMany(2);
    const gems = s.world.gems.items.filter((g) => g.active);
    expect(gems.length).toBeGreaterThan(0);
    for (const g of gems) expect(g.attracted).toBe(true);
  });

  it('the EMP burst clears the screen but spares the reaper', () => {
    const s = newSim();
    s.spawn('drone', 40, { radius: 200 });
    s.spawnReaper();
    s.spawnPickup('nuke', s.world.player.x, s.world.player.y);
    s.stepMany(2);
    expect(byBehavior(s, 'chase')).toHaveLength(0);
    expect(byBehavior(s, 'reaper')).toHaveLength(1);
  });

  it('the supply chest raises owned weapons', () => {
    const s = newSim();
    s.giveWeapon('guidedLaser', 1);
    const before = s.run.weapons.reduce((n, w) => n + w.level, 0);
    s.spawnPickup('chest', s.world.player.x, s.world.player.y);
    s.stepMany(2);
    expect(s.run.weapons.reduce((n, w) => n + w.level, 0)).toBe(before + 3);
  });

  it('respects the ground limit for a pickup type', () => {
    const s = newSim();
    let placed = 0;
    for (let i = 0; i < 10; i++) if (s.spawnPickup('heal', 900 + i * 40, 0)) placed++;
    expect(placed).toBe(3);
  });
});
