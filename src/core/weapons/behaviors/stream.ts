import type { WeaponBehavior } from '../types';

const BOLT_SPEED = 700;
/** a wider cone than a rifle: the shots have to cover a side, not thread a needle */
const SPREAD = (14 * Math.PI) / 180;

/**
 * 磁轨炮 / knife: a burst of fast rounds in a cone to the side the character faces. Unlike the
 * guided laser it always fires whether or not anything is in range, which is what makes it the
 * reliable damage floor — and unlike the guided laser, pointing it is the player's job.
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
    const angle = ctx.player.facing + (ctx.rng.next() * 2 - 1) * SPREAD;
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
