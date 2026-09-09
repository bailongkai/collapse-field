import { describe, it, expect } from 'vitest';
import { Simulation } from '../../src/core/sim/simulation';
import { stageDef } from '../../src/core/content/registry';

describe('relics', () => {
  it('every stage places its relics at the start, where the data says', () => {
    for (const id of ['station', 'cargo', 'lab', 'orbit']) {
      const s = new Simulation({ seed: 1, characterId: 'survivor', stageId: id });
      const relics = stageDef(id).relics!;
      expect(relics.length).toBeGreaterThanOrEqual(3);
      for (const r of relics) {
        const found = s.world.pickups.items.some((p) => p.active && p.defId === r.pickup && p.x === r.x && p.y === r.y);
        expect(found, `${id}: ${r.pickup} at ${r.x},${r.y}`).toBe(true);
      }
    }
  });

  it('a relic waits: it is not pulled in, and it is not swept up as litter', () => {
    const s = new Simulation({ seed: 1, characterId: 'survivor', stageId: 'station' });
    s.run.god = true;
    s.setStatOverride('curse', -1);
    const before = s.world.pickups.count;
    s.setInput(0, 0);
    s.stepMany(60 * 20);
    expect(s.world.pickups.count).toBe(before);
    expect(s.run.chestsOpened).toBe(0);
  });

  it('walking onto the chest relic opens a boss-grade chest', () => {
    const s = new Simulation({ seed: 1, characterId: 'survivor', stageId: 'station' });
    s.run.god = true;
    s.setStatOverride('curse', -1);
    const relic = stageDef('station').relics!.find((r) => r.pickup === 'relicChest')!;
    s.world.player.x = relic.x;
    s.world.player.y = relic.y;
    s.stepMany(2);
    expect(s.run.chestsOpened).toBe(1);
    expect(s.takeChestResult()?.grade).toBe('boss');
  });
});
