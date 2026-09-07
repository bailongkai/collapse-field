import { MAX_ENEMY_RADIUS } from '../../../config';
import { pointInOrientedRect } from '../../math';
import type { World } from '../world';
import type { Enemy } from '../entities/enemy';
import type { Projectile } from '../entities/projectile';

export type DamageFn = (e: Enemy, dmg: number, dirX: number, dirY: number, knockback: number) => void;
export type HurtPlayerFn = (raw: number, sourceId: string) => void;

const PLAYER_RADIUS = 16;

/**
 * Moves projectiles, resolves their hits and recycles them. Each projectile remembers the enemy
 * serials it has already hit, so one bolt cannot hit the same enemy twice while several bolts of
 * the same volley can each hit it once.
 */
export function stepProjectiles(world: World, dtMs: number, damage: DamageFn, hurtPlayer: HurtPlayerFn): void {
  const dt = dtMs / 1000;
  world.projectiles.forEach((p) => {
    if (p.kind === 'bolt') {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    p.ttlMs -= dtMs;

    if (p.hostile) resolveHostile(world, p, hurtPlayer);
    else if (p.kind === 'slash') resolveSlash(world, p, damage);
    else if (p.kind === 'bolt') resolveBolt(world, p, damage);

    if (p.ttlMs <= 0 || p.pierce < 0) {
      p.hitSerials.length = 0;
      p.hostile = false;
      world.projectiles.free(p);
    }
  });
}

/** Enemy fire: one hit on the player ends the bolt; it never touches enemies. */
function resolveHostile(world: World, p: Projectile, hurtPlayer: HurtPlayerFn): void {
  const pl = world.player;
  const rr = p.radius + PLAYER_RADIUS;
  const dx = pl.x - p.x;
  const dy = pl.y - p.y;
  if (dx * dx + dy * dy > rr * rr) return;
  hurtPlayer(p.damage, 'bolt');
  p.pierce = -1; // recycled by the caller
}

function resolveSlash(world: World, p: Projectile, damage: DamageFn): void {
  // the sweep lands once, on the tick it appears; afterwards it is only a visual
  if (p.hitSerials.length > 0 || p.rectLen <= 0) return;
  const reach = p.rectLen + p.rectWidth + MAX_ENEMY_RADIUS;
  const n = world.grid.queryInto(p.x - reach, p.y - reach, p.x + reach, p.y + reach, world.queryBuf);
  const dirX = Math.cos(p.angle);
  const dirY = Math.sin(p.angle);
  let hits = 0;
  for (let i = 0; i < n; i++) {
    const e = world.enemies.items[world.queryBuf[i]];
    if (!e.active || !e.def) continue;
    // the body's radius extends the sweep in both axes: the width already allowed for it, the
    // length did not, so a large enemy could straddle the tip of the blade untouched
    if (!pointInOrientedRect(e.x, e.y, p.x, p.y, p.angle, p.rectLen + e.radius, p.rectWidth + e.radius * 2)) continue;
    p.hitSerials.push(e.serial);
    damage(e, p.damage, dirX, dirY, p.knockback);
    hits++;
  }
  // mark the sweep as resolved even when it hit nothing
  if (hits === 0) p.hitSerials.push(-1);
}

function resolveBolt(world: World, p: Projectile, damage: DamageFn): void {
  const r = p.radius;
  const pad = r + MAX_ENEMY_RADIUS;
  const n = world.grid.queryInto(p.x - pad, p.y - pad, p.x + pad, p.y + pad, world.queryBuf2);
  for (let i = 0; i < n; i++) {
    const e = world.enemies.items[world.queryBuf2[i]];
    if (!e.active || !e.def) continue;
    if (p.hitSerials.includes(e.serial)) continue;
    const rr = r + e.radius;
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    if (dx * dx + dy * dy > rr * rr) continue;
    p.hitSerials.push(e.serial);
    const len = Math.hypot(p.vx, p.vy) || 1;
    damage(e, p.damage, p.vx / len, p.vy / len, p.knockback);
    p.pierce -= 1;
    if (p.pierce < 0) return;
  }
}
