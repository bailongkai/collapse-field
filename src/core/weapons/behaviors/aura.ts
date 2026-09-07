import { ENEMY_CAP, MAX_ENEMY_RADIUS } from '../../../config';
import { hitCooldownTicks } from '../ticks';
import type { WeaponBehavior } from '../types';

const AURA_RADIUS = 80;

/**
 * EMP力场 / garlic: a permanent damage field around the player. It has no cooldown at all — each
 * enemy simply cannot be hit again until its own interval elapses — so it runs purely from onTick.
 */
export const aura: WeaponBehavior = {
  onFire() {
    return 'hold';
  },

  onTick(ctx, inst, eff) {
    const r = AURA_RADIUS * eff.area;
    const cdTicks = hitCooldownTicks(eff.hitCooldownMs);
    const px = ctx.player.x;
    const py = ctx.player.y;
    // pad by the largest body: the grid holds centres, so a big enemy can overlap from outside the box
    const q = r + MAX_ENEMY_RADIUS;
    const n = ctx.queryEnemies(px - q, py - q, px + q, py + q, scratch);
    for (let i = 0; i < n; i++) {
      const e = ctx.enemyById(scratch[i]);
      if (!e.active || !e.def) continue;
      const rr = r + e.radius;
      const dx = e.x - px;
      const dy = e.y - py;
      const d2 = dx * dx + dy * dy;
      if (d2 > rr * rr) continue;
      if (ctx.tick - inst.lastHitTick[e.id] < cdTicks) continue;
      inst.lastHitTick[e.id] = ctx.tick;
      const len = Math.sqrt(d2) || 1;
      ctx.hitEnemy(e, eff.damage, dx / len, dy / len, eff.knockback, inst);
    }
  },
};

/** Current field radius, used by the view to size the ring. */
export function auraRadius(area: number): number {
  return AURA_RADIUS * area;
}

const scratch = new Int32Array(ENEMY_CAP);
