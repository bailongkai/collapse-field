import { BOSS_SCALING } from '../../data/bossScaling';
import type { Enemy } from '../sim/entities/enemy';

export type BossKind = 'boss' | 'final';

/** The highest level that still meets a boss arriving at `atSec` as it was authored. */
export function authoredLevel(atSec: number): number {
  return BOSS_SCALING.authored.base + (atSec / 60) * BOSS_SCALING.authored.perMinute;
}

/** What a boss's authored health is multiplied by for a player of `level`; never below one. */
export function bossLevelScale(kind: BossKind, atSec: number, level: number): number {
  const over = Math.max(0, level / authoredLevel(atSec) - 1);
  return Math.min(BOSS_SCALING.cap[kind], 1 + over * BOSS_SCALING.gain[kind]);
}

/** How long the fight arriving at `atSec` is meant to last against the output it measures. */
export function bossTargetSeconds(kind: BossKind, atSec: number): number {
  if (kind === 'final') return BOSS_SCALING.targetSeconds.final;
  return atSec <= 300 ? BOSS_SCALING.targetSeconds.first : BOSS_SCALING.targetSeconds.second;
}

/** Arms the check a boss makes against its own intake once it is being hit: see `bossIntake`. */
export function armBossCheck(e: Enemy, kind: BossKind, atSec: number, authoredHp: number): void {
  e.scaleTargetMs = bossTargetSeconds(kind, atSec) * 1000;
  e.scaleCapHp = authoredHp * BOSS_SCALING.dpsCap;
  e.intakeStartMs = -1;
  e.intakeMarkMs = -1;
  e.intakeDealt = 0;
}

/** Stops the check: the health stands as it is for the rest of the fight. */
export function closeBossCheck(e: Enemy): void {
  e.scaleTargetMs = 0;
}

/**
 * A chest opened mid-check. If the boss has already set its health against the build, that
 * stands and the reward is the player's to feel; if not, the window that straddles the chest is
 * thrown away rather than read, and the check goes on against the build as it now is.
 */
export function bossCheckChest(e: Enemy, now: number): void {
  if (e.scaleTargetMs <= 0 || e.intakeStartMs < 0) return;
  if (e.intakeMarkMs > e.intakeStartMs) {
    closeBossCheck(e);
    return;
  }
  e.intakeMarkMs = now;
  e.intakeDealt = 0;
}

/**
 * A boss being hit measures what it takes, `dealt` at `now`, in windows of `measureMs` from its
 * first hit. At the end of each window, and early if the window has taken a quarter of the bar, it
 * projects the window's rate over what is left of its target and, if that would outlast its health,
 * raises health and maximum alike, so the bar keeps its fraction (or comes back to half, if it was
 * already below). It keeps checking through the first half of the target, so a fight that warms up
 * (the boss walking into the blade) is caught too, and then stops. Returns the factor the maximum
 * was raised by, 1 when it was not.
 */
export function bossIntake(e: Enemy, dealt: number, now: number): number {
  if (e.scaleTargetMs <= 0) return 1;
  // the hit that opens a window is not part of its rate: n hits span n - 1 intervals, and counting
  // the first one read a blade swinging every 1.5 s as three times what it was
  if (e.intakeStartMs < 0) {
    e.intakeStartMs = now;
    e.intakeMarkMs = now;
    return 1;
  }
  e.intakeDealt += dealt;
  const elapsed = now - e.intakeStartMs;
  const span = now - e.intakeMarkMs;
  // a window that has already taken a quarter of the bar settles early, so the bar never drains
  // far on a figure that is about to be corrected
  const quarter = e.intakeDealt >= e.maxHp * 0.25 && span >= BOSS_SCALING.measureFloorMs;
  if (span < BOSS_SCALING.measureMs && !quarter) return 1;
  const rate = e.intakeDealt / Math.max(BOSS_SCALING.measureFloorMs, span);
  e.intakeDealt = 0;
  e.intakeMarkMs = now;
  const target = e.scaleTargetMs;
  if (elapsed >= target / 2) closeBossCheck(e);
  if (e.hp <= 0) return 1;
  const wantHp = rate * Math.max(0, target - elapsed);
  if (!(wantHp > e.hp)) return 1;
  // the bar keeps its fraction, so it does not jump, unless the build tore through half of it
  // before the first window could close: then it comes back to half, or a boss with all of its
  // fight still ahead would sit on a sliver of a bar for twenty seconds
  const fraction = Math.max(0.5, e.hp / e.maxHp);
  const maxHp = Math.min(e.scaleCapHp, Math.max(e.maxHp, wantHp / fraction));
  const hp = Math.min(maxHp * fraction, wantHp);
  if (!(hp > e.hp)) return 1;
  const factor = maxHp / e.maxHp;
  e.hp = hp;
  e.maxHp = maxHp;
  return factor;
}
