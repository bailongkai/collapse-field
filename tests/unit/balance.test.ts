import { describe, it, expect } from 'vitest';
import { Simulation } from '../../src/core/sim/simulation';
import { MAX_VIEW_W, MIN_VIEW_W, REF_H, REF_W, RUN_SECONDS, logicalWidthFor } from '../../src/config';
import { densityScale, spawnRingRadius } from '../../src/core/sim/systems/spawnSystem';
import { stageDef } from '../../src/core/content/registry';

/**
 * Balance harness. Plays whole hands-off runs where the player kites with a simple policy and
 * always takes the first offered upgrade, then checks the shape of the difficulty curve. It is a
 * coarse sanity gate, not a judgement on feel: runs that end in the first minutes mean no build can
 * come online, and runs that always reach the end mean the wave table asks nothing of the player.
 */
interface RunResult {
  seed: number;
  survivedSec: number;
  level: number;
  kills: number;
  reachedEnd: boolean;
  build: string;
}

function playRun(seed: number, viewW = REF_W, viewH = REF_H): RunResult {
  const s = new Simulation({ seed, characterId: 'survivor', stageId: 'station', viewW, viewH });
  s.setAutopilot(true);
  const maxTicks = (RUN_SECONDS + 60) * 60;
  for (let tick = 0; tick < maxTicks; tick++) {
    if (s.run.phase === 'levelup') {
      s.applyChoice(0);
      continue;
    }
    if (!s.step()) break;
  }
  return {
    seed,
    survivedSec: Math.round(s.run.timeMs / 1000),
    level: s.run.level,
    kills: s.run.kills,
    reachedEnd: s.run.timeMs >= RUN_SECONDS * 1000,
    build: [...s.run.weapons, ...s.run.passives].map((w) => `${w.id}${w.level}`).join(' '),
  };
}

const SEEDS = [11, 22, 33, 44, 55, 66];
const referenceRuns = SEEDS.map((seed) => playRun(seed));

describe('balance', () => {
  const results = referenceRuns;

  it('reports the curve', () => {
    for (const r of results) {
      console.log(`seed ${r.seed}: ${r.survivedSec}s, level ${r.level}, ${r.kills} kills, build: ${r.build}`);
    }
    expect(results).toHaveLength(SEEDS.length);
  });

  it('a hands-off run lasts minutes, not seconds: a build does come online', () => {
    // the floors reflect the measured spread: across sixteen seeds the shortest run of the
    // close-range autopilot is about 160 s and the lowest level 4, so tighter gates would fail on
    // ordinary variance rather than on a regression
    for (const r of results) {
      expect(r.survivedSec, `seed ${r.seed} ended at ${r.survivedSec}s`).toBeGreaterThan(120);
      expect(r.level, `seed ${r.seed} reached level ${r.level}`).toBeGreaterThan(3);
      expect(r.build.split(' ').length, `seed ${r.seed} build: ${r.build}`).toBeGreaterThan(1);
    }
    const mean = results.reduce((n, r) => n + r.survivedSec, 0) / results.length;
    expect(mean, `mean survival ${mean.toFixed(0)}s`).toBeGreaterThan(200);
  });

  it('the wave table still closes the run out: nobody coasts to fifteen minutes', () => {
    const cleared = results.filter((r) => r.reachedEnd);
    expect(cleared.map((r) => r.seed), 'a hands-off run cleared the whole stage').toEqual([]);
    // and the difficulty does bite well before the end rather than only at the reaper
    expect(Math.min(...results.map((r) => r.survivedSec))).toBeLessThan(600);
  });

  it('kills scale with the wave table rather than flatlining', () => {
    for (const r of results) expect(r.kills, `seed ${r.seed} got ${r.kills} kills`).toBeGreaterThan(60);
  });
});


/**
 * The logical view is as wide as the display's aspect ratio asks for, so a wide screen shows more
 * of the map. The wave table is authored for the reference view and scaled by visible area, which
 * is what stops a wide screen from quietly becoming an easier game.
 */
