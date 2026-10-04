import type { WeaponBehavior } from '../types';
import { VERB_TUNING } from '../../../data/verbs';

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
    // latched here rather than read per shot: see WeaponInstance.volleyFacing
    inst.volleyFacing = ctx.player.facing;
    return 'cooldown';
  },
  onVolleyShot(ctx, inst, eff, index) {
    const p = ctx.spawnProjectile();
    if (!p) return;
    // shot 0 goes where the character faced when the swing started, shot 1 the other way
    const angle = inst.volleyFacing + (index % 2 === 1 ? Math.PI : 0);
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
    // 回旋: the same sweep comes back along its path, a beat later each time, at half the damage
    for (let k = 1; k <= inst.verb; k++) {
      const r = ctx.spawnProjectile();
      if (!r) break;
      r.kind = 'slash';
      r.weaponSlot = inst.slot;
      r.x = ctx.player.x;
      r.y = ctx.player.y;
      r.vx = 0;
      r.vy = 0;
      r.angle = angle;
      r.damage = eff.damage * VERB_TUNING.slash.scale;
      r.knockback = 0;
      r.pierce = Infinity;
      r.ttlMs = eff.durationMs;
      r.rectLen = p.rectLen;
      r.rectWidth = p.rectWidth;
      r.scale = eff.area;
      r.radius = 0;
      r.hitSerials.length = 0;
      r.delayMs = VERB_TUNING.slash.delayMs * k;
      r.anchored = true;
    }
  },
};

export const SLASH_RECT = { len: RECT_LEN, width: RECT_WIDTH };
