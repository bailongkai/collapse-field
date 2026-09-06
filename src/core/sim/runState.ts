export interface OwnedItem {
  id: string;
  level: number;
}
export type RunPhase = 'running' | 'levelup' | 'paused' | 'ended';
export type RunEnd = 'died' | 'survived';
export type LevelUpChoice =
  | { kind: 'weapon' | 'passive'; id: string; toLevel: number }
  | { kind: 'gold'; amount: number }
  | { kind: 'heal'; amount: number };
