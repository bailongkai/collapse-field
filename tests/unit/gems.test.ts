import { describe, it, expect } from 'vitest';
import { Simulation } from '../../src/core/sim/simulation';
import { xpToReach } from '../../src/core/stats/xpCurve';
import { MAGNET_BASE_RADIUS } from '../../src/config';

const newSim = (seed = 4) => {
  const s = new Simulation({ seed, characterId: 'survivor', stageId: 'station' });
  s.run.god = true;
  return s;
};

describe('gem magnet and collection', () => {
  it('ignores gems outside the magnet radius', () => {
    const s = newSim();
    s.spawnGems(1, 'blue', { x: MAGNET_BASE_RADIUS + 200, y: 0 });
    s.stepMany(30);
    expect(s.world.gems.count).toBe(1);
    expect(s.run.xp).toBe(0);
  });

  it('pulls in and collects a gem inside the magnet radius', () => {
    const s = newSim();
    s.spawnGems(1, 'green', { x: MAGNET_BASE_RADIUS - 10, y: 0 });
    s.stepMany(60);
    expect(s.world.gems.count).toBe(0);
    expect(s.run.xp).toBeGreaterThanOrEqual(3);
  });

  it('accelerates: the pull starts slow and speeds up', () => {
    const s = newSim();
    s.spawnGems(1, 'blue', { x: MAGNET_BASE_RADIUS - 5, y: 0 });
    const gem = s.world.gems.items[s.world.gems.aliveList()[0]];
    const start = gem.x;
    s.stepMany(3);
    const early = start - gem.x;
    s.stepMany(3);
    const later = start - gem.x - early;
    expect(later).toBeGreaterThan(early);
  });

  it('the magnet stat widens the pickup radius', () => {
    const s = newSim();
    s.setStatOverride('magnet', 4);
    s.spawnGems(1, 'blue', { x: MAGNET_BASE_RADIUS * 3, y: 0 });
    s.stepMany(90);
    expect(s.run.xp).toBeGreaterThan(0);
  });

  it('vacuum attracts every gem including merged ones', () => {
    const s = newSim();
    s.spawnGems(20, 'blue', { x: 900, y: 0 });
    expect(s.vacuum()).toBe(20);
    s.stepMany(180);
    expect(s.world.gems.count).toBe(0);
    expect(s.run.xp + xpToReach(2) * (s.run.level - 1)).toBeGreaterThan(0);
  });

  it('folds a gem left far behind into one the player can still reach', () => {
    const s = newSim();
    s.spawnGems(1, 'blue', { x: 200, y: 0 });
    s.spawnGems(1, 'red', { x: 99999, y: 0 });
    expect(s.world.gems.count).toBe(2);
    s.stepMany(2);
    expect(s.world.gems.count).toBe(1);
    const remaining = s.world.gems.items[s.world.gems.aliveList()[0]];
    expect(remaining.value).toBe(6);
    expect(remaining.tier).toBe('merged');
  });
});

describe('xp and levelling', () => {
  it('growth multiplies collected xp', () => {
    const s = newSim();
    s.setStatOverride('growth', 3);
    s.spawnGems(1, 'blue', { x: 20, y: 0 });
    s.stepMany(10);
    expect(s.run.xp).toBe(3);
  });

  it('crossing two thresholds in one grant queues two level-ups', () => {
    const s = newSim();
    s.addXp(xpToReach(2) + xpToReach(3));
    expect(s.run.level).toBe(3);
    expect(s.run.pendingLevelUps).toBe(2);
  });

  it('the level-up offer freezes the simulation until a choice is applied', () => {
    const s = newSim();
    s.addXp(xpToReach(2));
    s.stepMany(1);
    expect(s.run.phase).toBe('levelup');
    expect(s.run.choices?.length).toBeGreaterThanOrEqual(2);
    const before = s.run.timeMs;
    expect(s.stepMany(60)).toBe(0);
    expect(s.run.timeMs).toBe(before);

    expect(s.applyChoice(0)).toBe(true);
    expect(s.run.phase).toBe('running');
    expect(s.stepMany(1)).toBe(1);
  });

  it('re-rolls in place while more level-ups are queued', () => {
    const s = newSim();
    s.addXp(xpToReach(2) + xpToReach(3));
    s.stepMany(1);
    expect(s.run.phase).toBe('levelup');
    s.applyChoice(0);
    expect(s.run.phase).toBe('levelup');
    expect(s.run.choices).not.toBeNull();
    s.applyChoice(0);
    expect(s.run.phase).toBe('running');
  });

  it('death on the same tick wins over a pending level-up', () => {
    const s = newSim(9);
    s.run.god = false;
    s.setStatOverride('moveSpeed', 0);
    s.spawn('mech', 8, { x: 0, y: 0 });
    s.world.player.hp = 1;
    s.addXp(xpToReach(2));
    s.stepMany(1);
    expect(s.run.phase).toBe('ended');
    expect(s.run.ended).toBe('died');
  });
});
