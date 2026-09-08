import type { WeaponBehavior } from '../types';

const BOLT_SPEED = 500;
const RANGE = 640;

/**
 * 制导激光 / magic wand: the volley fans out over the nearest enemies, one target per shot, and
 * flies at where each is now. Shots with nothing in range are skipped rather than fired blindly.
 *
 * The targets have to be distinct. Every shot picking "the nearest" put the whole volley into one
 * body — the shots are a hundred milliseconds apart, so nothing has moved between them — and a
 * level eight laser emptied five bolts into a single drone while the rest of the screen closed in.
 * When there are fewer bodies than shots the volley wraps round, which is what puts every bolt into
 * a boss that is standing on its own.
 */
export const aimed: WeaponBehavior = {
  onFire(ctx, inst, eff) {
    inst.volleyLeft = Math.max(1, Math.round(eff.amount));
    inst.volleyTimer = 0;
    return 'cooldown';
  },
  onVolleyShot(ctx, inst, eff, index) {
    const target = ctx.volleyTarget(ctx.player.x, ctx.player.y, RANGE, index);
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
