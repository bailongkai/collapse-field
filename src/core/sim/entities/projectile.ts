export type ProjectileKind = 'bolt' | 'orbit' | 'slash';

export interface Projectile {
  id: number;
  active: boolean;
  weaponSlot: number;
  kind: ProjectileKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  radius: number;
  damage: number;
  knockback: number;
  pierce: number;
  ttlMs: number;
  /** orbit: index and current phase */
  orbitIndex: number;
  orbitRadius: number;
  orbitPhase: number;
  /** slash: hit rect */
  rectLen: number;
  rectWidth: number;
  scale: number;
  /** enemy serials already hit by this projectile; length reset on recycle */
  hitSerials: number[];
}

export function createProjectile(id: number): Projectile {
  return {
    id, active: false, weaponSlot: 0, kind: 'bolt', x: 0, y: 0, vx: 0, vy: 0, angle: 0,
    radius: 6, damage: 0, knockback: 0, pierce: 0, ttlMs: 0,
    orbitIndex: 0, orbitRadius: 0, orbitPhase: 0, rectLen: 0, rectWidth: 0, scale: 1, hitSerials: [],
  };
}
