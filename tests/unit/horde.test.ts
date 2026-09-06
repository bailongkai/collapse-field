import { describe, it, expect } from 'vitest';
import { Simulation } from '../../src/core/sim/simulation';
import type { Enemy } from '../../src/core/sim/entities/enemy';
import { SEPARATION_MAX_PUSH } from '../../src/config';
import { spawnRingRadius, waveRow } from '../../src/core/sim/systems/spawnSystem';
import { stageDef } from '../../src/core/content/registry';

const newSim = (seed = 3) => new Simulation({ seed, characterId: 'survivor', stageId: 'station' });
const stage = stageDef('station');

describe('separation', () => {
  it('spreads a jammed crowd out instead of leaving it stacked on one point', () => {
    const s = newSim();
    s.run.god = true;
    // 500 enemies stacked inside a 20 px box around the player
    for (let i = 0; i < 500; i++) s.spawn('drone', 1, { x: (i % 20) - 10, y: Math.floor(i / 20) - 10 });
    expect(s.world.enemies.count).toBe(500);
    s.stepMany(120);

    const items = s.world.enemies.items;
    const alive = s.world.enemies.aliveList();
    const crowd: Enemy[] = [];
    for (let i = 0; i < s.world.enemies.count; i++) crowd.push(items[alive[i]]);

    // the blob expands into a wide carpet rather than staying a point
    const crowdRadius = Math.max(...crowd.map((e) => Math.hypot(e.x - s.world.player.x, e.y - s.world.player.y)));
    expect(crowdRadius).toBeGreaterThan(150);

    // and neighbours keep a real distance: dense like Vampire Survivors, never coincident
    const nearest = crowd
      .map((a) => {
        let best = Infinity;
        for (const b of crowd) {
          if (a === b) continue;
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < best) best = d;
        }
        return best;
      })
      .sort((x, y) => x - y);
    expect(nearest[0]).toBeGreaterThan(2);
    expect(nearest[Math.floor(nearest.length / 2)]).toBeGreaterThan(10);
  });

  it('never moves an enemy more than the per-step clamp from separation alone', () => {
    const s = newSim();
    s.setStatOverride('moveSpeed', 0);
    for (let i = 0; i < 40; i++) s.spawn('drone', 1, { x: 0, y: 0 });
    const before = s.world.enemies.items.map((e) => ({ x: e.x, y: e.y, active: e.active }));
    s.stepMany(1);
    for (const e of s.world.enemies.items) {
      if (!e.active) continue;
      const b = before[e.id];
      // chase movement (70 px/s) plus at most one clamped separation push
      const moved = Math.hypot(e.x - b.x, e.y - b.y);
      expect(moved).toBeLessThan(70 / 60 + SEPARATION_MAX_PUSH + 0.001);
    }
  });
});

describe('knockback', () => {
  it('decays and is clamped, and heavy enemies resist it', () => {
    const s = newSim();
    s.setStatOverride('moveSpeed', 0);
    s.spawn('drone', 1, { x: 100, y: 0 });
    const drone = s.world.enemies.items[s.world.enemies.aliveList()[0]];
    drone.hp = 1e6;
    s.damageEnemy(drone, 1, 1, 0, 10);
    expect(Math.abs(drone.kbx)).toBeLessThanOrEqual(600);
    const first = drone.kbx;
    s.stepMany(1);
    expect(Math.abs(drone.kbx)).toBeLessThan(Math.abs(first));

    const s2 = newSim();
    s2.spawn('mothership', 1, { x: 100, y: 0 });
    const boss = s2.world.enemies.items[s2.world.enemies.aliveList()[0]];
    s2.damageEnemy(boss, 1, 1, 0, 10);
    expect(boss.kbx).toBe(0);
  });
});

describe('wave table and spawner', () => {
  it('returns the row for every second of the run and clamps past the end', () => {
    for (let sec = 0; sec <= 900; sec += 7) {
      const row = waveRow(stage, sec * 1000);
      expect(row.minute).toBe(Math.min(Math.floor(sec / 60), stage.waves.length - 1));
    }
    expect(waveRow(stage, 99999999).minute).toBe(stage.waves.length - 1);
  });

  it('fills the field towards the wave minimum within 30 seconds', () => {
    const s = newSim();
    s.run.god = true;
    s.stepMany(30 * 60);
    const row = waveRow(stage, s.run.timeMs);
    expect(s.world.enemies.count).toBeGreaterThanOrEqual(Math.min(row.minCount, 12));
    expect(s.world.enemies.count).toBeLessThanOrEqual(s.world.enemies.capacity);
  });

  it('spawns enemies outside the view, never on top of the player', () => {
    const s = newSim();
    s.run.god = true;
    s.stepMany(120);
    const ring = spawnRingRadius(stage);
    const alive = s.world.enemies.aliveList();
    expect(s.world.enemies.count).toBeGreaterThan(0);
    for (let i = 0; i < s.world.enemies.count; i++) {
      const e = s.world.enemies.items[alive[i]];
      expect(Math.hypot(e.x - s.world.player.x, e.y - s.world.player.y)).toBeGreaterThan(300);
    }
    void ring;
  });

  it('relocates a chase enemy that falls far behind, keeping its health', () => {
    const s = newSim();
    s.run.god = true;
    s.spawn('robot', 1, { x: 20000, y: 0 });
    const e = s.world.enemies.items[s.world.enemies.aliveList()[0]];
    e.hp = 7;
    s.stepMany(1);
    expect(e.active).toBe(true);
    expect(e.hp).toBe(7);
    expect(Math.hypot(e.x - s.world.player.x, e.y - s.world.player.y)).toBeLessThan(spawnRingRadius(stage) * 1.2);
  });

  it('never overflows the enemy pool', () => {
    const s = newSim();
    s.run.god = true;
    s.setTime(14 * 60);
    s.stepMany(60 * 120);
    expect(s.world.enemies.count).toBeLessThanOrEqual(s.world.enemies.capacity);
  });
});

