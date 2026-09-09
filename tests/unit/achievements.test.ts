import { describe, it, expect } from 'vitest';
import { MemoryStorage } from '../../src/core/save/memoryStorage';
import { DEFAULT_SAVE, awardAchievements, commitRun, loadSave, lockedItems, type SaveData } from '../../src/core/save/saveData';
import { ACHIEVEMENTS, ACHIEVEMENT_LIST, LOCKED_BY_DEFAULT, conditionMet } from '../../src/data/achievements';
import { Simulation } from '../../src/core/sim/simulation';
import { rollLevelUp } from '../../src/core/levelup/roll';
import { CONTENT } from '../../src/core/content/registry';
import { Rng } from '../../src/core/rng';

const fresh = (): SaveData => ({
  ...DEFAULT_SAVE, settings: { ...DEFAULT_SAVE.settings }, upgrades: {}, unlocks: { characters: [], stages: [], items: [] }, achievements: [], stageBest: {},
});
const facts = (over: Partial<Parameters<typeof conditionMet>[1]> = {}) => ({
  stageId: 'station', characterId: 'survivor', timeSec: 0, kills: 0, level: 1, survived: false, curse: 0, chestsOpened: 0, bossKills: 0,
  items: [], evolved: [], totalRuns: 0, totalKills: 0, ...over,
});

describe('achievement conditions', () => {
  it('each kind reads the fact it names', () => {
    expect(conditionMet({ kind: 'survive', seconds: 300 }, facts({ timeSec: 299 }))).toBe(false);
    expect(conditionMet({ kind: 'survive', seconds: 300 }, facts({ timeSec: 300 }))).toBe(true);
    expect(conditionMet({ kind: 'survive', seconds: 300, stageId: 'cargo' }, facts({ timeSec: 900 }))).toBe(false);
    expect(conditionMet({ kind: 'survive', seconds: 300, characterId: 'marine' }, facts({ timeSec: 900, characterId: 'marine' }))).toBe(true);
    expect(conditionMet({ kind: 'evolve' }, facts({ evolved: ['annihilationBlade'] }))).toBe(true);
    expect(conditionMet({ kind: 'itemLevel', id: 'plasmaBlade', level: 8 }, facts({ items: [{ id: 'plasmaBlade', level: 7 }] }))).toBe(false);
    expect(conditionMet({ kind: 'curse', atLeast: 0.4, survived: true }, facts({ curse: 0.4, survived: false }))).toBe(false);
    expect(conditionMet({ kind: 'curse', atLeast: 0.4, survived: true }, facts({ curse: 0.4, survived: true }))).toBe(true);
    expect(conditionMet({ kind: 'totalKills', count: 10 }, facts({ totalKills: 10 }))).toBe(true);
  });

  it('the three later passives are locked until earned, and by achievements that exist', () => {
    expect([...LOCKED_BY_DEFAULT].sort()).toEqual(['magazine', 'magnetCore', 'thrusters']);
    expect(lockedItems(fresh()).sort()).toEqual(['magazine', 'magnetCore', 'thrusters']);
    for (const id of LOCKED_BY_DEFAULT) expect(ACHIEVEMENT_LIST.some((a) => a.unlocks?.passive === id)).toBe(true);
  });
});

describe('awarding', () => {
  it('a run that qualifies earns once, pays its gold, and opens its item', () => {
    const st = new MemoryStorage();
    let save = fresh();
    const run = { timeSec: 610, kills: 150, gold: 10, stageId: 'station', characterId: 'survivor', survived: false, level: 12 };
    save = commitRun(st, save, run);
    const first = awardAchievements(st, save, run);
    expect(first.earned).toEqual(expect.arrayContaining(['firstBlood', 'fiveMinutes', 'tenMinutes']));
    expect(first.save.unlocks.items).toContain('thrusters');
    expect(first.save.gold).toBe(10 + ACHIEVEMENTS.firstBlood.unlocks.gold + ACHIEVEMENTS.fiveMinutes.unlocks.gold);
    expect(lockedItems(first.save)).not.toContain('thrusters');
    // persisted, and not awarded twice
    expect(loadSave(st).achievements).toContain('tenMinutes');
    const again = awardAchievements(st, first.save, run);
    expect(again.earned).toEqual([]);
  });

  it('cumulative conditions see the run that was just folded in', () => {
    const st = new MemoryStorage();
    let save = { ...fresh(), runsPlayed: 9 };
    const run = { timeSec: 10, kills: 1, gold: 0, stageId: 'station', characterId: 'survivor', survived: false, level: 1 };
    save = commitRun(st, save, run);
    expect(awardAchievements(st, save, run).earned).toContain('veteran');
  });
});

describe('locked items and the offer', () => {
  it('a locked passive is never offered, an unlocked one can be', () => {
    const locked = new Simulation({ seed: 1, characterId: 'survivor', stageId: 'station', lockedItems: ['thrusters', 'magazine', 'magnetCore'] });
    for (let i = 0; i < 60; i++) {
      const picks = rollLevelUp({ weapons: locked.run.weapons, passives: locked.run.passives, luck: 1, rng: new Rng(i), reg: CONTENT, excluded: new Set(locked.run.locked) });
      for (const p of picks) if (p.kind === 'passive') expect(['thrusters', 'magazine', 'magnetCore']).not.toContain(p.id);
    }
    let seen = false;
    for (let i = 0; i < 60 && !seen; i++) {
      const picks = rollLevelUp({ weapons: locked.run.weapons, passives: locked.run.passives, luck: 1, rng: new Rng(i), reg: CONTENT });
      seen = picks.some((p) => p.kind === 'passive' && p.id === 'thrusters');
    }
    expect(seen, 'with nothing locked the thrusters should turn up eventually').toBe(true);
  });
});
