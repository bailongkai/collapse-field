import { describe, it, expect } from 'vitest';
import { runScore, shortScore } from '../../src/core/save/score';
import { SCORE_WEIGHTS } from '../../src/data/score';
import { DEFAULT_SAVE, commitRun, loadSave } from '../../src/core/save/saveData';
import { MemoryStorage } from '../../src/core/save/memoryStorage';

const base = { timeSec: 300, kills: 500, level: 15, bossKills: 1, survived: false, curse: 0 };

describe('the end-of-run score', () => {
  it('is the stated sum', () => {
    const w = SCORE_WEIGHTS;
    expect(runScore(base)).toBe(300 * w.perSecond + 500 * w.perKill + 15 * w.perLevel + 1 * w.perBoss);
    expect(runScore({ ...base, survived: true }) - runScore(base)).toBe(w.clear);
  });

  it('scales with the challenge, never below zero, and ignores fractions of a second', () => {
    expect(runScore({ ...base, curse: 0.4 })).toBe(Math.round(runScore(base) * 1.4));
    expect(runScore({ ...base, timeSec: 300.9 })).toBe(runScore(base));
    expect(runScore({ timeSec: 0, kills: 0, level: 0, bossKills: 0, survived: false, curse: 0 })).toBe(0);
  });

  it('a tile shows it short', () => {
    expect(shortScore(9876)).toBe('9876');
    expect(shortScore(12345)).toBe('12.3k');
  });
});

describe('the best score per stage', () => {
  it('is kept per stage and only ever rises', () => {
    const st = new MemoryStorage();
    let save = commitRun(st, loadSave(st), { ...base, gold: 0, stageId: 'station' });
    const first = save.stageBestScore.station;
    expect(first).toBe(runScore(base));
    save = commitRun(st, save, { ...base, timeSec: 60, gold: 0, stageId: 'station' });
    expect(save.stageBestScore.station).toBe(first);
    save = commitRun(st, save, { ...base, timeSec: 900, survived: true, bossKills: 3, gold: 0, stageId: 'station' });
    expect(save.stageBestScore.station).toBeGreaterThan(first);
    expect(save.stageBestScore.cargo).toBeUndefined();
    expect(loadSave(st).stageBestScore.station).toBe(save.stageBestScore.station);
  });

  it('a version-2 save without it loads with no bests', () => {
    const st = new MemoryStorage();
    const old = { ...DEFAULT_SAVE, gold: 77 } as Record<string, unknown>;
    delete old.stageBestScore;
    st.write(JSON.stringify(old));
    const loaded = loadSave(st);
    expect(loaded.stageBestScore).toEqual({});
    expect(loaded.gold).toBe(77);
    expect(loaded.version).toBe(2);
  });
});
