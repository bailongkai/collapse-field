export type ProjectileKind = 'bolt' | 'orbit' | 'slash' | 'pylon';

export interface Projectile {
  id: number;
  active: boolean;
  /** true for enemy fire: it hits the player and ignores enemies */
  hostile: boolean;
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
  /** pylon: 0..1 while the stake arms; it does nothing until it reaches 1 */
  charge: number;
  /** slash: hit rect */
  rectLen: number;
  rectWidth: number;
  scale: number;
  /** enemy serials already hit by this projectile; length reset on recycle */
  hitSerials: number[];
  /** hostile only: the definition id of the body that fired it, so a death can be named */
  source: string;
  /**
   * ms before the projectile acts or shows: a 回旋 return or a 回波 echo is spawned with its volley
   * and waits. When `anchored`, it is placed at the player plus `anchorDx`/`anchorDy` the moment
   * the wait ends, so it comes from where she is then, not from where she was.
   */
  delayMs: number;
  anchored: boolean;
  anchorDx: number;
  anchorDy: number;
  /** bolt: turns left once the pierce is spent (跳弹) */
  bounces: number;
  /** bolt: splinters it breaks into on a kill (分裂); 0 for a bolt that does not split */
  splits: number;
  /** bolt: how many times it has turned (跳弹), so the view can show a round that came back */
  turned: number;
  /** pylon: the 接地 arcs drawn this tick, as x, y pairs from the stake, for the view */
  links: number[];
}

/** Clears the verb fields, which no behaviour sets unless it wants them; called on every spawn. */
export function resetProjectileExtras(p: Projectile): Projectile {
  p.delayMs = 0;
  p.anchored = false;
  p.anchorDx = 0;
  p.anchorDy = 0;
  p.bounces = 0;
  p.splits = 0;
  p.turned = 0;
  p.links.length = 0;
  return p;
}

export function createProjectile(id: number): Projectile {
  return {
    id, active: false, hostile: false, weaponSlot: 0, kind: 'bolt', x: 0, y: 0, vx: 0, vy: 0, angle: 0,
    radius: 6, damage: 0, knockback: 0, pierce: 0, ttlMs: 0,
    orbitIndex: 0, orbitRadius: 0, orbitPhase: 0, charge: 0, rectLen: 0, rectWidth: 0, scale: 1, hitSerials: [], source: '',
    delayMs: 0, anchored: false, anchorDx: 0, anchorDy: 0, bounces: 0, splits: 0, turned: 0, links: [],
  };
}
