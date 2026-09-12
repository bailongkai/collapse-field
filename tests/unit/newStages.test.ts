import { describe, it, expect } from 'vitest';
import { Simulation } from '../../src/core/sim/simulation';
import { STAGE_ORDER, STAGES } from '../../src/data/stages';
import { CONTENT } from '../../src/core/content/registry';

const NEW = ['reactor', 'derelict', 'foundry', 'singularity'] as const;

describe('the four new stages', () => {
  it('extend the campaign chain without renumbering it', () => {
    expect(STAGE_ORDER.map((s) => s.id)).toEqual(['station', 'cargo', 'lab', 'orbit', ...NEW]);
    STAGE_ORDER.forEach((s, i) => expect(s.order, s.id).toBe(i));
  });

  it('each ends on its own final boss, and no boss is shared with another stage', () => {
    const finals = new Set<string>();
    const mids = new Set<string>();
    for (const s of STAGE_ORDER) {
      for (const e of s.events) {
        if (e.kind === 'final') {
          expect(finals.has(e.enemy), `${e.enemy} is the final of two stages`).toBe(false);
          finals.add(e.enemy);
          expect(CONTENT.enemies[e.enemy]?.boss?.final, `${e.enemy} has no final config`).toBeTruthy();
        }
        if (e.kind === 'boss') {
          expect(mids.has(e.enemy), `${e.enemy} is a mid boss on two stages`).toBe(false);
          mids.add(e.enemy);
        }
      }
    }
    expect(finals.size).toBe(STAGE_ORDER.length);
    expect(mids.size).toBe(STAGE_ORDER.length * 2);
  });

  it('every new stage brings attack patterns the earlier ones never used', () => {
    const before = new Set<string>();
    for (const id of ['station', 'cargo', 'lab', 'orbit']) {
      for (const w of STAGES[id as 'station'].waves) for (const m of w.mix) before.add(CONTENT.enemies[m.enemy]!.behavior);
    }
    for (const id of NEW) {
      const mine = new Set<string>();
      for (const w of STAGES[id].waves) for (const m of w.mix) mine.add(CONTENT.enemies[m.enemy]!.behavior);
      const fresh = [...mine].filter((b) => !before.has(b));
      expect(fresh.length, `${id} fields only behaviours the first four stages already had`).toBeGreaterThanOrEqual(1);
    }
  });

  it('each runs a full fifteen minutes headless without throwing or stalling', () => {
    for (const id of NEW) {
      const s = new Simulation({ seed: 12, characterId: 'survivor', stageId: id });
      s.run.god = true;
      for (let i = 0; i < 200 && s.run.timeMs < 900_000; i++) {
        s.stepMany(60 * 16);
        // two offers can be pending at once, and a chest queue can hold several: drain both or the
        // clock stops and the loop spends its iterations on a frozen run
        while (s.run.phase === 'levelup' && s.applyChoice(0));
        while (s.takeChestResult());
      }
      expect(s.run.timeMs, `${id} did not reach the end`).toBeGreaterThanOrEqual(900_000);
      expect(s.run.finalSpawned, `${id} never brought its final boss`).toBe(true);
      expect(s.run.kills, `${id} killed nothing`).toBeGreaterThan(100);
    }
  });

  it('a full run of every new stage stays inside the entity budget', () => {
    for (const id of NEW) {
      const s = new Simulation({ seed: 5, characterId: 'marine', stageId: id });
      s.run.god = true;
      let peak = 0;
      for (let i = 0; i < 200 && s.run.timeMs < 900_000; i++) {
        s.stepMany(60 * 16);
        while (s.run.phase === 'levelup' && s.applyChoice(0));
        while (s.takeChestResult());
        peak = Math.max(peak, s.world.enemies.count);
      }
      expect(peak, `${id} peaked at ${peak} bodies`).toBeLessThan(900);
    }
  });
});
