import type { WeaponBehavior } from '../types';

/** The beam: how far it reaches from the character, how wide one lane is, and how long it shows. */
const LANCE_LEN = 448;
const LANCE_WIDTH = 64;
const LANCE_TTL_MS = 200;

/**
 * 平射炮: a piercing beam from the character's own body, laid down the side she faces the moment
 * the cooldown elapses. Extra lanes stack vertically, so the wall grows taller with amount and
 * longer with area.
 *
 * It used to fire only on the tick the player turned, with a hold that paid an overcharge, on the
 * idea that the turn being the trigger made timing the whole weapon. In play it made a gun that
 * spent most of a run loaded and silent: the player holding a heading to kite a crowd is exactly
 * the player who never turns, and a hands-off run standing in front of a lane of mechs fired
 * nothing at all for twenty seconds. The beam is the identity now. The character still faces left
 * or right only, so which side it lands on is the same single press that aims the railgun.
 *
 * The lane is anchored at the body, like the blade's sweep: `pointInOrientedRect` measures from
 * its origin forward, and the view draws the sprite half a length ahead of it. The earlier version
 * put the origin half a length out, so both the hit box and the picture began a beam's half-length
 * away from the character — which is what made it look like a shell going off somewhere else.
 */
export const pivot: WeaponBehavior = {
  onFire(ctx, inst, eff) {
    const facing = ctx.player.facing;
    const lanes = Math.max(1, Math.round(eff.amount));
    const len = LANCE_LEN * eff.area;
    const width = LANCE_WIDTH * eff.area;
    // facing is only ever 0 or PI, so the lanes stack vertically and the wall is always upright
    for (let i = 0; i < lanes; i++) {
      const offset = lanes === 1 ? 0 : (i - (lanes - 1) / 2) * width;
      const p = ctx.spawnProjectile();
      if (!p) break;
      p.kind = 'slash';
      p.hostile = false;
      p.weaponSlot = inst.slot;
      p.x = ctx.player.x;
      p.y = ctx.player.y + offset;
      p.vx = 0;
      p.vy = 0;
      p.angle = facing;
      p.damage = eff.damage;
      p.knockback = eff.knockback;
      p.pierce = Infinity;
      p.ttlMs = eff.durationMs > 0 ? eff.durationMs : LANCE_TTL_MS;
      p.radius = 1;
      p.rectLen = len;
      p.rectWidth = width;
      p.scale = eff.area;
      p.hitSerials.length = 0;
    }
    // every lane goes on this tick and no volley is queued, so the weapon system would voice nothing
    ctx.events.push('shot', ctx.player.x, ctx.player.y, inst.slot, inst.defId);
    return 'cooldown';
  },
};
