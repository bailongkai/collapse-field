import type { Enemy } from '../../sim/entities/enemy';
import type { Player } from '../../sim/entities/player';
import type { World } from '../../sim/world';

/**
 * 酸液喷吐者: holds a distance from the player and spits on an interval. It advances when too far,
 * backs off when crowded, and strafes in between so it is never a stationary target.
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

  if (dist > cfg.range + 40) {
    e.x += nx * speed * dt;
    e.y += ny * speed * dt;
  } else if (dist < cfg.range - 70) {
    e.x -= nx * speed * 0.6 * dt;
    e.y -= ny * speed * 0.6 * dt;
  } else {
    // strafe: alternate direction per slot so a group does not all circle the same way
    const side = e.id % 2 === 0 ? 1 : -1;
    e.x += -ny * side * speed * 0.5 * dt;
    e.y += nx * side * speed * 0.5 * dt;
  }

  e.aiTimer2 -= dt * 1000;
  if (e.aiTimer2 <= 0 && dist <= cfg.range + 60) {
    e.aiTimer2 = cfg.intervalMs;
    spawnHostileBolt(world, e, nx, ny, cfg.boltSpeed, cfg.boltDamage * e.dmgMult, (cfg.range * 1.6) / cfg.boltSpeed);
  }
}

/** Fires an enemy projectile from `e` along (nx, ny). Unused when the projectile pool is full. */
export function spawnHostileBolt(world: World, e: Enemy, nx: number, ny: number, speed: number, damage: number, ttlSec: number): void {
  const p = world.projectiles.spawn();
  if (!p) return;
  p.hostile = true;
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
