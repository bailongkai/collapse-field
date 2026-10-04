import { describe, it, expect } from 'vitest';
import { Simulation } from '../../src/core/sim/simulation';
import { rollDrops } from '../../src/core/sim/systems/pickupSystem';
import { CONTENT } from '../../src/core/content/registry';
import { Rng } from '../../src/core/rng';

/** The first minute: something to hit at once, no chest panel in the first 45 s, and the turn hint's inputs. */
describe('the opening', () => {
  it('the station starts with drones on both sides of the player', () => {
    const s = new Simulation({ seed: 1, characterId: 'survivor', stageId: 'station' });
    const left = s.world.enemies.items.filter((e) => e.active && e.x < -100);
    const right = s.world.enemies.items.filter((e) => e.active && e.x > 100);
    expect(left.length).toBe(3);
    expect(right.length).toBe(3);
    for (const e of [...left, ...right]) expect(Math.abs(Math.abs(e.x) - 300)).toBeLessThan(1);
    // and the blade, which sweeps both sides, meets them within the first swing or two
    s.setInput(0, 0);
    s.stepMany(60 * 8);
    expect(s.run.kills).toBeGreaterThanOrEqual(2);
  });

  it('a wreck chest never falls before 45 s, however lucky the run', () => {
    const s = new Simulation({ seed: 2, characterId: 'survivor', stageId: 'station' });
    s.spawn('drone', 1, { x: 200, y: 0 });
    const e = s.world.enemies.items.find((x) => x.active && x.defId === 'drone')!;
    const chests = () => s.world.pickups.items.filter((p) => p.active && p.defId === 'wreckChest').length;
    for (let i = 0; i < 200; i++) rollDrops(s.world, e, new Rng(i), 50, CONTENT.pickupList, 30_000);
    expect(chests()).toBe(0);
    for (let i = 0; i < 200; i++) rollDrops(s.world, e, new Rng(i), 50, CONTENT.pickupList, 46_000);
    expect(chests()).toBe(1);
  });

  it('facingBalance splits the nearby crowd by the side the character faces', () => {
    const s = new Simulation({ seed: 3, characterId: 'marine', stageId: 'station' });
    s.world.enemies.clear();
    s.spawn('drone', 4, { x: -120, y: 0 });
    s.spawn('drone', 1, { x: 120, y: 0 });
    s.spawn('drone', 2, { x: 600, y: 0 }); // out of range
    s.world.rebuildGrid();
    expect(s.world.player.facing).toBe(0);
    expect(s.facingBalance(200)).toEqual({ ahead: 1, behind: 4 });
    s.setInput(-1, 0);
    s.stepMany(1);
    expect(s.facingBalance(200).ahead).toBeGreaterThanOrEqual(4);
    expect(s.hasSideWeapon()).toBe(true);
    const blade = new Simulation({ seed: 3, characterId: 'survivor', stageId: 'station' });
    expect(blade.hasSideWeapon()).toBe(false);
  });
});
