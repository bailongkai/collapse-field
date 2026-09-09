import { describe, it, expect } from 'vitest';
import { Simulation } from '../../src/core/sim/simulation';
import { PLAYER_BASE_SPEED } from '../../src/config';
import { enemyDef, stageDef } from '../../src/core/content/registry';

const quiet = (seed = 3, extra: { curse?: number } = {}) => {
  const s = new Simulation({ seed, characterId: 'survivor', stageId: 'station', ...extra });
  s.run.god = true;
  s.setStatOverride('growth', 0);
  s.setStatOverride('might', 0);
  return s;
};

describe('late-game pressure', () => {
  it('the hound is the one ordinary enemy faster than the player', () => {
    expect(enemyDef('hound').speed).toBeGreaterThan(PLAYER_BASE_SPEED);
    // and it is in the late rows of every stage that had none
    for (const id of ['station', 'cargo', 'lab']) {
      const late = stageDef(id).waves.filter((w) => w.minute >= 9);
      expect(late.some((w) => w.mix.some((m) => m.enemy === 'hound')), `${id} has no hound after minute nine`).toBe(true);
    }
  });

  it('an encircle puts a line on every side, with gaps', () => {
    const s = quiet();
    s.setStatOverride('curse', -1); // no wave spawns; only the event
    const stage = stageDef('station');
    const idx = stage.events.findIndex((e) => e.kind === 'encircle');
    expect(idx).toBeGreaterThanOrEqual(0);
    const ev = stage.events[idx] as { count: number; gapEvery: number };
    s.triggerEvent(idx);
    const alive = s.world.enemies.aliveList();
    const p = s.world.player;
    const sides = { left: 0, right: 0, top: 0, bottom: 0 };
    for (let i = 0; i < s.world.enemies.count; i++) {
      const e = s.world.enemies.items[alive[i]];
      if (e.behavior !== 'line') continue;
      if (e.dirX > 0.5) sides.left++;
      else if (e.dirX < -0.5) sides.right++;
      else if (e.dirY > 0.5) sides.top++;
      else if (e.dirY < -0.5) sides.bottom++;
      void p;
    }
    const perLine = ev.count - Math.floor(ev.count / ev.gapEvery);
    for (const n of Object.values(sides)) expect(n, `sides ${JSON.stringify(sides)}`).toBe(perLine);
  });

  it('the gap in a line is wider than the player', () => {
    const s = quiet();
    s.setStatOverride('curse', -1);
    const stage = stageDef('station');
    const idx = stage.events.findIndex((e) => e.kind === 'encircle');
    s.triggerEvent(idx);
    const alive = s.world.enemies.aliveList();
    const ys: number[] = [];
    for (let i = 0; i < s.world.enemies.count; i++) {
      const e = s.world.enemies.items[alive[i]];
      if (e.behavior === 'line' && e.dirX > 0.5) ys.push(e.y);
    }
    ys.sort((a, b) => a - b);
    let widest = 0;
    for (let i = 1; i < ys.length; i++) widest = Math.max(widest, ys[i] - ys[i - 1]);
    expect(widest, 'no gap a player could fit through').toBeGreaterThanOrEqual(80);
  });
});

describe('the challenge toggle', () => {
  it('curse raises the field and pays back in experience and gold', () => {
    const plain = quiet(3);
    const cursed = quiet(3, { curse: 0.4 });
    expect(cursed.stats.curse).toBeCloseTo(0.4, 6);
    expect(cursed.stats.growth).toBeCloseTo(plain.stats.growth * 1.4, 6);
    expect(cursed.stats.greed).toBeCloseTo(plain.stats.greed * 1.4, 6);
    expect(cursed.run.curse).toBe(0.4);
    plain.stepMany(60 * 20);
    cursed.stepMany(60 * 20);
    expect(cursed.world.enemies.count).toBeGreaterThan(plain.world.enemies.count);
  });
});

describe('the three passives that only had strings', () => {
  it('exist, and each moves the stat it names', () => {
    const s = quiet();
    const base = { moveSpeed: s.stats.moveSpeed, amount: s.stats.amount, magnet: s.stats.magnet };
    s.givePassive('thrusters', 1);
    s.givePassive('magazine', 1);
    s.givePassive('magnetCore', 1);
    expect(s.stats.moveSpeed).toBeGreaterThan(base.moveSpeed);
    expect(s.stats.amount).toBe(base.amount + 1);
    expect(s.stats.magnet).toBeGreaterThan(base.magnet);
  });
});
