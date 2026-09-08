import type { Enemy } from '../../sim/entities/enemy';

/** Walks straight at the player; knockback is integrated on top by the enemy system. */
export function chaseStep(e: Enemy, px: number, py: number, dt: number): void {
  const dx = px - e.x;
  const dy = py - e.y;
  const len = Math.hypot(dx, dy);
  if (len > 0.001) {
    const speed = e.def!.speed * e.speedMult;
    e.x += (dx / len) * speed * dt;
    e.y += (dy / len) * speed * dt;
    e.facing = Math.atan2(dy, dx);
  }
}
