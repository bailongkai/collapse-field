import { ENEMY_CAP } from '../../../config';
import { hitCooldownTicks } from '../../sim/systems/weaponSystem';
import type { WeaponBehavior } from '../types';

const ORBIT_RADIUS = 90;
const HIT_RADIUS = 14;
const REVS_PER_SEC = 1;

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

    ctx.forEachProjectile(inst.slot, (p) => {
      if (p.kind !== 'orbit') return;
      alive++;
      p.orbitPhase += speed * dt;
      p.orbitRadius = ORBIT_RADIUS * eff.area;
      p.x = ctx.player.x + Math.cos(p.orbitPhase) * p.orbitRadius;
      p.y = ctx.player.y + Math.sin(p.orbitPhase) * p.orbitRadius;
      p.angle = p.orbitPhase + Math.PI / 2;

      const r = p.radius;
      const n = ctx.queryEnemies(p.x - r, p.y - r, p.x + r, p.y + r, scratch);
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
