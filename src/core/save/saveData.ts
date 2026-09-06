export interface SaveData {
  version: 1;
  gold: number;
  runsPlayed: number;
  bestTimeSec: number;
  bestKills: number;
  settings: { locale: 'zh-CN' | 'en'; sfxVolume: number; musicVolume: number };
  /** permanent upgrade levels by id */
  upgrades: Record<string, number>;
}

export const DEFAULT_SAVE: SaveData = {
  version: 1,
  gold: 0,
  runsPlayed: 0,
  bestTimeSec: 0,
  bestKills: 0,
  settings: { locale: 'zh-CN', sfxVolume: 0.8, musicVolume: 0.5 },
  upgrades: {},
};

export interface SaveStorage {
  read(): string | null;
  write(s: string): void;
  clear(): void;
}

function cloneDefault(): SaveData {
  return { ...DEFAULT_SAVE, settings: { ...DEFAULT_SAVE.settings }, upgrades: {} };
}

/** Parse + migrate. Unknown versions or garbage fall back to defaults; missing fields are filled in. */
export function loadSave(st: SaveStorage): SaveData {
  const raw = st.read();
  if (!raw) return cloneDefault();
  try {
    const parsed = JSON.parse(raw) as Partial<SaveData> | null;
    if (!parsed || typeof parsed !== 'object' || parsed.version !== 1) return cloneDefault();
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
}

/** Fold a finished run into the save and persist it. Returns the new save object. */
export function commitRun(st: SaveStorage, save: SaveData, run: RunSummary): SaveData {
  const next: SaveData = {
    ...save,
    settings: { ...save.settings },
    upgrades: { ...save.upgrades },
    gold: save.gold + Math.max(0, Math.floor(run.gold)),
    runsPlayed: save.runsPlayed + 1,
    bestTimeSec: Math.max(save.bestTimeSec, run.timeSec),
    bestKills: Math.max(save.bestKills, run.kills),
  };
  writeSave(st, next);
  return next;
}
