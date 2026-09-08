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
export type LevelUpChoice =
  | { kind: 'weapon' | 'passive'; id: string; toLevel: number }
  | { kind: 'gold'; amount: number }
  | { kind: 'heal'; amount: number };
