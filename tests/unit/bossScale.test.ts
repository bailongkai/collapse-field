import { describe, it, expect } from 'vitest';
import { Simulation } from '../../src/core/sim/simulation';
import { bossLevelScale, authoredLevel } from '../../src/core/enemies/bossScale';
import { BOSS_SCALING } from '../../src/data/bossScaling';
import { STAGE_ORDER } from '../../src/data/stages';
import { enemyDef } from '../../src/core/content/registry';

const bossAt = (stageId: string, sec: number, level: number) => {
  const s = new Simulation({ seed: 5, characterId: 'survivor', stageId });
  s.run.god = true;
  s.setStatOverride('growth', 0);
  s.setLevel(level);
  s.setTime(sec - 0.1);
  s.stepMany(30);
  return s.world.enemies.items.find((e) => e.active && e.def?.bossBar)!;
};

describe('a boss is as hard as the build that meets it', () => {
  it('a build at the level the fight was authored for meets the authored fight', () => {
    for (const at of [300, 600, 900]) {
      const level = Math.floor(authoredLevel(at));
      expect(bossLevelScale('boss', at, level)).toBe(1);
      expect(bossLevelScale('final', at, level)).toBe(1);
      expect(bossLevelScale('boss', at, 1)).toBe(1);
    }
  });

  it('grows with every level above that, and stops at the cap', () => {
    expect(bossLevelScale('boss', 300, 20)).toBeGreaterThan(bossLevelScale('boss', 300, 12));
    expect(bossLevelScale('boss', 600, 60)).toBe(BOSS_SCALING.cap.boss);
    expect(bossLevelScale('final', 900, 500)).toBe(BOSS_SCALING.cap.final);
    // the build from the report: level 30, 60 and 89 at the three bosses
    expect(bossLevelScale('boss', 300, 30)).toBeGreaterThan(3);
    expect(bossLevelScale('final', 900, 89)).toBeGreaterThan(3);
    // and one half as far along is scaled about half as much, not the same
    expect(bossLevelScale('final', 900, 52)).toBeLessThan(2.2);
  });

  it('the final boss is capped below the others, because it enrages', () => {
    expect(BOSS_SCALING.cap.final).toBeLessThan(BOSS_SCALING.cap.boss);
  });

  it('every boss of every stage arrives with the scaled health', () => {
    for (const stage of STAGE_ORDER) {
      for (const event of stage.events) {
        if (event.kind !== 'boss' && event.kind !== 'final') continue;
        const authored = enemyDef(event.enemy).hp * event.hpMult;
        const low = bossAt(stage.id, event.at, 1);
        expect(low.defId).toBe(event.enemy);
        expect(low.maxHp, `${stage.id} ${event.enemy} at level 1`).toBeCloseTo(authored, 5);
        const high = bossAt(stage.id, event.at, 400);
        expect(high.maxHp, `${stage.id} ${event.enemy} at level 400`).toBeCloseTo(authored * BOSS_SCALING.cap[event.kind], 5);
        expect(high.hp).toBe(high.maxHp);
      }
    }
  });
});
