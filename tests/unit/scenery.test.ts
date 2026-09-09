import { describe, it, expect } from 'vitest';
import { Simulation } from '../../src/core/sim/simulation';
import { stageDef } from '../../src/core/content/registry';

const quiet = (stageId = 'station') => {
  const s = new Simulation({ seed: 6, characterId: 'survivor', stageId });
  s.run.god = true;
  s.setStatOverride('growth', 0);
  s.setStatOverride('curse', -1);
  return s;
};

describe('breakable scenery', () => {
  it('turns up on every stage, on its own clock, up to its cap', () => {
    for (const st of ['station', 'cargo', 'lab', 'orbit']) {
      const s = quiet(st);
      s.setStatOverride('might', 0);
      s.stepMany(60 * 90);
      const cfg = stageDef(st).props!;
      const alive = s.world.enemies.items.filter((e) => e.active && e.defId === cfg.enemy).length;
      expect(alive, `${st}: ${alive} props`).toBeGreaterThan(0);
      expect(alive).toBeLessThanOrEqual(cfg.max);
    }
  });

  it('does not bite, does not count as a kill, and drops something when broken', () => {
    const s = quiet();
    s.setStatOverride('moveSpeed', 0);
    s.spawn('crate', 1, { x: 20, y: 0 });
    s.stepMany(60);
    expect(s.world.player.hp).toBe(s.stats.maxHealth);
    const alive = s.world.enemies.aliveList();
    const crate = s.world.enemies.items[alive[s.world.enemies.count - 1]];
    let drops = 0;
    for (let i = 0; i < 20; i++) {
      s.spawn('crate', 1, { x: 300 + i * 10, y: 0 });
      const list = s.world.enemies.aliveList();
      const c = s.world.enemies.items[list[s.world.enemies.count - 1]];
      const before = s.world.pickups.count;
      s.damageEnemy(c, 1e6, 1, 0, 0);
      if (s.world.pickups.count > before) drops++;
    }
    s.damageEnemy(crate, 1e6, 1, 0, 0);
    expect(s.run.kills, 'scenery is not a kill').toBe(0);
    expect(drops, 'twenty crates and nothing fell out').toBeGreaterThan(5);
  });
});

describe('stage set pieces', () => {
  it('孵化爆发: every nest alive opens at once', () => {
    const s = quiet('lab');
    s.setStatOverride('might', 0);
    s.setStatOverride('moveSpeed', 0);
    s.spawn('hatchery', 3, { ring: true, radius: 400 });
    const before = s.world.enemies.items.filter((e) => e.active && e.defId === 'spore').length;
    const idx = stageDef('lab').events.findIndex((e) => e.kind === 'hatchAll');
    expect(idx).toBeGreaterThanOrEqual(0);
    s.triggerEvent(idx);
    const after = s.world.enemies.items.filter((e) => e.active && e.defId === 'spore').length;
    expect(after - before).toBe(3 * (stageDef('lab').events[idx] as { count: number }).count);
  });

  it('陨石带: a breakable rush that crosses the field', () => {
    const s = quiet('orbit');
    s.setStatOverride('might', 0);
    const idx = stageDef('orbit').events.findIndex((e) => e.kind === 'swarm' && e.enemy === 'asteroid');
    expect(idx).toBeGreaterThanOrEqual(0);
    s.triggerEvent(idx);
    const rocks = s.world.enemies.items.filter((e) => e.active && e.defId === 'asteroid');
    expect(rocks.length).toBeGreaterThan(10);
    expect(rocks.every((r) => r.behavior === 'line')).toBe(true);
    const x0 = rocks[0].x;
    s.stepMany(30);
    expect(rocks[0].x).not.toBe(x0);
  });
});

describe('weapons have a voice', () => {
  it('a volley emits one shot event naming the weapon', () => {
    const s = quiet();
    s.setStatOverride('growth', 0);
    s.stepMany(2);
    const buf = s.world.events;
    let shots = 0;
    for (let i = 0; i < buf.length; i++) if (buf.at(i).type === 'shot' && buf.at(i).id === 'plasmaBlade') shots++;
    expect(shots).toBeGreaterThanOrEqual(1);
  });
});
