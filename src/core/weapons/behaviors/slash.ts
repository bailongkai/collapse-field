import type { WeaponBehavior } from '../types';

const RECT_LEN = 140;
/**
 * The cross-section of the sweep: a band, not a line, so a horizontal swing covers a crowd rather
 * than a single row of it. It is exactly the width of the drawn crescent (`fx_slash` is 128 px
 * across), so what the player sees is what the blade hits.
 */
const RECT_WIDTH = 128;

/**
 * 等离子刃 / whip: an instant sweep to the side the character faces. The projectile carries the hit
 * rectangle and resolves it on its spawn tick, then lingers only as a visual.
 *
 * It swings to both sides at once, so the skill it asks for is vertical: the band is horizontal,
 * and a crowd that is directly above or below the character is a crowd the blade passes over.
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
    // shot 0 goes where the character faces, shot 1 the other way, later shots alternate again
    const angle = ctx.player.facing + (index % 2 === 1 ? Math.PI : 0);
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
