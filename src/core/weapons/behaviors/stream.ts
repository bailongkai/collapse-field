import type { WeaponBehavior } from '../types';

const BOLT_SPEED = 700;
const SPREAD = (6 * Math.PI) / 180;
/** how far the railgun looks for a target before falling back to the facing direction */
const AIM_RANGE = 700;

/**
 * 磁轨炮 / knife: a burst of fast rounds with a small spread, aimed at the nearest enemy and
 * falling back to the facing direction when nothing is in range. Unlike the guided laser it always
 * fires, which is what makes it the reliable damage floor.
 */
export const stream: WeaponBehavior = {
  onFire(ctx, inst, eff) {
    inst.volleyLeft = Math.max(1, Math.round(eff.amount));
    inst.volleyTimer = 0;
    return 'cooldown';
  },
  onVolleyShot(ctx, inst, eff) {
    const p = ctx.spawnProjectile();
    if (!p) return;
    const target = ctx.nearestEnemy(ctx.player.x, ctx.player.y, AIM_RANGE);
    const aim = target ? Math.atan2(target.y - ctx.player.y, target.x - ctx.player.x) : ctx.player.facing;
    const angle = aim + (ctx.rng.next() * 2 - 1) * SPREAD;
    const speed = BOLT_SPEED * eff.speed;
    p.kind = 'bolt';
    p.weaponSlot = inst.slot;
    p.x = ctx.player.x;
    p.y = ctx.player.y;
    p.vx = Math.cos(angle) * speed;
    p.vy = Math.sin(angle) * speed;
    p.angle = angle;
    p.damage = eff.damage;
    p.knockback = eff.knockback;
    p.pierce = eff.pierce;
    p.ttlMs = 1200;
    p.radius = 7 * eff.area;
    p.scale = eff.area;
    p.hitSerials.length = 0;
  },
};
