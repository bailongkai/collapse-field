import { BOSS_SCALING } from '../../data/bossScaling';

/** The highest level that still meets a boss arriving at `atSec` as it was authored. */
export function authoredLevel(atSec: number): number {
  return BOSS_SCALING.authored.base + (atSec / 60) * BOSS_SCALING.authored.perMinute;
}

/** What a boss's authored health is multiplied by for a player of `level`; never below one. */
export function bossLevelScale(kind: 'boss' | 'final', atSec: number, level: number): number {
  const over = Math.max(0, level / authoredLevel(atSec) - 1);
  return Math.min(BOSS_SCALING.cap[kind], 1 + over * BOSS_SCALING.gain[kind]);
}
