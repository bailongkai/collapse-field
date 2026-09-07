import type { WeaponBehavior } from '../types';

const RECT_LEN = 140;
const RECT_WIDTH = 50;
/** how far the blade looks for something to swing at before falling back to the facing direction */
const AIM_RANGE = 420;

/**
 * 等离子刃 / whip: an instant sweep, aimed at the nearest enemy. The projectile carries the hit
 * rectangle and resolves it on its spawn tick, then lingers only as a visual.
 *
 * It aims rather than following the direction of travel because the two are opposites exactly when
 * it matters: a player backing away from a crowd would swing into empty space every time, which
 * makes the game's only starting weapon useless in the situation it is most needed.
 */
export const slash: WeaponBehavior = {
  onFire(ctx, inst, eff) {
    inst.volleyLeft = Math.max(1, Math.round(eff.amount));
    inst.volleyTimer = 0;
    return 'cooldown';
  },
  onVolleyShot(ctx, inst, eff, index) {
    const p = ctx.spawnProjectile();
    if (!p) return;
    const target = ctx.nearestEnemy(ctx.player.x, ctx.player.y, AIM_RANGE);
    const aim = target ? Math.atan2(target.y - ctx.player.y, target.x - ctx.player.x) : ctx.player.facing;
    // shot 0 goes at the target, shot 1 behind, later shots alternate again
    const angle = aim + (index % 2 === 1 ? Math.PI : 0);
    p.kind = 'slash';
    p.weaponSlot = inst.slot;
    p.x = ctx.player.x;
    p.y = ctx.player.y;
    p.vx = 0;
    p.vy = 0;
    p.angle = angle;
    p.damage = eff.damage;
    p.knockback = eff.knockback;
    p.pierce = Infinity;
    p.ttlMs = eff.durationMs;
    p.rectLen = RECT_LEN * eff.area;
    p.rectWidth = RECT_WIDTH * eff.area;
    p.scale = eff.area;
    p.radius = 0;
    p.hitSerials.length = 0;
  },
};

export const SLASH_RECT = { len: RECT_LEN, width: RECT_WIDTH };
