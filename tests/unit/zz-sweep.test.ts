import { it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { Simulation } from '../../src/core/sim/simulation';
const SEEDS = [11, 22, 33, 44, 55, 66, 77, 88, 101, 202, 303, 404, 505, 606, 707, 808];
function run(characterId: string, stageId: string) {
  const s = new Simulation({ seed: 0, characterId, stageId });
  void s;
  return SEEDS.map((seed) => {
    const sim = new Simulation({ seed, characterId, stageId });
    sim.setAutopilot(true);
    let boss5 = false;
    for (let t = 0; t < 960 * 60; t++) {
      if (sim.run.phase === 'levelup') { sim.applyChoice(0); continue; }
      if (!sim.step()) break;
      if (sim.run.chestQueue) sim.run.chestQueue.length = 0;
      if (!boss5 && sim.run.timeMs >= 300_000) boss5 = true;
    }
    return { sec: Math.round(sim.run.timeMs / 1000), lvl: sim.run.level, kills: sim.run.kills, chests: sim.run.chestsOpened, reached5: boss5 };
  });
}
const med = (xs: number[]) => xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const mean = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);
const line = (label: string, rs: ReturnType<typeof run>) =>
  `${label.padEnd(22)} survive mean=${String(mean(rs.map(r => r.sec))).padStart(3)}s min=${String(Math.min(...rs.map(r => r.sec))).padStart(3)} | reached 5:00 ${rs.filter(r => r.reached5).length}/16 | cleared ${rs.filter(r => r.sec >= 900).length}/16 | lvl med=${med(rs.map(r => r.lvl))} | kills med=${med(rs.map(r => r.kills))} | chests med=${med(rs.map(r => r.chests))}`;
it('sweep', () => {
  const out: string[] = ['== stages (survivor) =='];
  for (const st of ['station', 'cargo', 'lab', 'orbit']) out.push(line(st, run('survivor', st)));
  out.push('', '== characters (station) ==');
  for (const c of ['survivor', 'marine', 'engineer', 'unit', 'navigator']) out.push(line(c, run(c, 'station')));
  writeFileSync('/tmp/sweep.txt', out.join('\n'));
}, 1_800_000);
