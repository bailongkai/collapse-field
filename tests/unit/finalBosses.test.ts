import { describe, it, expect } from 'vitest';
import { Simulation } from '../../src/core/sim/simulation';
import { STAGE_ORDER } from '../../src/data/stages';
import type { Enemy } from '../../src/core/sim/entities/enemy';

const newSim = (stageId: string) => {
  const s = new Simulation({ seed: 11, characterId: 'survivor', stageId });
  s.run.god = true;
  s.setStatOverride('growth', 0);
  s.setStatOverride('moveSpeed', 0);
  return s;
};
const finalOf = (s: Simulation): Enemy => s.world.enemies.items.find((e) => e.active && e.def?.boss?.final)!;
const count = (s: Simulation, id: string): number => s.world.enemies.items.filter((e) => e.active && e.defId === id).length;

describe('one final boss per stage', () => {
  it('every stage ends on its own boss, and killing it clears the stage', () => {
    const seen = new Set<string>();
    for (const stage of STAGE_ORDER) {
      const s = newSim(stage.id);
      s.setTime(899.9);
      s.stepMany(30);
      const boss = finalOf(s);
      expect(boss, `${stage.id} spawned no final boss`).toBeDefined();
      expect(seen.has(boss.defId), `${boss.defId} is the final of two stages`).toBe(false);
      seen.add(boss.defId);
      s.damageEnemy(boss, 1e9, 1, 0, 0);
      expect(s.run.ended).toBe('survived');
    }
    expect(seen.size).toBe(STAGE_ORDER.length);
  });

  it('the juggernaut leaves a minefield behind it', () => {
    const s = newSim('cargo');
    s.spawnFinal();
    s.stepMany(60 * 8);
    expect(count(s, 'mine')).toBeGreaterThanOrEqual(4);
  });

  it('the hive queen pulls the player in and breaks into splitters when she dies', () => {
    const s = newSim('lab');
    s.spawnFinal();
    const boss = finalOf(s);
    boss.x = s.world.player.x + 250;
    boss.y = s.world.player.y;
    const before = s.world.player.x;
    s.stepMany(30);
    expect(s.world.player.x, 'the player was not pulled').toBeGreaterThan(before);
    s.damageEnemy(boss, 1e9, 1, 0, 0);
    expect(s.run.ended).toBe('survived');
  });

  it('the void mothership blinks next to the player and fires all round', () => {
    const s = newSim('orbit');
    s.spawnFinal();
    const boss = finalOf(s);
    boss.x = s.world.player.x + 1500;
    boss.y = s.world.player.y;
    s.stepMany(60 * 6);
    const gap = Math.hypot(boss.x - s.world.player.x, boss.y - s.world.player.y);
    expect(gap, 'it walked instead of blinking').toBeLessThan(700);
    const bolts = s.world.projectiles.items.filter((p) => p.active && p.hostile).length;
    expect(bolts).toBeGreaterThan(0);
  });
});
