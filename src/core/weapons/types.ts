import type { EventBuffer } from '../events';
import type { PlayerStats, WeaponBehaviorId } from '../../data/types';
import type { EffectiveWeapon } from '../stats/weaponParams';
import type { Enemy } from '../sim/entities/enemy';
import type { Projectile } from '../sim/entities/projectile';
import type { Player } from '../sim/entities/player';
import type { Rng } from '../rng';

export type { EffectiveWeapon };

export interface WeaponInstance {
  defId: string;
  slot: number;
  level: number;
  /** ms until the next onFire */
  cooldownLeft: number;
  /** shots left in the current volley and the ms timer between them */
  volleyLeft: number;
  volleyTimer: number;
  /**
   * The character's facing at the moment the volley was fired, latched.
   *
   * A volley's shots are an interval apart, and facing flips the instant a key goes down, so a
   * behaviour that re-reads it per shot has the mirrored swing computed against a direction that
   * has already changed: turn between the two and PI + PI collapses to 0, putting both crescents on
   * the same side. That happens exactly when the player is reacting to a crowd.
   */
  volleyFacing: number;
  /** projectiles this weapon currently owns (orbit) */
  activeCount: number;
  /** pylon: how many stakes have been planted, which is what spaces them round the player */
  plantSerial: number;
  /** pivot: ms the shot has been held loaded, which is what the overcharge is paid out of */
  holdMs: number;
  /** limit break: fractions added on top of the levelled params, with no ceiling */
  limit: { damage: number; area: number; cooldown: number; speed: number };
  /** tick of the last hit per enemy slot; -1e9 means "never" (reset when a slot is reused) */
  lastHitTick: Int32Array;
}

/**
 * 'cooldown' — the weapon system arms the cooldown once the volley finishes.
 * 'hold'     — the behavior arms the cooldown itself (orbit waits for its drones to expire).
 */
export type FireResult = 'cooldown' | 'hold';

export interface WeaponContext {
  rng: Rng;
  tick: number;
  player: Player;
  stats: PlayerStats;
  spawnProjectile(): Projectile | null;
  /** the simulation's event ring, so a behaviour can say a volley began */
  events: EventBuffer;
  nearestEnemy(x: number, y: number, maxDist: number): Enemy | null;
  /** The target for shot `index` of a volley: the index-th nearest, wrapping round when short. */
  volleyTarget(x: number, y: number, maxDist: number, index: number): Enemy | null;
  queryEnemies(x0: number, y0: number, x1: number, y1: number, out: Int32Array): number;
  enemyById(id: number): Enemy;
  /** Visits the projectiles this weapon slot currently owns (orbiters). */
  forEachProjectile(slot: number, fn: (p: Projectile) => void): void;
  hitEnemy(e: Enemy, dmg: number, dirX: number, dirY: number, kb: number, src: WeaponInstance): void;
}

export interface WeaponBehavior {
  /** Called when the cooldown elapses. Queues the volley and reports who owns the cooldown. */
  onFire(ctx: WeaponContext, inst: WeaponInstance, eff: EffectiveWeapon): FireResult;
  /** Called once per shot of a volley (index 0 is the first shot). */
  onVolleyShot?(ctx: WeaponContext, inst: WeaponInstance, eff: EffectiveWeapon, index: number): void;
  /** Called every step for continuous weapons (aura, orbit). */
  onTick?(ctx: WeaponContext, inst: WeaponInstance, eff: EffectiveWeapon, dt: number): void;
}

export type BehaviorMap = Record<WeaponBehaviorId, WeaponBehavior>;
