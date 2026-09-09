import { describe, it, expect } from 'vitest';
import { Simulation } from '../../src/core/sim/simulation';
import type { Enemy } from '../../src/core/sim/entities/enemy';

const newSim = (seed = 5) => {
  const s = new Simulation({ seed, characterId: 'survivor', stageId: 'station' });
  s.setStatOverride('growth', 0);
  s.setStatOverride('might', 0); // the weapons must not decide these tests
  s.setStatOverride('curse', -1); // and neither must the wave table: curse -1 stops it spawning
  return s;
};
const spawn = (s: Simulation, id: string, x: number, y = 0): Enemy => {
  s.spawn(id, 1, { x, y });
  const alive = s.world.enemies.aliveList();
  return s.world.enemies.items[alive[s.world.enemies.count - 1]];
};
const count = (s: Simulation, id: string) => s.world.enemies.items.filter((e) => e.active && e.defId === id).length;

describe('自爆无人机 (bomber)', () => {
  it('arms when close, flashes through its fuse, then detonates and hurts a player inside the blast', () => {
    const s = newSim();
    s.setStatOverride('moveSpeed', 0);
    const b = spawn(s, 'bomber', 300);
    const hp0 = s.world.player.hp;
    s.stepMany(60 * 6);
    expect(b.active, 'the bomber never went off').toBe(false);
    expect(s.world.player.hp).toBeLessThan(hp0);
    expect(s.run.kills, 'a detonation is not a kill').toBe(0);
  });

  it('a player who backs out of the blast takes nothing', () => {
    const s = newSim();
    const b = spawn(s, 'bomber', 60);
    // it is inside trigger range at once, to the right; run left, away from it, through the fuse
    s.setInput(-1, 0);
    s.stepMany(70);
    expect(b.active).toBe(false);
    expect(s.world.player.hp).toBe(s.stats.maxHealth);
  });

  it('a mine is a bomber that waits, and goes off when touched', () => {
    const s = newSim();
    const m = spawn(s, 'mine', 200);
    s.stepMany(60 * 3);
    expect(m.active, 'a mine must not wander off or fire on its own').toBe(true);
    expect(m.x).toBe(200);
    s.setInput(1, 0);
    s.stepMany(60 * 3);
    expect(m.active).toBe(false);
    expect(s.world.player.hp).toBeLessThan(s.stats.maxHealth);
  });
});

describe('维修工兵 (healer)', () => {
  it('heals the wounded around it and keeps its distance', () => {
    const s = newSim();
    s.setStatOverride('moveSpeed', 0);
    const medic = spawn(s, 'medic', 140);
    const patient = spawn(s, 'robot', 180);
    patient.hp = 5;
    s.stepMany(60 * 5);
    expect(patient.hp).toBeGreaterThan(5);
    expect(Math.hypot(medic.x, medic.y)).toBeGreaterThan(120);
  });
});

describe('牵引车 (tractor)', () => {
  it('drags a player who stands still towards itself', () => {
    const s = newSim();
    s.setInput(0, 0);
    spawn(s, 'tractor', 220);
    const x0 = s.world.player.x;
    s.stepMany(60 * 2);
    expect(s.world.player.x).toBeGreaterThan(x0 + 20);
  });
});

describe('孵化囊 (nest)', () => {
  it('never moves and keeps hatching spores', () => {
    const s = newSim();
    s.setStatOverride('moveSpeed', 0);
    const nest = spawn(s, 'hatchery', 400);
    s.stepMany(60 * 8);
    expect(nest.x).toBe(400);
    expect(count(s, 'spore')).toBeGreaterThanOrEqual(6);
  });
});

describe('分裂体 (split)', () => {
  it('comes apart into spores where it died', () => {
    const s = newSim();
    const sp = spawn(s, 'splitter', 150);
    const before = count(s, 'spore');
    s.damageEnemy(sp, 1e6, 1, 0, 0);
    expect(sp.active).toBe(false);
    expect(count(s, 'spore') - before).toBe(3);
    expect(s.run.kills).toBe(1);
  });
});

describe('相位艇 (blink)', () => {
  it('reappears a fixed distance from the player after its telegraph', () => {
    const s = newSim(9);
    s.setStatOverride('moveSpeed', 0);
    const ph = spawn(s, 'phaser', 600);
    s.stepMany(60 * 6);
    const d = Math.hypot(ph.x - s.world.player.x, ph.y - s.world.player.y);
    expect(d, 'it should have blinked in close by now').toBeLessThan(200);
  });
});

describe('布雷艇 (layer)', () => {
  it('circles at a distance and leaves mines behind, up to its cap', () => {
    const s = newSim();
    s.setStatOverride('moveSpeed', 0);
    const ml = spawn(s, 'minelayer', 320);
    s.stepMany(60 * 40);
    expect(count(s, 'mine')).toBeGreaterThanOrEqual(3);
    expect(count(s, 'mine')).toBeLessThanOrEqual(12);
    expect(Math.hypot(ml.x, ml.y)).toBeGreaterThan(150);
  });
});
