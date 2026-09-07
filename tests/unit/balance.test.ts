import { describe, it, expect } from 'vitest';
import { Simulation } from '../../src/core/sim/simulation';
import { MIN_CSS_PER_UNIT, REF_AREA, REF_H, REF_W, RUN_SECONDS, logicalSizeFor } from '../../src/config';
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
  gold: number;
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
    gold: s.run.gold,
    reachedEnd: s.run.timeMs >= RUN_SECONDS * 1000,
    build: [...s.run.weapons, ...s.run.passives].map((w) => `${w.id}${w.level}`).join(' '),
  };
}

const SEEDS = [11, 22, 33, 44, 55, 66, 77, 88];
const referenceRuns = SEEDS.map((seed) => playRun(seed));

describe('balance', () => {
  const results = referenceRuns;

  it('reports the curve', () => {
    for (const r of results) {
      console.log(`seed ${r.seed}: ${r.survivedSec}s, level ${r.level}, ${r.kills} kills, ${r.gold} gold, build: ${r.build}`);
    }
    expect(results).toHaveLength(SEEDS.length);
  });

  it('a hands-off run lasts minutes, not seconds: a build does come online', () => {
    // Gates set from a sixteen-seed sweep of the current content: survival 133-243 s (mean 196),
    // level 3-10 (median 6), kills from 37 (median 242). The spread is much wider than it was when
    // every weapon aimed itself, because how well the run goes now depends on whether the player
    // keeps the crowd in the swing; that is the point, so the per-seed floors sit well below the
    // measured minima and the aggregate gates are the sharp ones.
    for (const r of results) {
      expect(r.survivedSec, `seed ${r.seed} ended at ${r.survivedSec}s`).toBeGreaterThan(90);
      expect(r.level, `seed ${r.seed} reached level ${r.level}`).toBeGreaterThanOrEqual(3);
      expect(r.build.split(' ').length, `seed ${r.seed} build: ${r.build}`).toBeGreaterThan(1);
    }
    const mean = results.reduce((n, r) => n + r.survivedSec, 0) / results.length;
    expect(mean, `mean survival ${mean.toFixed(0)}s`).toBeGreaterThan(150);
    const levels = results.map((r) => r.level).sort((a, b) => a - b);
    expect(levels[Math.floor(levels.length / 2)], `median level ${levels[Math.floor(levels.length / 2)]}`).toBeGreaterThanOrEqual(5);
  });

  it('the wave table still closes the run out: nobody coasts to fifteen minutes', () => {
    const cleared = results.filter((r) => r.reachedEnd);
    expect(cleared.map((r) => r.seed), 'a hands-off run cleared the whole stage').toEqual([]);
    // and the difficulty does bite well before the end rather than only at the reaper
    expect(Math.min(...results.map((r) => r.survivedSec))).toBeLessThan(600);
  });

  it('kills scale with the wave table rather than flatlining', () => {
    for (const r of results) expect(r.kills, `seed ${r.seed} got ${r.kills} kills`).toBeGreaterThan(40);
    const kills = results.map((r) => r.kills).sort((a, b) => a - b);
    const median = kills[Math.floor(kills.length / 2)];
    expect(median, `median kills ${median}`).toBeGreaterThan(100);
  });

  it('runs bank gold, so the shop is reachable at all', () => {
    // The end-to-end check on the coin path: drop chance, the ground limit not saturating, pickup
    // magnetism and the run's gold counter all have to work. Per seed it is genuinely allowed to be
    // zero — a short weak run kills too little to drop a coin the player then has to walk over — so
    // the gate is on the sample.
    const withGold = results.filter((r) => r.gold > 0).length;
    const total = results.reduce((n, r) => n + r.gold, 0);
    console.log(`gold: ${withGold}/${results.length} seeds banked, ${total} total`);
    expect(withGold, `only ${withGold}/${results.length} seeds banked any gold`).toBeGreaterThanOrEqual(results.length - 2);
    expect(total, `total gold across ${results.length} runs was ${total}`).toBeGreaterThan(100);
  });
});


/**
 * The logical view is as wide as the display's aspect ratio asks for, so a wide screen shows more
 * of the map. The wave table is authored for the reference view and scaled by visible area, which
 * is what stops a wide screen from quietly becoming an easier game.
 */
