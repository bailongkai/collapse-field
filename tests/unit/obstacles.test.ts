import { describe, it, expect } from 'vitest';
import { Simulation } from '../../src/core/sim/simulation';
import { resolveCircle, overlaps } from '../../src/core/sim/obstacles';
import { stageDef } from '../../src/core/content/registry';

describe('walls', () => {
  it('a circle is pushed out along the shallowest axis', () => {
    const out = { x: 0, y: 0 };
    expect(resolveCircle([{ x: 0, y: 0, w: 100, h: 100 }], 105, 50, 16, out)).toBe(true);
    expect(out.x).toBeCloseTo(116, 6);
    expect(resolveCircle([{ x: 0, y: 0, w: 100, h: 100 }], 50, 5, 16, out)).toBe(true);
    expect(out.y).toBeCloseTo(-16, 6);
    expect(resolveCircle([{ x: 0, y: 0, w: 100, h: 100 }], 200, 200, 16, out)).toBe(false);
  });

  it('the player cannot walk through a container on the cargo deck', () => {
    const s = new Simulation({ seed: 1, characterId: 'survivor', stageId: 'cargo' });
    s.run.god = true;
    s.setStatOverride('curse', -1);
    const wall = stageDef('cargo').obstacles![0];
    s.world.player.x = wall.x + wall.w / 2;
    s.world.player.y = wall.y - 60;
    s.setInput(0, 1); // walk down into it
    s.stepMany(60 * 3);
    expect(overlaps(wall, s.world.player.x, s.world.player.y, 16)).toBe(false);
    expect(s.world.player.y, 'the wall should have stopped the player').toBeLessThan(wall.y);
  });

  it('a chaser cannot push through either, and a rush can', () => {
    const s = new Simulation({ seed: 1, characterId: 'survivor', stageId: 'cargo' });
    s.run.god = true;
    s.setStatOverride('curse', -1);
    s.setStatOverride('might', 0);
    s.setStatOverride('moveSpeed', 0);
    const wall = stageDef('cargo').obstacles![0];
    s.world.player.x = wall.x + wall.w / 2;
    s.world.player.y = wall.y + wall.h + 200;
    s.spawn('robot', 1, { x: 0, y: -250 }); // above the wall, the player below it
    const alive = s.world.enemies.aliveList();
    const robot = s.world.enemies.items[alive[s.world.enemies.count - 1]];
    s.stepMany(60 * 4);
    expect(overlaps(wall, robot.x, robot.y, robot.radius)).toBe(false);
    // a swarm body walks straight over
    const idx = stageDef('cargo').events.findIndex((e) => e.kind === 'swarm');
    s.triggerEvent(idx);
    s.stepMany(60 * 6);
    const lines = s.world.enemies.items.filter((e) => e.active && e.behavior === 'line');
    expect(lines.length).toBeGreaterThan(0);
  });

  it('a body that spawns inside a wall is nudged out', () => {
    const s = new Simulation({ seed: 1, characterId: 'survivor', stageId: 'cargo' });
    s.setStatOverride('curse', -1);
    const wall = stageDef('cargo').obstacles![0];
    s.spawn('robot', 1, { x: wall.x + wall.w / 2, y: wall.y + wall.h / 2 });
    const alive = s.world.enemies.aliveList();
    const robot = s.world.enemies.items[alive[s.world.enemies.count - 1]];
    expect(overlaps(wall, robot.x, robot.y, robot.radius)).toBe(false);
  });
});
