import { describe, it, expect } from 'vitest';
import { Simulation } from '../../src/core/sim/simulation';
import { armBossCheck, bossCheckChest, bossIntake, bossTargetSeconds } from '../../src/core/enemies/bossScale';
import { BOSS_SCALING } from '../../src/data/bossScaling';
import { createEnemy, type Enemy } from '../../src/core/sim/entities/enemy';
import { enemyDef } from '../../src/core/content/registry';

/**
 * A boss lasts as long as it is meant to. The level rule capped out by level sixty and a
 * human-like build killed twenty-two of twenty-four bosses inside twenty-five seconds; a boss now
 * measures what it is actually taking and, only ever upwards, settles its health so that rate
 * takes its target to finish it.
 */
const body = (hp: number): Enemy => {
  const e = createEnemy(0);
  e.active = true;
  e.hp = e.maxHp = hp;
  return e;
};

describe('the boss checks its health against its intake', () => {
  it('targets 25, 40 and 60 seconds for the three fights', () => {
    expect(bossTargetSeconds('boss', 300)).toBe(25);
    expect(bossTargetSeconds('boss', 600)).toBe(40);
    expect(bossTargetSeconds('final', 900)).toBe(60);
  });

  it('a build that would finish it early meets health for the rest of the target, the bar unmoved', () => {
    const e = body(1000);
    armBossCheck(e, 'boss', 300, 1000);
    // 100 a second for four seconds: 400 dealt by the end of the first window
    let factor = 1;
    for (let t = 0; t <= 4000; t += 250) {
      e.hp -= 25;
      factor = bossIntake(e, 25, t);
      if (factor > 1) break;
    }
    expect(factor).toBeGreaterThan(1);
    // the window settles early once it has taken a quarter of the bar: what is left of 25 s at
    // the rate it measured, and the fraction shown on the bar is the same before and after
    const rate = 25 / 0.25; // per second
    expect(e.maxHp * (e.hp / e.maxHp)).toBeCloseTo(e.hp, 6);
    expect(e.hp).toBeGreaterThan(rate * 20);
    expect(e.hp / e.maxHp).toBeCloseTo(0.75 - 0.025, 1);
  });

  it('a build that would take longer than the target leaves the fight as written', () => {
    const e = body(1000);
    armBossCheck(e, 'boss', 300, 1000);
    for (let t = 0; t <= 13000; t += 500) expect(bossIntake(e, 5, t)).toBe(1);
    expect(e.maxHp).toBe(1000);
  });

  it('never past the cap, and the check ends half way through the target', () => {
    const e = body(100);
    armBossCheck(e, 'final', 900, 100);
    e.hp -= 1e6;
    e.hp = 50;
    bossIntake(e, 1e6, 1500);
    expect(e.maxHp).toBeLessThanOrEqual(100 * BOSS_SCALING.dpsCap + 1e-6);
    const f = body(1000);
    armBossCheck(f, 'boss', 300, 1000);
    bossIntake(f, 1, 0);
    bossIntake(f, 1, 13000);
    expect(f.scaleTargetMs).toBe(0);
    expect(bossIntake(f, 900, 14000)).toBe(1);
  });

  it('a chest before the first settlement throws away the straddling window; after it, ends the check', () => {
    const e = body(1000);
    armBossCheck(e, 'boss', 300, 1000);
    bossIntake(e, 10, 0);
    bossIntake(e, 10, 2000);
    bossCheckChest(e, 2500);
    expect(e.intakeDealt).toBe(0);
    expect(e.intakeMarkMs).toBe(2500);
    expect(e.scaleTargetMs).toBeGreaterThan(0);
    bossIntake(e, 10, 6600); // the first settlement
    bossCheckChest(e, 7000);
    expect(e.scaleTargetMs).toBe(0);
  });
});

describe('in the simulation', () => {
  const quiet = () => {
    const s = new Simulation({ seed: 5, characterId: 'survivor', stageId: 'station' });
    s.world.enemies.clear();
    s.run.god = true;
    s.setStatOverride('growth', 0);
    s.setStatOverride('curse', -1);
    return s;
  };

  it('a strong build meets the mothership at about 25 seconds instead of a few', () => {
    const s = quiet();
    s.setStatOverride('might', 6);
    s.setTime(299);
    s.stepMany(70);
    const boss = s.world.enemies.items.find((e) => e.active && e.def?.bossBar)!;
    expect(boss.maxHp).toBe(enemyDef('mothership').hp);
    // bring it to the blade
    boss.x = s.world.player.x + 90;
    boss.y = s.world.player.y;
    boss.speedMult = 0;
    let killedAt = -1;
    let scaled = false;
    const start = s.run.timeMs;
    for (let t = 0; t < 60 * 90 && killedAt < 0; t++) {
      s.step();
      for (let i = 0; i < s.world.events.length; i++) {
        const ev = s.world.events.at(i);
        if (ev.type === 'bossScaled') scaled = true;
        if (ev.type === 'bossKilled') killedAt = s.run.timeMs;
      }
      s.world.events.clear();
    }
    expect(scaled).toBe(true);
    const seconds = (killedAt - start) / 1000;
    expect(seconds).toBeGreaterThan(18);
    expect(seconds).toBeLessThan(34);
  });

  it('a newcomer meets the boss as authored', () => {
    const s = quiet();
    s.setTime(290);
    s.stepMany(60 * 11);
    const boss = s.world.enemies.items.find((e) => e.active && e.def?.bossBar)!;
    expect(boss.maxHp).toBe(enemyDef('mothership').hp);
    expect(boss.scaleTargetMs).toBe(25000);
  });
});
