import { ENEMY_CAP, MAX_ENEMY_RADIUS } from '../../../config';
import type { Enemy } from '../../sim/entities/enemy';
import type { WeaponBehavior, WeaponContext, WeaponInstance } from '../types';

/** How far the arc will reach for its first body, and how far it jumps between them. */
const SEEK_RADIUS = 168;
const JUMP_RANGE = 72;
/** what each link keeps of the one before it */
const FALLOFF = 0.9;
/** ms before a cast that found nothing tries again; well short of the cooldown, and quiet */
const RETRY_MS = 400;
const SEGMENT_TTL_MS = 140;

const scratch = new Int32Array(ENEMY_CAP);
const visited: number[] = [];

/** The nearest body not already in the chain. Scenery is hittable but never relays. */
function nearestLink(ctx: WeaponContext, x: number, y: number, range: number, seen: number[]): Enemy | null {
  const q = range + MAX_ENEMY_RADIUS;
  const n = ctx.queryEnemies(x - q, y - q, x + q, y + q, scratch);
  let best: Enemy | null = null;
  let bestD = range * range;
  for (let i = 0; i < n; i++) {
    const e = ctx.enemyById(scratch[i]);
    if (!e.active || !e.def || e.def.invulnerable) continue;
    if (e.def.behavior === 'mire') continue; // terrain is not a conductor
    if (seen.includes(e.id)) continue;
    const dx = e.x - x;
    const dy = e.y - y;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
}

/**
 * 电弧导体: an arc that will not leave the player unless there is a body close enough to take it,
 * and then walks from body to body through the crowd, losing a tenth of its bite at every step.
 *
 * Every other weapon works the same whether there is one enemy or forty. This one is worth nothing
 * in an empty field and more with every body pressed together, so the correct play is to walk
 * towards the drones — which is the play contact damage has spent the whole game punishing. The
 * jump range is short on purpose: a loose crowd genuinely breaks the chain, so density is the
 * resource and not merely presence.
 */
export const chain: WeaponBehavior = {
  onFire(ctx, inst, eff) {
    const arcs = Math.max(1, Math.round(eff.amount));
    const links = Math.max(1, Math.round(eff.pierce));
    visited.length = 0;
    let fired = 0;

    for (let a = 0; a < arcs; a++) {
      let from = nearestLink(ctx, ctx.player.x, ctx.player.y, SEEK_RADIUS, visited);
      if (!from) break;
      let damage = eff.damage;
      let fx = ctx.player.x;
      let fy = ctx.player.y;
      for (let link = 0; link < links && from; link++) {
        visited.push(from.id);
        // the hit direction is measured from the player, not from the last body: a chain that
        // arrived sideways would walk straight through a bulwark's shield, which is the one thing
        // that armour exists to prevent
        const hx = from.x - ctx.player.x;
        const hy = from.y - ctx.player.y;
        const hl = Math.hypot(hx, hy) || 1;
        ctx.hitEnemy(from, damage, hx / hl, hy / hl, eff.knockback, inst);
        segment(ctx, inst, fx, fy, from.x, from.y, eff.area);
        fired++;
        if (from.def?.behavior === 'prop') break; // scenery burns, but it does not carry the arc on
        fx = from.x;
        fy = from.y;
        damage *= FALLOFF;
        from = nearestLink(ctx, from.x, from.y, JUMP_RANGE, visited);
      }
    }

    if (fired === 0) {
      // nothing was in reach: come back soon, but do not report a shot that never happened
      inst.cooldownLeft = Math.min(RETRY_MS, eff.cooldownMs) - eff.cooldownMs;
    }
    return 'cooldown';
  },
};

/**
 * A drawn-only segment between two links, so the player can see the arc walk the crowd. It carries
 * the weapon's slot so the view can pick its frame, and is anchored at the first link like every
 * other slash: `pointInOrientedRect` measures forward from the origin and the view draws the frame
 * half a length ahead of it, so the picture spans exactly the two bodies.
 */
function segment(ctx: WeaponContext, inst: WeaponInstance, ax: number, ay: number, bx: number, by: number, area: number): void {
  const p = ctx.spawnProjectile();
  if (!p) return;
  p.kind = 'slash';
  p.hostile = false;
  p.weaponSlot = inst.slot;
  p.x = ax;
  p.y = ay;
  p.vx = 0;
  p.vy = 0;
  p.angle = Math.atan2(by - ay, bx - ax);
  p.damage = 0;
  p.knockback = 0;
  p.pierce = 0;
  p.ttlMs = SEGMENT_TTL_MS;
  p.radius = 1;
  p.rectLen = Math.hypot(bx - ax, by - ay);
  p.rectWidth = 10 * area;
  p.scale = area;
  // resolveSlash returns early once anything is in hitSerials, so a sentinel makes this segment
  // purely drawn: the behaviour has already dealt the damage, and a second pass would double it
  p.hitSerials.length = 0;
  p.hitSerials.push(-1);
}
