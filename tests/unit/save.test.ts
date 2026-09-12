import { describe, it, expect } from 'vitest';
import { MemoryStorage } from '../../src/core/save/memoryStorage';
import { DEFAULT_SAVE, commitRun, loadSave, writeSave, type SaveData } from '../../src/core/save/saveData';
import { buyCharacter, isCharacterUnlocked, isStageUnlocked, stageUnlockedBySurviving } from '../../src/core/save/unlocks';
import { STAGE_ORDER } from '../../src/data/stages';

const fresh = (gold = 0): SaveData => ({
  ...DEFAULT_SAVE, settings: { ...DEFAULT_SAVE.settings }, upgrades: {}, unlocks: { characters: [], stages: [], items: [] }, achievements: [], stageBest: {}, gold,
});

describe('save migration', () => {
  it('reads a version 1 save and keeps everything it had', () => {
    const st = new MemoryStorage();
    st.write(JSON.stringify({ version: 1, gold: 320, runsPlayed: 7, bestTimeSec: 512, bestKills: 900, settings: { locale: 'en', sfxVolume: 0.3, musicVolume: 0.1 }, upgrades: { hull: 2 } }));
    const s = loadSave(st);
    expect(s.version).toBe(2);
    expect(s.gold).toBe(320);
    expect(s.runsPlayed).toBe(7);
    expect(s.upgrades.hull).toBe(2);
    expect(s.settings.locale).toBe('en');
    // the new fields take their defaults: nothing bought, only the first stage open
    expect(s.unlocks).toEqual({ characters: [], stages: [], items: [] });
    expect(isStageUnlocked(s, 'station')).toBe(true);
    expect(isStageUnlocked(s, 'cargo')).toBe(false);
  });

  it('refuses a save from a future version rather than half-reading it', () => {
    const st = new MemoryStorage();
    st.write(JSON.stringify({ version: 3, gold: 999 }));
    expect(loadSave(st).gold).toBe(0);
  });

  it('round-trips unlocks and dedupes them', () => {
    const st = new MemoryStorage();
    writeSave(st, { ...fresh(), unlocks: { characters: ['marine', 'marine'], stages: ['station'], items: [] }, stageBest: { station: 900, bogus: -1 } });
    const s = loadSave(st);
    expect(s.unlocks.characters).toEqual(['marine']);
    expect(s.stageBest).toEqual({ station: 900 });
  });
});

describe('stage progression', () => {
  it('surviving a stage opens the next one, dying does not', () => {
    const st = new MemoryStorage();
    let s = fresh();
    expect(stageUnlockedBySurviving(s, 'station')).toBe('cargo');
    s = commitRun(st, s, { timeSec: 400, kills: 10, gold: 5, stageId: 'station', survived: false });
    expect(isStageUnlocked(s, 'cargo')).toBe(false);
    s = commitRun(st, s, { timeSec: 900, kills: 10, gold: 5, stageId: 'station', survived: true });
    expect(isStageUnlocked(s, 'cargo')).toBe(true);
    expect(isStageUnlocked(s, 'lab')).toBe(false);
    expect(stageUnlockedBySurviving(s, 'station'), 'already open, nothing new to announce').toBeNull();
    expect(s.stageBest.station).toBe(900);
    expect(s.lastStageId).toBe('station');
  });

  it('the campaign is a single chain in order', () => {
    expect(STAGE_ORDER.map((s) => s.order)).toEqual(STAGE_ORDER.map((_, i) => i));
    const last = STAGE_ORDER[STAGE_ORDER.length - 1];
    expect(stageUnlockedBySurviving(fresh(), last.id)).toBeNull();
  });
});

describe('buying characters', () => {
  it('the free character is always playable and the priced ones are not until bought', () => {
    const s = fresh(10_000);
    expect(isCharacterUnlocked(s, 'survivor')).toBe(true);
    expect(isCharacterUnlocked(s, 'marine')).toBe(false);
    const st = new MemoryStorage();
    const r = buyCharacter(st, s, 'marine');
    expect(r.result).toBe('bought');
    expect(r.save.gold).toBe(10_000 - 600);
    expect(isCharacterUnlocked(r.save, 'marine')).toBe(true);
    expect(isCharacterUnlocked(loadSave(st), 'marine'), 'the purchase must persist').toBe(true);
  });

  it('refuses when poor, owned or unknown', () => {
    const st = new MemoryStorage();
    expect(buyCharacter(st, fresh(10), 'marine').result).toBe('poor');
    expect(buyCharacter(st, fresh(10), 'survivor').result).toBe('owned');
    expect(buyCharacter(st, fresh(9999), 'nobody').result).toBe('unknown');
  });
});
