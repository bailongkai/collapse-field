import { describe, it, expect } from 'vitest';
import { Simulation } from '../../src/core/sim/simulation';
import { FIXED_DT_MS, PLAYER_BASE_SPEED } from '../../src/config';

const newSim = () => new Simulation({ seed: 42, characterId: 'survivor', stageId: 'station' });

describe('Simulation', () => {
  it('advances the clock by exactly one fixed tick per step', () => {
    const s = newSim();
    s.stepMany(60);
    expect(s.run.tick).toBe(60);
    expect(s.run.timeMs).toBeCloseTo(60 * FIXED_DT_MS, 6);
  });

  it('moves the player at the base speed and sets facing', () => {
    const s = newSim();
    s.setInput(1, 0);
    s.stepMany(120);
    expect(s.world.player.x).toBeCloseTo(PLAYER_BASE_SPEED * 2, 1);
    expect(s.world.player.y).toBeCloseTo(0, 6);
    expect(s.world.player.facing).toBeCloseTo(0, 6);
  });

  it('normalises diagonal input so it is not faster', () => {
    const s = newSim();
    s.setInput(1, 1);
    s.stepMany(60);
    const d = Math.hypot(s.world.player.x, s.world.player.y);
    expect(d).toBeCloseTo(PLAYER_BASE_SPEED, 1);
  });

  it('is deterministic for the same seed and inputs', () => {
    const a = newSim();
    const b = newSim();
    for (const sim of [a, b]) {
      sim.setInput(1, 0.5);
      sim.stepMany(90);
      sim.setInput(-1, 0);
      sim.stepMany(90);
    }
    expect(a.world.player.x).toBe(b.world.player.x);
    expect(a.world.player.y).toBe(b.world.player.y);
  });

  it('freezes time while paused and resumes cleanly', () => {
    const s = newSim();
    s.stepMany(10);
    const t0 = s.run.timeMs;
    s.pause();
    expect(s.run.phase).toBe('paused');
    expect(s.stepMany(60)).toBe(0);
    expect(s.run.timeMs).toBe(t0);
    s.resume();
    expect(s.stepMany(6)).toBe(6);
    expect(s.run.timeMs).toBeGreaterThan(t0);
  });

  it('setStatOverride pins a stat to an exact value and scales travel distance', () => {
    const s = newSim();
    s.setStatOverride('moveSpeed', 0.5);
    expect(s.stats.moveSpeed).toBe(0.5);
    s.setInput(1, 0);
    s.stepMany(60);
    expect(s.world.player.x).toBeCloseTo(PLAYER_BASE_SPEED * 0.5, 1);
  });

  it('the player stands still until given input', () => {
    const s = newSim();
    s.stepMany(120);
    expect(s.world.player.x).toBe(0);
    expect(s.world.player.y).toBe(0);
  });

  it('regenerates health in whole points using the fractional carry', () => {
    const s = newSim();
    s.world.player.hp = 50;
    s.setStatOverride('recovery', 2);
    s.stepMany(30);
    expect(s.world.player.hp).toBe(51);
    s.stepMany(30);
    expect(s.world.player.hp).toBe(52);
  });

  it('does not end the run on the timer alone: the reaper is what closes it', () => {
    const s = newSim();
    s.setStatOverride('moveSpeed', 0);
    s.setTime(899.9);
    s.stepMany(30);
    expect(s.run.phase).toBe('running');
    expect(s.run.reaperSpawned).toBe(true);

    // the reaper kills through everything, and reaching fifteen minutes counts as surviving
    s.run.god = true;
    s.stepMany(60 * 20);
    expect(s.run.phase).toBe('ended');
    expect(s.run.ended).toBe('survived');
  });

  it('stops stepping once the run has ended', () => {
    const s = newSim();
    s.endRun('died');
    expect(s.stepMany(30)).toBe(0);
    expect(s.run.ended).toBe('died');
  });
});
