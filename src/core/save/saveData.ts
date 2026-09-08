export interface SaveData {
  version: 2;
  gold: number;
  runsPlayed: number;
  bestTimeSec: number;
  bestKills: number;
  settings: { locale: 'zh-CN' | 'en'; sfxVolume: number; musicVolume: number };
  /** permanent upgrade levels by id */
  upgrades: Record<string, number>;
  /** what gold and clears have opened. Stages listed here have been SURVIVED, which opens the next. */
  unlocks: { characters: string[]; stages: string[] };
  /** best survival time per stage id, seconds */
  stageBest: Record<string, number>;
  /** what the launch screen last had selected */
  lastCharacterId: string;
  lastStageId: string;
}

export const DEFAULT_SAVE: SaveData = {
  version: 2,
  gold: 0,
  runsPlayed: 0,
  bestTimeSec: 0,
  bestKills: 0,
  settings: { locale: 'zh-CN', sfxVolume: 0.8, musicVolume: 0.5 },
  upgrades: {},
  unlocks: { characters: [], stages: [] },
  stageBest: {},
  lastCharacterId: 'survivor',
  lastStageId: 'station',
};

export interface SaveStorage {
  read(): string | null;
  write(s: string): void;
  clear(): void;
}

function cloneDefault(): SaveData {
  return { ...DEFAULT_SAVE, settings: { ...DEFAULT_SAVE.settings }, upgrades: {}, unlocks: { characters: [], stages: [] }, stageBest: {} };
}

const isStringList = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');

/** Parse + migrate. Unknown versions or garbage fall back to defaults; missing fields are filled in. */
export function loadSave(st: SaveStorage): SaveData {
  const raw = st.read();
  if (!raw) return cloneDefault();
  try {
    const parsed = JSON.parse(raw) as (Partial<Omit<SaveData, 'version'>> & { version?: number }) | null;
    // version 1 had no unlocks; everything it did have carries over, and the new fields take
    // their defaults. Anything newer than this build knows is treated as garbage rather than
    // half-read, because a save written by a later version may mean its fields differently.
    if (!parsed || typeof parsed !== 'object' || (parsed.version !== 1 && parsed.version !== 2)) return cloneDefault();
    const d = cloneDefault();
    if (typeof parsed.gold === 'number') d.gold = parsed.gold;
    if (typeof parsed.runsPlayed === 'number') d.runsPlayed = parsed.runsPlayed;
    if (typeof parsed.bestTimeSec === 'number') d.bestTimeSec = parsed.bestTimeSec;
    if (typeof parsed.bestKills === 'number') d.bestKills = parsed.bestKills;
    if (parsed.upgrades && typeof parsed.upgrades === 'object') {
      for (const [k, v] of Object.entries(parsed.upgrades)) {
        if (typeof v === 'number' && v > 0) d.upgrades[k] = Math.floor(v);
      }
    }
    if (parsed.unlocks && typeof parsed.unlocks === 'object') {
      if (isStringList(parsed.unlocks.characters)) d.unlocks.characters = [...new Set(parsed.unlocks.characters)];
      if (isStringList(parsed.unlocks.stages)) d.unlocks.stages = [...new Set(parsed.unlocks.stages)];
    }
    if (parsed.stageBest && typeof parsed.stageBest === 'object') {
      for (const [k, v] of Object.entries(parsed.stageBest)) {
        if (typeof v === 'number' && v > 0) d.stageBest[k] = v;
      }
    }
    if (typeof parsed.lastCharacterId === 'string') d.lastCharacterId = parsed.lastCharacterId;
    if (typeof parsed.lastStageId === 'string') d.lastStageId = parsed.lastStageId;
    if (parsed.settings && typeof parsed.settings === 'object') {
      if (parsed.settings.locale === 'en' || parsed.settings.locale === 'zh-CN') d.settings.locale = parsed.settings.locale;
      if (typeof parsed.settings.sfxVolume === 'number') d.settings.sfxVolume = Math.min(1, Math.max(0, parsed.settings.sfxVolume));
      if (typeof parsed.settings.musicVolume === 'number') d.settings.musicVolume = Math.min(1, Math.max(0, parsed.settings.musicVolume));
    }
    return d;
  } catch {
    return cloneDefault();
  }
}

export function writeSave(st: SaveStorage, save: SaveData): void {
  st.write(JSON.stringify(save));
}

export interface RunSummary {
  timeSec: number;
  kills: number;
  gold: number;
  stageId?: string;
  characterId?: string;
  /** whether the run reached the end of the stage; only a survived stage opens the next one */
  survived?: boolean;
}

/** Fold a finished run into the save and persist it. Returns the new save object. */
export function commitRun(st: SaveStorage, save: SaveData, run: RunSummary): SaveData {
  const stages = [...save.unlocks.stages];
  if (run.survived && run.stageId && !stages.includes(run.stageId)) stages.push(run.stageId);
  const stageBest = { ...save.stageBest };
  if (run.stageId) stageBest[run.stageId] = Math.max(stageBest[run.stageId] ?? 0, run.timeSec);
  const next: SaveData = {
    ...save,
    settings: { ...save.settings },
    upgrades: { ...save.upgrades },
    unlocks: { characters: [...save.unlocks.characters], stages },
    stageBest,
    gold: save.gold + Math.max(0, Math.floor(run.gold)),
    runsPlayed: save.runsPlayed + 1,
    bestTimeSec: Math.max(save.bestTimeSec, run.timeSec),
    bestKills: Math.max(save.bestKills, run.kills),
    lastCharacterId: run.characterId ?? save.lastCharacterId,
    lastStageId: run.stageId ?? save.lastStageId,
  };
  writeSave(st, next);
  return next;
}
