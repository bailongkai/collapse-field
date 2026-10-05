import { MAX_ENEMY_RADIUS } from '../../../config';
import { pointInOrientedRect } from '../../math';
import type { World } from '../world';
import type { Enemy } from '../entities/enemy';
import { resetProjectileExtras, type Projectile } from '../entities/projectile';
import { VERB_TUNING } from '../../../data/verbs';

export type DamageFn = (e: Enemy, dmg: number, dirX: number, dirY: number, knockback: number, slot?: number) => void;
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
    // a 回旋 return or a 回波 echo waits, unseen and harmless, and then comes from where she is
    if (p.delayMs > 0) {
      p.delayMs -= dtMs;
      if (p.delayMs > 0) return;
      if (p.anchored) {
        p.x = world.player.x + p.anchorDx;
        p.y = world.player.y + p.anchorDy;
      }
    }
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
      resetProjectileExtras(p);
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
  hurtPlayer(p.damage, p.source || 'bolt');
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
    damage(e, p.damage, dirX, dirY, p.knockback, p.weaponSlot);
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
    const serial = e.serial;
    const ex = e.x;
    const ey = e.y;
    damage(e, p.damage, p.vx / len, p.vy / len, p.knockback, p.weaponSlot);
    // 分裂: a bolt that killed throws splinters from where the body was and keeps its own
    // pierce. Spending the bolt on the split made the verb a loss on a piercing weapon: the lance's
    // five bodies became one plus a fan of half-damage splinters.
    if (p.splits > 0 && (!e.active || e.serial !== serial)) splitBolt(world, p, ex, ey, serial);
    p.pierce -= 1;
    if (p.pierce < 0) {
      // 跳弹: a round with no pierce left turns once more towards the nearest body it has not hit
      if (p.bounces > 0) ricochet(world, p);
      return;
    }
  }
}

/** The splinters of a 分裂 bolt: fanned about its heading, half its damage each, no further split. */
function splitBolt(world: World, p: Projectile, x: number, y: number, killed: number): void {
  const n = p.splits;
  const heading = Math.atan2(p.vy, p.vx);
  const speed = Math.hypot(p.vx, p.vy);
  const spread = VERB_TUNING.aimed.spreadRad;
  for (let i = 0; i < n; i++) {
    const c = world.projectiles.spawn();
    if (!c) return;
    resetProjectileExtras(c);
    const a = heading + (n === 1 ? 0 : (i / (n - 1) - 0.5) * 2 * spread);
    c.kind = 'bolt';
    c.hostile = false;
    c.weaponSlot = p.weaponSlot;
    c.x = x;
    c.y = y;
    c.vx = Math.cos(a) * speed;
    c.vy = Math.sin(a) * speed;
    c.angle = a;
    c.damage = p.damage * VERB_TUNING.aimed.scale;
    c.knockback = p.knockback;
    c.pierce = 0;
    c.ttlMs = 700;
    c.radius = p.radius * 0.8;
    c.scale = p.scale * 0.8;
    c.source = '';
    c.hitSerials.length = 0;
    c.hitSerials.push(killed);
  }
}

/** Turns a spent round towards the nearest body within reach that it has not hit, if there is one. */
function ricochet(world: World, p: Projectile): void {
  const reach = VERB_TUNING.stream.reach;
  const q = reach + MAX_ENEMY_RADIUS;
  const n = world.grid.queryInto(p.x - q, p.y - q, p.x + q, p.y + q, world.queryBuf2);
  let best: Enemy | null = null;
  let bestD = reach * reach;
  for (let i = 0; i < n; i++) {
    const e = world.enemies.items[world.queryBuf2[i]];
    if (!e.active || !e.def || e.def.invulnerable || e.def.behavior === 'mire') continue;
    if (p.hitSerials.includes(e.serial)) continue;
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  if (!best) return;
  const speed = Math.hypot(p.vx, p.vy);
  const dx = best.x - p.x;
  const dy = best.y - p.y;
  const len = Math.hypot(dx, dy) || 1;
  p.vx = (dx / len) * speed;
  p.vy = (dy / len) * speed;
  p.angle = Math.atan2(dy, dx);
  p.pierce = 0;
  p.bounces--;
  p.turned++;
  p.ttlMs = Math.max(p.ttlMs, (reach / Math.max(1, speed)) * 1000 + 100);
  world.events.push('verbBurst', p.x, p.y, 0, 'stream');
}
