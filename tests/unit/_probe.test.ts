import { describe, it, expect } from 'vitest';
import { Simulation } from '../../src/core/sim/simulation';
import { RUN_SECONDS } from '../../src/config';

const SEEDS = [11, 22, 33, 44, 55, 66, 77, 88, 123, 456, 789, 1011, 1313, 1717, 1919, 2323];

interface R { seed: number; sec: number; level: number; chests: number; bossKills: number; end: boolean; evo: number }

// variant: 0 = today, 1 = chest magnet 320, 2 = magnet + 6 scheduled chests + ~3 lvl each
function play(seed: number, variant: number): R {
  const s = new Simulation({ seed, characterId: 'survivor', stageId: 'station' });
  s.setAutopilot(true);
  let chests = 0, bossKills = 0, evo = 0;
  const schedule = [150, 300, 450, 600, 720, 840];
  let next = 0;
  const maxTicks = (RUN_SECONDS + 60) * 60;
  for (let tick = 0; tick < maxTicks; tick++) {
    if (s.run.phase === 'levelup') { s.applyChoice(0); continue; }
    if (variant >= 2) {
      const sec = s.run.timeMs / 1000;
      while (next < schedule.length && sec >= schedule[next]) {
        s.spawnPickup('chest', s.world.player.x + 40, s.world.player.y);
        next++;
      }
    }
    if (variant >= 1) {
      // simulate a 320-unit magnet on chests
      const alive = s.world.pickups.aliveList();
      for (let i = 0; i < s.world.pickups.count; i++) {
        const p = s.world.pickups.items[alive[i]];
        if (p.defId !== 'chest') continue;
        const dx = s.world.player.x - p.x, dy = s.world.player.y - p.y;
        const d = Math.hypot(dx, dy);
        if (d < 320 && d > 1) { p.x += (dx / d) * 7; p.y += (dy / d) * 7; }
      }
    }
    if (!s.step()) break;
    const buf = s.world.events;
    for (let i = 0; i < buf.length; i++) {
      const e = buf.at(i);
      if (e.type === 'chest') chests++;
      if (e.type === 'bossKilled') bossKills++;
      if (e.type === 'evolve') evo++;
    }
    buf.clear();
  }
  return { seed, sec: Math.round(s.run.timeMs / 1000), level: s.run.level, chests, bossKills, end: s.run.timeMs >= RUN_SECONDS * 1000, evo };
}

describe('probe', () => {
  it('measures', () => {
    for (const v of [0, 1, 2]) {
      const rs = SEEDS.map((sd) => play(sd, v));
      const mean = rs.reduce((n, r) => n + r.sec, 0) / rs.length;
      const cleared = rs.filter((r) => r.end);
      console.log(`variant ${v}: mean ${mean.toFixed(0)}s cleared ${cleared.length}/${rs.length} [${cleared.map((r) => r.seed).join(',')}] chests ${(rs.reduce((n, r) => n + r.chests, 0) / rs.length).toFixed(2)} bossKills ${(rs.reduce((n, r) => n + r.bossKills, 0) / rs.length).toFixed(2)} evo ${rs.reduce((n, r) => n + r.evo, 0)} minSec ${Math.min(...rs.map((r) => r.sec))}`);
      console.log(`   first8 cleared ${rs.slice(0, 8).filter((r) => r.end).length}/8, secs ${rs.slice(0, 8).map((r) => r.sec).join(' ')}`);
    }
    expect(true).toBe(true);
  }, 900000);
});