describe('contact damage', () => {
  it('damages the player once per i-frame window and respects armor', () => {
    const s = newSim();
    s.setStatOverride('moveSpeed', 0);
    s.spawn('drone', 10, { x: 0, y: 0 });
    const hp0 = s.world.player.hp;
    s.stepMany(1);
    expect(s.world.player.hp).toBe(hp0 - 3);
    s.stepMany(20); // still inside the 400 ms i-frame window
    expect(s.world.player.hp).toBe(hp0 - 3);
    s.stepMany(10);
    expect(s.world.player.hp).toBeLessThan(hp0 - 3);
  });

  it('armor reduces damage but never below 1', () => {
    const s = newSim();
    s.setStatOverride('moveSpeed', 0);
    s.setStatOverride('armor', 100);
    s.spawn('drone', 4, { x: 0, y: 0 });
    const hp0 = s.world.player.hp;
    s.stepMany(1);
    expect(s.world.player.hp).toBe(hp0 - 1);
  });

  it('god mode blocks contact damage but the run can still be ended', () => {
    const s = newSim();
    s.setStatOverride('moveSpeed', 0);
    s.run.god = true;
    s.spawn('mech', 6, { x: 0, y: 0 });
    const hp0 = s.world.player.hp;
    s.stepMany(300);
    expect(s.world.player.hp).toBe(hp0);
    s.run.god = false;
    s.stepMany(600);
    expect(s.run.phase).toBe('ended');
    expect(s.run.ended).toBe('died');
  });
});

describe('kills and drops', () => {
  it('killing an enemy raises the counter and drops a gem of its tier', () => {
    const s = newSim();
    s.run.god = true;
    s.spawn('robot', 1, { x: 50, y: 0 });
    const e = s.world.enemies.items[s.world.enemies.aliveList()[0]];
    s.damageEnemy(e, 1000, 1, 0, 0);
    expect(s.run.kills).toBe(1);
    expect(s.world.gems.count).toBe(1);
    expect(s.world.gems.items[s.world.gems.aliveList()[0]].value).toBe(3);
  });

  it('the gem cap folds extra value into the gem nearest the player', () => {
    const s = newSim();
    s.run.god = true;
    const cap = stage.gemCap;
    for (let i = 0; i < cap + 20; i++) {
      s.spawn('drone', 1, { x: 60 + i, y: 0 });
      const e = s.world.enemies.items[s.world.enemies.aliveList()[0]];
      s.damageEnemy(e, 1000, 1, 0, 0);
    }
    expect(s.world.gems.count).toBeLessThanOrEqual(cap);
    const merged = s.world.gems.items.filter((g) => g.active && g.tier === 'merged');
    expect(merged.length).toBeGreaterThan(0);
    const total = s.world.gems.items.filter((g) => g.active).reduce((sum, g) => sum + g.value, 0);
    expect(total).toBe(cap + 20);
  });

  it('the invulnerable reaper cannot be damaged or killed', () => {
    const s = newSim();
    s.run.god = true;
    s.spawn('annihilator', 1, { x: 400, y: 0 });
    const e = s.world.enemies.items[s.world.enemies.aliveList()[0]];
    s.damageEnemy(e, 1e9, 1, 0, 5);
    expect(e.active).toBe(true);
    expect(s.killAllOnScreen()).toBe(0);
    expect(s.world.enemies.count).toBe(1);
  });

  it('the reaper kills through god mode', () => {
    const s = newSim();
    s.run.god = true;
    s.setStatOverride('moveSpeed', 0);
    s.spawn('annihilator', 1, { x: 0, y: 0 });
    s.stepMany(2);
    expect(s.run.phase).toBe('ended');
    expect(s.run.ended).toBe('died');
  });
});

describe('simulation benchmark', () => {
  it('steps 500 enemies well under the frame budget', () => {
    const s = newSim();
    s.run.god = true;
    s.spawn('drone', 500, { ring: true, radius: 400 });
    s.stepMany(60); // warm up
    const start = performance.now();
    const steps = 600;
    s.stepMany(steps);
    const msPerStep = (performance.now() - start) / steps;
    expect(s.world.enemies.count).toBeGreaterThan(400);
    expect(msPerStep, `${msPerStep.toFixed(3)} ms/step`).toBeLessThan(3);
  });
});
