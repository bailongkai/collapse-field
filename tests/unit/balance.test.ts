import { describe, it, expect } from 'vitest';
import { Simulation } from '../../src/core/sim/simulation';
import { RUN_SECONDS } from '../../src/config';

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

function playRun(seed: number): RunResult {
  const s = new Simulation({ seed, characterId: 'survivor', stageId: 'station' });
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

describe('balance', () => {
  const seeds = [11, 22, 33];
  const results = seeds.map(playRun);

  it('reports the curve', () => {
    for (const r of results) {
      console.log(`seed ${r.seed}: ${r.survivedSec}s, level ${r.level}, ${r.kills} kills, build: ${r.build}`);
    }
    expect(results).toHaveLength(3);
  });

  it('a hands-off run lasts minutes, not seconds: a build does come online', () => {
    for (const r of results) {
      expect(r.survivedSec, `seed ${r.seed} ended at ${r.survivedSec}s`).toBeGreaterThan(300);
      expect(r.level, `seed ${r.seed} reached level ${r.level}`).toBeGreaterThan(4);
      expect(r.build.split(' ').length, `seed ${r.seed} build: ${r.build}`).toBeGreaterThan(2);
    }
  });

  it('the wave table still closes the run out: nobody coasts to fifteen minutes', () => {
    const cleared = results.filter((r) => r.reachedEnd);
    expect(cleared.map((r) => r.seed), 'a hands-off run cleared the whole stage').toEqual([]);
    // and the difficulty does bite well before the end rather than only at the reaper
    expect(Math.min(...results.map((r) => r.survivedSec))).toBeLessThan(780);
  });

  it('kills scale with the wave table rather than flatlining', () => {
    for (const r of results) expect(r.kills, `seed ${r.seed} got ${r.kills} kills`).toBeGreaterThan(150);
  });
});
