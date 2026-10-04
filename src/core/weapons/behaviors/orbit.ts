import { ENEMY_CAP, MAX_ENEMY_RADIUS } from '../../../config';
import { hitCooldownTicks } from '../ticks';
import type { WeaponBehavior } from '../types';

/**
 * Close enough that a drone passes through the bodies pressing on the player. A drone meets a body
 * within about 28 units of its circle, and a crowd against a player standing still sits about 30
 * from their centre: at the old 90 the whole crowd was inside the ring and the drones went round
 * it, and the Navigator's first two minutes killed a third of what every other starting weapon
 * did. At 50 the starting drones are level with the slowest of the others.
 */
const ORBIT_RADIUS = 50;
const HIT_RADIUS = 14;
const REVS_PER_SEC = 1;
/**
 * The ring leans towards a body within this reach of the player: the orbit becomes an ellipse
 * whose long axis, TILT times the radius, points at it. The drones are a contact weapon and a
 * player who keeps their distance — a new player's whole instinct — measured one kill in two
 * minutes with them; a body following a kiting player at arm's length is now something the ring
 * reaches back for.
 */
const TILT_REACH = 140;
const TILT = 1.8;
/** how fast the lean grows or fades, per second, and how fast it turns, radians per second */
const LEAN_RATE = 4;
const LEAN_TURN = 7;

/**
 * 轨道无人机 / king bible: drones circle the player for a duration, hitting what they pass through
 * on a per-enemy interval. The cooldown only starts once the last drone expires, so the behavior
 * owns its own timing ('hold') instead of the weapon system arming it.
 */
export const orbit: WeaponBehavior = {
  onFire(ctx, inst, eff) {
    const count = Math.max(1, Math.round(eff.amount));
    inst.activeCount = 0;
    for (let i = 0; i < count; i++) {
      const p = ctx.spawnProjectile();
      if (!p) break;
      p.kind = 'orbit';
      p.weaponSlot = inst.slot;
      p.orbitIndex = i;
      p.orbitPhase = (i / count) * Math.PI * 2;
      p.orbitRadius = ORBIT_RADIUS * eff.area;
      p.x = ctx.player.x + Math.cos(p.orbitPhase) * p.orbitRadius;
      p.y = ctx.player.y + Math.sin(p.orbitPhase) * p.orbitRadius;
      p.vx = 0;
      p.vy = 0;
      p.angle = p.orbitPhase;
      p.damage = eff.damage;
      p.knockback = eff.knockback;
      p.pierce = Infinity;
      p.ttlMs = eff.durationMs;
      p.radius = HIT_RADIUS * eff.area;
      p.scale = eff.area;
      p.hitSerials.length = 0;
      inst.activeCount++;
    }
    return 'hold';
  },

  onTick(ctx, inst, eff, dt) {
    let alive = 0;
    const cdTicks = hitCooldownTicks(eff.hitCooldownMs);
    const speed = REVS_PER_SEC * eff.speed * Math.PI * 2;
    const radius = ORBIT_RADIUS * eff.area;
    // The lean is decided once a tick for the whole ring, so the drones stay evenly spaced on it,
    // and eased: the nearest body changes every tick in a crowd, and a ring that snapped to it
    // jumped about instead of leaning, which measured a navigator standing in a crowd dying in
    // 29 s instead of 55.
    // Only towards a body the plain ring cannot already touch. Leaning towards one in contact
    // carries the drone past it, and a navigator standing in a crowd measured dying in 30 s
    // instead of 55 because the bodies on her were the ones the ring stopped hitting.
    const nearest = ctx.nearestEnemy(ctx.player.x, ctx.player.y, TILT_REACH * eff.area + radius);
    const touch = radius + HIT_RADIUS * eff.area;
    const near = nearest && Math.hypot(nearest.x - ctx.player.x, nearest.y - ctx.player.y) - nearest.radius > touch ? nearest : null;
    if (near) {
      const want = Math.atan2(near.y - ctx.player.y, near.x - ctx.player.x);
      let delta = want - inst.leanAngle;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      const turn = LEAN_TURN * dt;
      inst.leanAngle += Math.max(-turn, Math.min(turn, delta));
      inst.lean = Math.min(1, inst.lean + LEAN_RATE * dt);
    } else inst.lean = Math.max(0, inst.lean - LEAN_RATE * dt);
    const lean = inst.lean > 0;
    const leanA = inst.leanAngle;
    const major = radius * (1 + (TILT - 1) * inst.lean);

    ctx.forEachProjectile(inst.slot, (p) => {
      if (p.kind !== 'orbit') return;
      alive++;
      p.orbitPhase += speed * dt;
      p.orbitRadius = radius;
      if (lean) {
        // an ellipse with its long axis on the body: the point at phase, stretched along the lean
        const a = p.orbitPhase - leanA;
        const ex = Math.cos(a) * major;
        const ey = Math.sin(a) * radius;
        p.x = ctx.player.x + ex * Math.cos(leanA) - ey * Math.sin(leanA);
        p.y = ctx.player.y + ex * Math.sin(leanA) + ey * Math.cos(leanA);
      } else {
        p.x = ctx.player.x + Math.cos(p.orbitPhase) * radius;
        p.y = ctx.player.y + Math.sin(p.orbitPhase) * radius;
      }
      p.angle = p.orbitPhase + Math.PI / 2;

      const r = p.radius;
      const q = r + MAX_ENEMY_RADIUS;
      const n = ctx.queryEnemies(p.x - q, p.y - q, p.x + q, p.y + q, scratch);
      for (let i = 0; i < n; i++) {
        const e = ctx.enemyById(scratch[i]);
        if (!e.active || !e.def) continue;
        const rr = r + e.radius;
        const dx = e.x - p.x;
        const dy = e.y - p.y;
        if (dx * dx + dy * dy > rr * rr) continue;
        if (ctx.tick - inst.lastHitTick[e.id] < cdTicks) continue;
        inst.lastHitTick[e.id] = ctx.tick;
        const len = Math.hypot(dx, dy) || 1;
        ctx.hitEnemy(e, eff.damage, dx / len, dy / len, eff.knockback, inst);
      }
    });

    inst.activeCount = alive;
    if (alive === 0 && inst.cooldownLeft === Infinity) inst.cooldownLeft = eff.cooldownMs;
  },
};

const scratch = new Int32Array(ENEMY_CAP);
