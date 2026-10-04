import { describe, it, expect } from 'vitest';
import { Simulation } from '../../src/core/sim/simulation';
import { rollDrops } from '../../src/core/sim/systems/pickupSystem';
import { CONTENT } from '../../src/core/content/registry';
import { Rng } from '../../src/core/rng';
import { OPENING_DISTANCE } from '../../src/data/stages';

/** The first minute: something to hit at once, no chest panel in the first 45 s, and the turn hint's inputs. */
describe('the opening', () => {
  it('the station starts with drones on both sides of the player', () => {
    const s = new Simulation({ seed: 1, characterId: 'survivor', stageId: 'station' });
    const left = s.world.enemies.items.filter((e) => e.active && e.x < -100);
    const right = s.world.enemies.items.filter((e) => e.active && e.x > 100);
    expect(left.length).toBe(3);
    expect(right.length).toBe(3);
    for (const e of [...left, ...right]) expect(Math.abs(Math.abs(e.x) - OPENING_DISTANCE)).toBeLessThan(1);
    // and the blade, which sweeps both sides, meets them within the first swing or two
    s.setInput(0, 0);
    s.stepMany(60 * 8);
    expect(s.run.kills).toBeGreaterThanOrEqual(2);
  });

  it('a weapon that fires one way meets them ahead; the orbit, which cannot clear a column, meets none', () => {
    const placed = (characterId: string) => {
      const s = new Simulation({ seed: 1, characterId, stageId: 'station' });
      const all = s.world.enemies.items.filter((e) => e.active && e.defId === 'drone');
      return { ahead: all.filter((e) => e.x > 100).length, behind: all.filter((e) => e.x < -100).length };
    };
    for (const ch of ['marine', 'gunner']) expect(placed(ch), ch).toEqual({ ahead: 6, behind: 0 });
    expect(placed('navigator')).toEqual({ ahead: 0, behind: 0 });
    for (const ch of ['survivor', 'engineer', 'unit', 'sapper', 'welder']) expect(placed(ch), ch).toEqual({ ahead: 3, behind: 3 });
  });

  it('nobody who stands still is bitten in the first eight seconds', () => {
    // the drones used to stand on both sides for everyone: a standing gunner or navigator was
    // bitten at 3.5 s and dead at 15
    for (const ch of Object.keys(CONTENT.characters)) {
      for (const seed of [1, 2, 3, 4]) {
        const s = new Simulation({ seed, characterId: ch, stageId: 'station' });
        const hp = s.world.player.hp;
        for (let t = 0; t < 60 * 8; t++) {
          if (s.run.phase === 'levelup') s.applyChoice(0);
          s.step();
        }
        expect(s.world.player.hp, `${ch} seed ${seed}`).toBe(hp);
      }
    }
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
