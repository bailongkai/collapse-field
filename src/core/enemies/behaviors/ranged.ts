import type { Enemy } from '../../sim/entities/enemy';
import type { Player } from '../../sim/entities/player';
import type { World } from '../../sim/world';
import { resetProjectileExtras } from '../../sim/entities/projectile';

/**
 * How long a shooter telegraphs before it fires: it stops strafing, flashes the way the rusher does
 * before its lunge, and announces the wind-up so the view can draw the aim. Bolts were the first
 * cause of death on four of eight stages for a kiting player and the one attack with no tell at
 * all; a spitter that has just walked into range used to fire on that very tick.
 */
export const RANGED_TELL_MS = 350;

/**
 * 酸液喷吐者: holds a distance from the player and spits on an interval. It advances when too far,
 * backs off when crowded, and strafes in between so it is never a stationary target — except for
 * the tell, when it plants its feet.
 */
export function rangedStep(world: World, e: Enemy, player: Player, dt: number): void {
  const cfg = e.def!.ranged;
  if (!cfg) return;
  const dx = player.x - e.x;
  const dy = player.y - e.y;
  const dist = Math.hypot(dx, dy) || 1;
  const nx = dx / dist;
  const ny = dy / dist;
  const speed = e.def!.speed * e.speedMult;
  e.facing = Math.atan2(dy, dx);
  const inRange = dist <= cfg.range + 60;

  // The shot clock only runs inside firing range, and is held just above a full tell outside it
  // and at spawn, so a shooter that arrives, or appears already in range, always crosses the tell
  // in view before its first bolt. aiState marks the arming; nothing else of the ranged body uses it.
  if (e.aiState === 0) {
    e.aiState = 1;
    e.aiTimer2 = Math.max(e.aiTimer2, RANGED_TELL_MS + 1);
  }
  if (!inRange) e.aiTimer2 = Math.max(e.aiTimer2, RANGED_TELL_MS + 1);
  // the clock runs before the feet, so the tick that crosses the tell is already a planted one
  const before = e.aiTimer2;
  if (inRange) e.aiTimer2 -= dt * 1000;
  if (before > RANGED_TELL_MS && e.aiTimer2 <= RANGED_TELL_MS) world.events.push('windup', e.x, e.y, e.id, e.defId);
  const telling = inRange && e.aiTimer2 <= RANGED_TELL_MS;
  if (telling) e.flashMs = 40;

  if (dist > cfg.range + 40) {
    e.x += nx * speed * dt;
    e.y += ny * speed * dt;
  } else if (telling) {
    // feet planted: the flash means something only if the body it is on has stopped
  } else if (dist < cfg.range - 70) {
    e.x -= nx * speed * 0.6 * dt;
    e.y -= ny * speed * 0.6 * dt;
  } else {
    // strafe: alternate direction per slot so a group does not all circle the same way
    const side = e.id % 2 === 0 ? 1 : -1;
    e.x += -ny * side * speed * 0.5 * dt;
    e.y += nx * side * speed * 0.5 * dt;
  }

  if (telling && e.aiTimer2 <= 0) {
    e.aiTimer2 = cfg.intervalMs;
    spawnHostileBolt(world, e, nx, ny, cfg.boltSpeed, cfg.boltDamage * e.dmgMult, (cfg.range * 1.6) / cfg.boltSpeed);
  }
}

/** Fires an enemy projectile from `e` along (nx, ny). Unused when the projectile pool is full. */
export function spawnHostileBolt(world: World, e: Enemy, nx: number, ny: number, speed: number, damage: number, ttlSec: number): void {
  const spawned = world.projectiles.spawn();
  const p = spawned ? resetProjectileExtras(spawned) : null;
  if (!p) return;
  p.hostile = true;
  p.source = e.defId;
  p.weaponSlot = -1;
  p.kind = 'bolt';
  p.x = e.x + nx * e.radius;
  p.y = e.y + ny * e.radius;
  p.vx = nx * speed;
  p.vy = ny * speed;
  p.angle = Math.atan2(ny, nx);
  p.radius = 9;
  p.damage = damage;
  p.knockback = 0;
  p.pierce = 0;
  p.ttlMs = ttlSec * 1000;
  p.scale = 1;
  p.hitSerials.length = 0;
  world.events.push('enemyShot', p.x, p.y, 0, e.defId);
}
