import { SCORE_WEIGHTS } from '../../data/score';

export interface ScoreInput {
  timeSec: number;
  kills: number;
  level: number;
  bossKills: number;
  survived: boolean;
  curse: number;
}

/** See src/data/score.ts for the formula and why. */
export function runScore(r: ScoreInput): number {
  const w = SCORE_WEIGHTS;
  const base = Math.floor(r.timeSec) * w.perSecond + r.kills * w.perKill + r.level * w.perLevel + r.bossKills * w.perBoss + (r.survived ? w.clear : 0);
  return Math.max(0, Math.round(base * (1 + Math.max(0, r.curse))));
}

/** A score short enough for a tile: 9876, then 12.3k. */
export function shortScore(n: number): string {
  return n >= 10_000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n));
}
