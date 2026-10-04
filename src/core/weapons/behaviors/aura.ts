import { ENEMY_CAP, MAX_ENEMY_RADIUS, KNOCKBACK_DECAY } from '../../../config';
import { applyKnockback } from '../../sim/systems/enemySystem';
import { hitCooldownTicks } from '../ticks';
import type { WeaponBehavior } from '../types';
import { VERB_TUNING } from '../../../data/verbs';

const AURA_RADIUS = 80;
/**
 * Every PULSE_MS the field draws everything within PULSE_REACH times its radius about PULSE_PX
 * towards the player. The field is a contact weapon and a player who keeps their distance measured
 * eight kills in two minutes with it; the pulse brings the crowd that is following them into the
 * field for a moment, which is also what sets up the blade's band and the conduit's chain.
 */
export const PULSE_MS = 3000;
const PULSE_REACH = 2;
const PULSE_PX = 40;
/**
 * The field only breathes in while it is nearly empty. Measured in the minute-ten crowd at level
 * one, a pulse that also ran with the crowd on top of the player halved the kills (96 to 47): it
 * cycled bodies through a 1.3 s hit interval instead of letting the ones in contact die. Empty is
 * the kiting case, which is the one the pulse is for.
 */
const PULSE_IF_FEWER_THAN = 3;
/** the impulse that covers PULSE_PX once the per-tick decay has run its course */
const PULSE_IMPULSE = (PULSE_PX * 60 * (1 - KNOCKBACK_DECAY));
const VERB_IMPULSE = VERB_TUNING.aura.px * 60 * (1 - KNOCKBACK_DECAY);

/**
 * EMP力场 / garlic: a permanent damage field around the player. It has no cooldown at all — each
 * enemy simply cannot be hit again until its own interval elapses — so it runs purely from onTick.
 */
export const aura: WeaponBehavior = {
  onFire() {
    return 'hold';
  },

  onTick(ctx, inst, eff, dt) {
    const r = AURA_RADIUS * eff.area;
    const cdTicks = hitCooldownTicks(eff.hitCooldownMs);
    const px = ctx.player.x;
    const py = ctx.player.y;
    inst.auxMs += dt * 1000;
    const due = inst.auxMs >= PULSE_MS;
    if (due) inst.auxMs -= PULSE_MS;
    let inside = 0;
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
      inside++;
      if (ctx.tick - inst.lastHitTick[e.id] < cdTicks) continue;
      inst.lastHitTick[e.id] = ctx.tick;
      const len = Math.sqrt(d2) || 1;
      ctx.hitEnemy(e, eff.damage, dx / len, dy / len, eff.knockback, inst);
    }
    if (due && inside < PULSE_IF_FEWER_THAN) pulse(ctx, px, py, r * PULSE_REACH, PULSE_IMPULSE);
    // 脉冲: the verb's own pull, harder and on its own clock, crowd or no crowd
    if (inst.verb > 0) {
      const v = VERB_TUNING.aura;
      inst.verbMs += dt * 1000;
      const every = v.everyMs - v.everyPerStackMs * (inst.verb - 1);
      if (inst.verbMs >= every) {
        inst.verbMs -= every;
        pulse(ctx, px, py, r * PULSE_REACH, VERB_IMPULSE);
      }
    }
  },
};

/** The pull: an inward impulse on every body in reach, resisted the way a shove is. */
function pulse(ctx: Parameters<NonNullable<WeaponBehavior['onTick']>>[0], px: number, py: number, reach: number, impulse: number): void {
  const q = reach + MAX_ENEMY_RADIUS;
  const n = ctx.queryEnemies(px - q, py - q, px + q, py + q, scratch);
  for (let i = 0; i < n; i++) {
    const e = ctx.enemyById(scratch[i]);
    if (!e.active || !e.def || e.def.behavior === 'prop' || e.def.bossBar) continue;
    const dx = px - e.x;
    const dy = py - e.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > reach * reach || d2 < 1) continue;
    const d = Math.sqrt(d2);
    applyKnockback(e, dx / d, dy / d, impulse);
  }
  ctx.events.push('auraPulse', px, py, reach);
}

/** Current field radius, used by the view to size the ring. */
export function auraRadius(area: number): number {
  return AURA_RADIUS * area;
}

const scratch = new Int32Array(ENEMY_CAP);