describe('view size and wave density', () => {
  const stage = stageDef('station');

  it('the logical width follows the aspect ratio inside its bounds', () => {
    expect(logicalWidthFor(16 / 9)).toBe(REF_W);
    expect(logicalWidthFor(2.4)).toBe(1728); // a 20:9 phone, wider than the reference and uncapped
    expect(logicalWidthFor(32 / 9)).toBe(MAX_VIEW_W); // an ultrawide monitor is capped
    expect(logicalWidthFor(4 / 3)).toBe(MIN_VIEW_W); // and a squarer window is floored
    expect(logicalWidthFor(21 / 9)).toBeLessThanOrEqual(MAX_VIEW_W);
  });

  it('density is one at the reference view and grows with the visible area', () => {
    expect(densityScale(REF_W, REF_H)).toBe(1);
    expect(densityScale(MAX_VIEW_W, REF_H)).toBeCloseTo(MAX_VIEW_W / REF_W, 6);
  });

  it('a wider view pushes the spawn ring out, so enemies still arrive off screen', () => {
    const wide = spawnRingRadius(stage, MAX_VIEW_W, REF_H);
    expect(wide).toBeGreaterThan(spawnRingRadius(stage, REF_W, REF_H));
    expect(wide).toBeGreaterThan(MAX_VIEW_W / 2);
  });

  it('a wide view holds proportionally more enemies, keeping the crowd per screen the same', () => {
    const measure = (viewW: number): number => {
      const s = new Simulation({ seed: 5, characterId: 'survivor', stageId: 'station', viewW, viewH: REF_H });
      s.run.god = true;
      s.setStatOverride('growth', 0);
      s.setTime(240);
      s.stepMany(60 * 45);
      return s.world.enemies.count;
    };
    const narrow = measure(REF_W);
    const wide = measure(MAX_VIEW_W);
    const ratio = wide / narrow;
    const expected = MAX_VIEW_W / REF_W;
    expect(ratio, `narrow ${narrow}, wide ${wide}`).toBeGreaterThan(expected * 0.75);
    expect(ratio, `narrow ${narrow}, wide ${wide}`).toBeLessThan(expected * 1.25);
  });

  it('a hands-off run on a wide view lasts about as long as on the reference view', () => {
    const wide = SEEDS.map((seed) => playRun(seed, MAX_VIEW_W, REF_H));
    // recorded so a wave-table change that only breaks wide screens is visible in the output
    for (const r of wide) {
      console.log(`wide seed ${r.seed}: ${r.survivedSec}s, level ${r.level}, ${r.kills} kills`);
    }
    // the same gates the reference view has to pass
    for (const r of wide) {
      expect(r.survivedSec, `wide seed ${r.seed} ended at ${r.survivedSec}s`).toBeGreaterThan(120);
      expect(r.level).toBeGreaterThan(3);
    }
    expect(wide.filter((r) => r.reachedEnd), 'a wide view must not hand the player the whole run').toEqual([]);

    // and the difficulty must land near the reference. Three seeds are too few to calibrate with
    // (see densityScale for the sixteen-seed measurement), so this gate is deliberately loose: it
    // catches a view size that changes the game, not the noise between seeds.
    const avg = (rs: RunResult[]): number => rs.reduce((n, r) => n + r.survivedSec, 0) / rs.length;
    const refAvg = avg(referenceRuns);
    const wideAvg = avg(wide);
    console.log(`average survival: reference ${refAvg.toFixed(0)}s, wide ${wideAvg.toFixed(0)}s`);
    expect(wideAvg, `reference ${refAvg.toFixed(0)}s vs wide ${wideAvg.toFixed(0)}s`).toBeLessThan(refAvg * 1.8);
    expect(wideAvg, `reference ${refAvg.toFixed(0)}s vs wide ${wideAvg.toFixed(0)}s`).toBeGreaterThan(refAvg * 0.5);
  });
});
