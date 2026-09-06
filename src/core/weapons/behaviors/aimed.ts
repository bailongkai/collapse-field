import type { WeaponBehavior } from '../types';

const BOLT_SPEED = 500;
const RANGE = 640;

/**
 * 制导激光 / magic wand: each shot picks the nearest enemy and flies at where it is now. Shots with
 * no target in range are skipped rather than fired blindly, matching the original.
 */
export const aimed: WeaponBehavior = {
  onFire(ctx, inst, eff) {
    inst.volleyLeft = Math.max(1, Math.round(eff.amount));
    inst.volleyTimer = 0;
    return 'cooldown';
  },
  onVolleyShot(ctx, inst, eff) {
    const target = ctx.nearestEnemy(ctx.player.x, ctx.player.y, RANGE);
    if (!target) return;
    const p = ctx.spawnProjectile();
    if (!p) return;
    const dx = target.x - ctx.player.x;
    const dy = target.y - ctx.player.y;
    const len = Math.hypot(dx, dy) || 1;
    const speed = BOLT_SPEED * eff.speed;
    p.kind = 'bolt';
    p.weaponSlot = inst.slot;
    p.x = ctx.player.x;
    p.y = ctx.player.y;
    p.vx = (dx / len) * speed;
    p.vy = (dy / len) * speed;
    p.angle = Math.atan2(dy, dx);
    p.damage = eff.damage;
    p.knockback = eff.knockback;
    p.pierce = eff.pierce;
    p.ttlMs = 1500;
    p.radius = 8 * eff.area;
    p.scale = eff.area;
    p.hitSerials.length = 0;
  },
};
