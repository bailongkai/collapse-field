import { ACHIEVEMENT_LIST, LOCKED_BY_DEFAULT, conditionMet, type RunFacts } from '../../data/achievements';
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
  unlocks: { characters: string[]; stages: string[]; items: string[] };
  /** achievement ids earned */
  achievements: string[];
  /** enemy ids ever encountered, for the bestiary */
  seen: string[];
  totalKills: number;
  /** best survival time per stage id, seconds */
  stageBest: Record<string, number>;
  /** what the launch screen last had selected */
  lastCharacterId: string;
  lastStageId: string;
  /** the challenge fraction last chosen on the launch screen */
  lastCurse: number;
  /** bought: no interstitials between runs */
  removeAds: boolean;
  /** the first-run walkthrough has been seen */
  tutorialDone: boolean;
  /** runs ended since the last interstitial, for the cadence */
  runsSinceAd: number;
}

export const DEFAULT_SAVE: SaveData = {
  version: 2,
  gold: 0,
  runsPlayed: 0,
  bestTimeSec: 0,
  bestKills: 0,
  settings: { locale: 'zh-CN', sfxVolume: 0.8, musicVolume: 0.5 },
  upgrades: {},
  unlocks: { characters: [], stages: [], items: [] },
  achievements: [],
  seen: [],
  totalKills: 0,
  stageBest: {},
  lastCharacterId: 'survivor',
  lastStageId: 'station',
  lastCurse: 0,
  removeAds: false,
  tutorialDone: false,
  runsSinceAd: 0,
};

export interface SaveStorage {
  read(): string | null;
  write(s: string): void;
  clear(): void;
}

function cloneDefault(): SaveData {
  return { ...DEFAULT_SAVE, settings: { ...DEFAULT_SAVE.settings }, upgrades: {}, unlocks: { characters: [], stages: [], items: [] }, achievements: [], seen: [], stageBest: {} };
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
      if (isStringList(parsed.unlocks.items)) d.unlocks.items = [...new Set(parsed.unlocks.items)];
    }
    if (isStringList(parsed.achievements)) d.achievements = [...new Set(parsed.achievements)];
    if (isStringList(parsed.seen)) d.seen = [...new Set(parsed.seen)];
    if (typeof parsed.totalKills === 'number' && parsed.totalKills >= 0) d.totalKills = Math.floor(parsed.totalKills);
    if (parsed.stageBest && typeof parsed.stageBest === 'object') {
      for (const [k, v] of Object.entries(parsed.stageBest)) {
        if (typeof v === 'number' && v > 0) d.stageBest[k] = v;
      }
    }
    if (typeof parsed.lastCharacterId === 'string') d.lastCharacterId = parsed.lastCharacterId;
    if (typeof parsed.lastStageId === 'string') d.lastStageId = parsed.lastStageId;
    if (typeof parsed.lastCurse === 'number' && parsed.lastCurse >= 0) d.lastCurse = Math.min(1, parsed.lastCurse);
    if (typeof parsed.removeAds === 'boolean') d.removeAds = parsed.removeAds;
    if (typeof parsed.tutorialDone === 'boolean') d.tutorialDone = parsed.tutorialDone;
    if (typeof parsed.runsSinceAd === 'number' && parsed.runsSinceAd >= 0) d.runsSinceAd = Math.floor(parsed.runsSinceAd);
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
  level?: number;
  curse?: number;
  chestsOpened?: number;
  bossKills?: number;
  items?: readonly { id: string; level: number }[];
  evolved?: readonly string[];
  seen?: readonly string[];
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
    unlocks: { characters: [...save.unlocks.characters], stages, items: [...save.unlocks.items] },
    achievements: [...save.achievements],
    seen: [...new Set([...save.seen, ...(run.seen ?? [])])],
    totalKills: save.totalKills + Math.max(0, run.kills),
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

/** Adds gold outside a run — a rewarded ad, a purchase — and persists. */
export function grantGold(st: SaveStorage, save: SaveData, n: number): SaveData {
  const next: SaveData = { ...save, gold: save.gold + Math.max(0, Math.floor(n)) };
  writeSave(st, next);
  return next;
}

/** Sets one flag on the save and persists; for the purchases and the tutorial. */
export function setFlag(st: SaveStorage, save: SaveData, patch: Partial<Pick<SaveData, 'removeAds' | 'tutorialDone' | 'runsSinceAd'>>): SaveData {
  const next: SaveData = { ...save, ...patch };
  writeSave(st, next);
  return next;
}

/** An interstitial every third run end, unless bought off. Returns the updated save and whether to show one. */
export function interstitialDue(st: SaveStorage, save: SaveData, every = 3): { save: SaveData; show: boolean } {
  if (save.removeAds) return { save, show: false };
  const runs = save.runsSinceAd + 1;
  if (runs < every) return { save: setFlag(st, save, { runsSinceAd: runs }), show: false };
  return { save: setFlag(st, save, { runsSinceAd: 0 }), show: true };
}

/** Judges a finished run against every achievement not yet earned; returns the ids earned now. */
export function awardAchievements(st: SaveStorage, save: SaveData, run: RunSummary): { save: SaveData; earned: string[] } {
  const facts: RunFacts = {
    stageId: run.stageId ?? '',
    characterId: run.characterId ?? '',
    timeSec: run.timeSec,
    kills: run.kills,
    level: run.level ?? 1,
    survived: !!run.survived,
    curse: run.curse ?? 0,
    chestsOpened: run.chestsOpened ?? 0,
    bossKills: run.bossKills ?? 0,
    items: run.items ?? [],
    evolved: run.evolved ?? [],
    totalRuns: save.runsPlayed,
    totalKills: save.totalKills,
  };
  const earned: string[] = [];
  let gold = 0;
  const items = [...save.unlocks.items];
  for (const def of ACHIEVEMENT_LIST) {
    if (save.achievements.includes(def.id) || !conditionMet(def.condition, facts)) continue;
    earned.push(def.id);
    gold += def.unlocks?.gold ?? 0;
    for (const id of [def.unlocks?.passive, def.unlocks?.weapon]) if (id && !items.includes(id)) items.push(id);
  }
  if (earned.length === 0) return { save, earned };
  const next: SaveData = {
    ...save,
    settings: { ...save.settings },
    upgrades: { ...save.upgrades },
    stageBest: { ...save.stageBest },
    unlocks: { ...save.unlocks, characters: [...save.unlocks.characters], stages: [...save.unlocks.stages], items },
    achievements: [...save.achievements, ...earned],
    seen: [...save.seen],
    gold: save.gold + gold,
  };
  writeSave(st, next);
  return { save: next, earned };
}

/** Items the level-up offer must not show: locked by default and not yet earned. */
export function lockedItems(save: SaveData): string[] {
  return LOCKED_BY_DEFAULT.filter((id) => !save.unlocks.items.includes(id));
}
