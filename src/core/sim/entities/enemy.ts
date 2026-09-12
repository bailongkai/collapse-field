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
  /** multiplies the definition's move speed for this instance; a stage's wave row sets it */
  speedMult: number;
  /** ms remaining before a line enemy despawns as a safety net */
  lifeMs: number;
  isEvent: boolean;
  dmgMult: number;
  facing: number;
  /** behavior-specific state machine: 0 = normal; meaning depends on the behavior */
  aiState: number;
  /** ms remaining in the current AI state */
  aiTimer: number;
  /** ms until the behavior's secondary timer fires (summons, shots) */
  aiTimer2: number;
  /**
   * Three more clocks and a second state, because a boss runs its charge, its summons, a gun and a
   * set piece at once and each needs its own. Behaviours that need one field use aiTimer; the
   * bosses are the only bodies that use them all.
   */
  aiTimer4: number;
  aiTimer5: number;
  aiState2: number;
  /** a rotation a behaviour owns: the rotor's armoured arc, the accretion disc's phase */
  aiAngle: number;
  /** ms since spawn; bosses read it for their enrage */
  ageMs: number;
  /** ms until the next volley or mine; the boss extras have their own clock */
  aiTimer3: number;
  enraged: boolean;
}

export function createEnemy(id: number): Enemy {
  return {
    id, serial: 0, active: false, defId: '', def: null, behavior: 'chase',
    x: 0, y: 0, hp: 0, maxHp: 0, radius: 0, kbx: 0, kby: 0, flashMs: 0,
    dirX: 0, dirY: 0, lineSpeed: 0, speedMult: 1, lifeMs: 0, isEvent: false, dmgMult: 1, facing: 0,
    aiState: 0, aiTimer: 0, aiTimer2: 0, aiTimer3: 0, aiTimer4: 0, aiTimer5: 0, aiState2: 0, aiAngle: 0, ageMs: 0, enraged: false,
  };
}
