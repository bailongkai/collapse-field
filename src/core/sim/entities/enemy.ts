import type { EnemyBehaviorId, EnemyDef } from '../../../data/types';

export interface Enemy {
  id: number;
  /** unique per spawn; used for per-projectile hit dedupe across slot reuse */
  serial: number;
  active: boolean;
  defId: string;
  def: EnemyDef | null;
  /** per instance: swarm members are forced to 'line' even when the def says 'chase' */
  behavior: EnemyBehaviorId;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  radius: number;
  /** px/s knockback velocity, decays each step */
  kbx: number;
  kby: number;
  flashMs: number;
  /** line behavior: constant travel direction and speed */
  dirX: number;
  dirY: number;
  lineSpeed: number;
  /** ms remaining before a line enemy despawns as a safety net */
  lifeMs: number;
  isEvent: boolean;
  dmgMult: number;
  facing: number;
}

export function createEnemy(id: number): Enemy {
  return {
    id, serial: 0, active: false, defId: '', def: null, behavior: 'chase',
    x: 0, y: 0, hp: 0, maxHp: 0, radius: 0, kbx: 0, kby: 0, flashMs: 0,
    dirX: 0, dirY: 0, lineSpeed: 0, lifeMs: 0, isEvent: false, dmgMult: 1, facing: 0,
  };
}
