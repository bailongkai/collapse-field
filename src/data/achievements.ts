import type { I18nKey } from '../i18n/types';

/**
 * What a finished run can be judged on. Everything here is already counted by the simulation or
 * the save, so an achievement is a comparison, not a new system.
 */
export interface RunFacts {
  stageId: string;
  characterId: string;
  timeSec: number;
  kills: number;
  level: number;
  survived: boolean;
  curse: number;
  chestsOpened: number;
  bossKills: number;
  /** ids of every weapon and passive held at the end, with levels */
  items: readonly { id: string; level: number }[];
  /** evolved weapon ids held at the end */
  evolved: readonly string[];
  /** the save after the run was folded in, for cumulative conditions */
  totalRuns: number;
  totalKills: number;
}

export type AchievementCondition =
  | { kind: 'survive'; seconds: number; stageId?: string; characterId?: string }
  | { kind: 'kills'; count: number }
  | { kind: 'level'; level: number }
  | { kind: 'evolve'; weaponId?: string }
  | { kind: 'bossKills'; count: number }
  | { kind: 'itemLevel'; id: string; level: number }
  | { kind: 'chests'; count: number }
  | { kind: 'curse'; atLeast: number; survived: boolean }
  | { kind: 'runs'; count: number }
  | { kind: 'totalKills'; count: number };

export interface AchievementDef {
  readonly id: string;
  readonly nameKey: I18nKey;
  readonly descKey: I18nKey;
  readonly icon: string;
  readonly condition: AchievementCondition;
  /** what earning it opens: an item that then appears on the level-up offer, or gold */
  readonly unlocks?: { readonly passive?: string; readonly weapon?: string; readonly gold?: number };
}

/**
 * The between-run loop. Each of these is a reason to start the next run with a plan, and a few of
 * them are the only way to some of the content: the three later passives are not offered until
 * they are earned.
 */
