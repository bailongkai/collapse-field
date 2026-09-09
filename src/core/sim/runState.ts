export interface OwnedItem {
  id: string;
  level: number;
}
export type RunPhase = 'running' | 'levelup' | 'paused' | 'ended';
export type RunEnd = 'died' | 'survived';
/**
 * The result of opening a chest, already applied to the run. The view drains this queue to play the
 * reveal; nothing about the rules waits for it, which is why a chest needs no run phase of its own
 * and every headless harness keeps working unchanged.
 */
export interface ChestResult {
  grade: 'standard' | 'boss';
  x: number;
  y: number;
  rewards: LevelUpChoice[];
  /** ids of weapons that evolved as a consequence, in the order they did */
  evolved: string[];
  /** paid instead of rewards when the build has nothing left to raise */
  gold: number;
}
/** What a limit break card raises on a weapon; each is a fraction added per pick. */
export type LimitStat = 'damage' | 'area' | 'cooldown' | 'speed';
export type LevelUpChoice =
  | { kind: 'weapon' | 'passive'; id: string; toLevel: number }
  /** a build with nothing left to level keeps growing: one weapon, one stat, no cap */
  | { kind: 'limit'; id: string; stat: LimitStat; amount: number }
  | { kind: 'gold'; amount: number }
  | { kind: 'heal'; amount: number };
