import type { WeaponBehavior } from '../types';

/** The wall the cannon lays down: how far it reaches, how wide one lane is, and how long it shows. */
const LANCE_LEN = 448;
const LANCE_WIDTH = 64;
const LANCE_TTL_MS = 200;
/** the hold that pays the overcharge, as a fraction of the cooldown, and what a full one is worth */
const OVER_WINDOW = 0.6;
const OVER_GAIN = 0.8;

/**
 * 回身炮: the gun charges while you hold a heading and then waits. It fires nothing at all until
 * you press the other way, and the instant you do it lays a wall of piercing beams down the side
 * you have just turned to face.
 *
 * The character faces left or right only, and that one deliberate press is the game's signature
 * rule. Every other weapon treats the turn as a consequence; this one makes it the trigger, so the
 * question stops being "where do I stand" and becomes "when do I turn" — and a turn spent early is
 * a shot spent at half strength.
 */
export const pivot: WeaponBehavior = {
  onFire(ctx, inst) {
    // the cooldown elapsing means LOADED, never FIRED. The heading is latched now rather than at
    // the last discharge, so a flip made while the gun was still charging cannot be banked and
    // fired the instant it comes ready: the choice of moment has to be made with the gun ready.
    inst.volleyFacing = ctx.player.facing;
    inst.holdMs = 0;
    return 'hold';
  },

  onTick(ctx, inst, eff, dt) {
    if (inst.cooldownLeft !== Infinity) return; // still recharging
    inst.holdMs += dt * 1000;
    if (ctx.player.facing === inst.volleyFacing) return; // loaded, waiting for the turn

    // The overcharge is what the hold bought. Projectile speed pays it out rather than shortening
    // the window: a faster gun would otherwise fill the meter before the player could choose the
    // moment, and the choice of moment is the entire weapon.
    const windowMs = OVER_WINDOW * eff.cooldownMs;
    const dmg = eff.damage * (1 + OVER_GAIN * eff.speed * Math.min(1, inst.holdMs / windowMs));
    const facing = ctx.player.facing;
    const lanes = Math.max(1, Math.round(eff.amount));
    const len = LANCE_LEN * eff.area;
    const width = LANCE_WIDTH * eff.area;
    const dirX = Math.cos(facing);
    // facing is only ever 0 or PI, so the lanes stack vertically and the wall is always upright
    for (let i = 0; i < lanes; i++) {
      const offset = lanes === 1 ? 0 : (i - (lanes - 1) / 2) * width;
      const p = ctx.spawnProjectile();
      if (!p) break;
      p.kind = 'slash';
      p.hostile = false;
      p.weaponSlot = inst.slot;
      p.x = ctx.player.x + dirX * (len / 2);
      p.y = ctx.player.y + offset;
      p.vx = 0;
      p.vy = 0;
      p.angle = facing;
      p.damage = dmg;
      p.knockback = eff.knockback;
      p.pierce = Infinity;
      p.ttlMs = eff.durationMs > 0 ? eff.durationMs : LANCE_TTL_MS;
      p.radius = 1;
      p.rectLen = len;
      p.rectWidth = width;
      p.scale = eff.area;
      p.hitSerials.length = 0;
    }
    ctx.events.push('shot', ctx.player.x, ctx.player.y, inst.slot, inst.defId);
    inst.holdMs = 0;
    inst.cooldownLeft = eff.cooldownMs; // the turn discharged it; start charging again
  },
};