describe('view size and wave density', () => {
  const stage = stageDef('station');

  it('the view matches the display shape and never letterboxes', () => {
    const cases: [string, number, number][] = [
      ['desktop 16:9', 1280, 720],
      ['laptop', 1440, 900],
      ['ultrawide', 2560, 1080],
      ['phone landscape', 750, 340],
      ['phone portrait', 390, 844],
      ['tablet portrait', 820, 1180],
    ];
    for (const [name, w, h] of cases) {
      const v = logicalSizeFor(w, h);
      // the logical view has the display's aspect, so the canvas fills it
      expect(v.width / v.height, `${name}: ${v.width}x${v.height}`).toBeCloseTo(w / h, 1);
      // and a logical unit is always worth enough CSS pixels to see and to tap
      expect(w / v.width, `${name}: ${(w / v.width).toFixed(2)} css per unit`).toBeGreaterThanOrEqual(MIN_CSS_PER_UNIT - 0.01);
    }
  });

  it('the reference display gets exactly the reference view', () => {
    expect(logicalSizeFor(REF_W, REF_H)).toEqual({ width: REF_W, height: REF_H });
  });

  it('no display sees more of the map than the reference', () => {
    for (const [w, h] of [[2560, 1080], [3840, 2160], [1920, 1080], [390, 844], [750, 340]]) {
      const v = logicalSizeFor(w, h);
      expect(v.width * v.height, `${w}x${h} -> ${v.width}x${v.height}`).toBeLessThanOrEqual(REF_AREA * 1.02);
    }
  });

  it('a portrait phone gets a portrait view, not a squeezed landscape one', () => {
    const v = logicalSizeFor(390, 844);
    expect(v.height).toBeGreaterThan(v.width);
    expect(v.width).toBeGreaterThan(400); // wide enough to fight in
  });

  it('density is one at the reference view and follows the visible area', () => {
    expect(densityScale(REF_W, REF_H)).toBe(1);
    const portrait = logicalSizeFor(390, 844);
    expect(densityScale(portrait.width, portrait.height)).toBeCloseTo((portrait.width * portrait.height) / REF_AREA, 6);
  });

  it('the spawn ring always sits outside the view, whatever its shape', () => {
    for (const [w, h] of [[REF_W, REF_H], [1041, 472], [542, 1172]]) {
      const ring = spawnRingRadius(stage, w, h);
      expect(ring, `${w}x${h}`).toBeGreaterThan(Math.hypot(w / 2, h / 2));
    }
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
    const wide = measure(1760);
    const ratio = wide / narrow;
    const expected = 1760 / REF_W;
    expect(ratio, `narrow ${narrow}, wide ${wide}`).toBeGreaterThan(expected * 0.75);
    expect(ratio, `narrow ${narrow}, wide ${wide}`).toBeLessThan(expected * 1.25);
  });

  it('a hands-off run on a wide view lasts about as long as on the reference view', () => {
    const wide = SEEDS.map((seed) => playRun(seed, 1760, REF_H));
    // recorded so a wave-table change that only breaks wide screens is visible in the output
    for (const r of wide) {
      console.log(`wide seed ${r.seed}: ${r.survivedSec}s, level ${r.level}, ${r.kills} kills`);
    }
    // A floor low enough that only a broken wide view trips it. Per-seed survival swings widely
    // now that aiming is the player's job, so the distribution below is what this test is really
    // about; a single unlucky seed is not evidence that wide screens are broken.
    for (const r of wide) {
      expect(r.survivedSec, `wide seed ${r.seed} ended at ${r.survivedSec}s`).toBeGreaterThan(60);
      expect(r.level, `wide seed ${r.seed} reached level ${r.level}`).toBeGreaterThanOrEqual(3);
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
    // and a wide view must not quietly hand out a bigger build either
    const med = (rs: RunResult[]): number => rs.map((r) => r.level).sort((a, b) => a - b)[Math.floor(rs.length / 2)];
    expect(med(wide), `reference level ${med(referenceRuns)} vs wide ${med(wide)}`).toBeLessThanOrEqual(med(referenceRuns) + 3);
  });
});