export const ACHIEVEMENTS = {
  firstBlood: { id: 'firstBlood', nameKey: 'achievement.firstBlood.name', descKey: 'achievement.firstBlood.desc', icon: 'gem_blue', condition: { kind: 'kills', count: 100 }, unlocks: { gold: 50 } },
  fiveMinutes: { id: 'fiveMinutes', nameKey: 'achievement.fiveMinutes.name', descKey: 'achievement.fiveMinutes.desc', icon: 'pk_heal', condition: { kind: 'survive', seconds: 300 }, unlocks: { gold: 100 } },
  tenMinutes: { id: 'tenMinutes', nameKey: 'achievement.tenMinutes.name', descKey: 'achievement.tenMinutes.desc', icon: 'pk_heal', condition: { kind: 'survive', seconds: 600 }, unlocks: { passive: 'thrusters' } },
  clearStation: { id: 'clearStation', nameKey: 'achievement.clearStation.name', descKey: 'achievement.clearStation.desc', icon: 'decor_0', condition: { kind: 'survive', seconds: 900, stageId: 'station' }, unlocks: { gold: 300 } },
  clearCargo: { id: 'clearCargo', nameKey: 'achievement.clearCargo.name', descKey: 'achievement.clearCargo.desc', icon: 'decor_cargo_1', condition: { kind: 'survive', seconds: 900, stageId: 'cargo' }, unlocks: { gold: 400 } },
  clearLab: { id: 'clearLab', nameKey: 'achievement.clearLab.name', descKey: 'achievement.clearLab.desc', icon: 'decor_lab_2', condition: { kind: 'survive', seconds: 900, stageId: 'lab' }, unlocks: { gold: 500 } },
  clearOrbit: { id: 'clearOrbit', nameKey: 'achievement.clearOrbit.name', descKey: 'achievement.clearOrbit.desc', icon: 'decor_orbit_0', condition: { kind: 'survive', seconds: 900, stageId: 'orbit' }, unlocks: { gold: 1000 } },
  bossSlayer: { id: 'bossSlayer', nameKey: 'achievement.bossSlayer.name', descKey: 'achievement.bossSlayer.desc', icon: 'enemy_mothership', condition: { kind: 'bossKills', count: 1 }, unlocks: { gold: 150 } },
  bossHunter: { id: 'bossHunter', nameKey: 'achievement.bossHunter.name', descKey: 'achievement.bossHunter.desc', icon: 'enemy_flagship', condition: { kind: 'bossKills', count: 2 }, unlocks: { passive: 'magazine' } },
  firstEvolution: { id: 'firstEvolution', nameKey: 'achievement.firstEvolution.name', descKey: 'achievement.firstEvolution.desc', icon: 'icon_plasmaBlade', condition: { kind: 'evolve' }, unlocks: { gold: 200 } },
  level30: { id: 'level30', nameKey: 'achievement.level30.name', descKey: 'achievement.level30.desc', icon: 'gem_big', condition: { kind: 'level', level: 30 }, unlocks: { gold: 200 } },
  level50: { id: 'level50', nameKey: 'achievement.level50.name', descKey: 'achievement.level50.desc', icon: 'gem_big', condition: { kind: 'level', level: 50 }, unlocks: { passive: 'magnetCore' } },
  collector: { id: 'collector', nameKey: 'achievement.collector.name', descKey: 'achievement.collector.desc', icon: 'pk_chest', condition: { kind: 'chests', count: 6 }, unlocks: { gold: 150 } },
  maxedBlade: { id: 'maxedBlade', nameKey: 'achievement.maxedBlade.name', descKey: 'achievement.maxedBlade.desc', icon: 'icon_plasmaBlade', condition: { kind: 'itemLevel', id: 'plasmaBlade', level: 8 }, unlocks: { gold: 100 } },
  cursedClear: { id: 'cursedClear', nameKey: 'achievement.cursedClear.name', descKey: 'achievement.cursedClear.desc', icon: 'pk_nuke', condition: { kind: 'curse', atLeast: 0.4, survived: true }, unlocks: { gold: 800 } },
  thousandKills: { id: 'thousandKills', nameKey: 'achievement.thousandKills.name', descKey: 'achievement.thousandKills.desc', icon: 'gem_red', condition: { kind: 'kills', count: 1000 }, unlocks: { gold: 300 } },
  veteran: { id: 'veteran', nameKey: 'achievement.veteran.name', descKey: 'achievement.veteran.desc', icon: 'player', condition: { kind: 'runs', count: 10 }, unlocks: { gold: 250 } },
  exterminator: { id: 'exterminator', nameKey: 'achievement.exterminator.name', descKey: 'achievement.exterminator.desc', icon: 'gem_red', condition: { kind: 'totalKills', count: 10_000 }, unlocks: { gold: 600 } },
  marineFive: { id: 'marineFive', nameKey: 'achievement.marineFive.name', descKey: 'achievement.marineFive.desc', icon: 'player_marine', condition: { kind: 'survive', seconds: 300, characterId: 'marine' }, unlocks: { gold: 150 } },
  unitClear: { id: 'unitClear', nameKey: 'achievement.unitClear.name', descKey: 'achievement.unitClear.desc', icon: 'player_unit', condition: { kind: 'survive', seconds: 900, characterId: 'unit' }, unlocks: { gold: 400 } },
} as const satisfies Record<string, AchievementDef>;

export const ACHIEVEMENT_LIST: readonly AchievementDef[] = Object.values(ACHIEVEMENTS);

/** Passives and weapons that are not offered until an achievement opens them. */
export const LOCKED_BY_DEFAULT: readonly string[] = ACHIEVEMENT_LIST.flatMap((a) => [a.unlocks?.passive, a.unlocks?.weapon].filter((x): x is string => !!x));

export function conditionMet(c: AchievementCondition, f: RunFacts): boolean {
  switch (c.kind) {
    case 'survive':
      return f.timeSec >= c.seconds && (!c.stageId || f.stageId === c.stageId) && (!c.characterId || f.characterId === c.characterId);
    case 'kills':
      return f.kills >= c.count;
    case 'level':
      return f.level >= c.level;
    case 'evolve':
      return c.weaponId ? f.evolved.includes(c.weaponId) : f.evolved.length > 0;
    case 'bossKills':
      return f.bossKills >= c.count;
    case 'itemLevel':
      return f.items.some((i) => i.id === c.id && i.level >= c.level);
    case 'chests':
      return f.chestsOpened >= c.count;
    case 'curse':
      return f.curse >= c.atLeast - 1e-9 && (!c.survived || f.survived);
    case 'runs':
      return f.totalRuns >= c.count;
    case 'totalKills':
      return f.totalKills >= c.count;
  }
}
