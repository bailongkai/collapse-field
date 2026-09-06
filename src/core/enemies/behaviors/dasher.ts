import type { Enemy } from '../../sim/entities/enemy';
import type { Player } from '../../sim/entities/player';
import { chaseStep } from './chase';

const CHASE = 0;
const TELEGRAPH = 1;
const DASH = 2;

/**
 * 突袭者: closes in like any chaser, then stops, flashes for half a second and lunges along the
 * line it froze on. The telegraph is the whole point: a lunge with no warning is not dodgeable.
 */
export function dasherStep(e: Enemy, player: Player, dt: number): void {
  const cfg = e.def!.dash;
  if (!cfg) return;
  const ms = dt * 1000;
  switch (e.aiState) {
    case TELEGRAPH:
      e.aiTimer -= ms;
      e.flashMs = 40; // keep the white flash on for the whole warning
      if (e.aiTimer <= 0) {
        e.aiState = DASH;
        e.aiTimer = cfg.durationMs;
      }
      return;
    case DASH: {
      e.aiTimer -= ms;
      const speed = e.def!.speed * cfg.speedMult;
      e.x += e.dirX * speed * dt;
      e.y += e.dirY * speed * dt;
      if (e.aiTimer <= 0) {
        e.aiState = CHASE;
        e.aiTimer2 = cfg.cooldownMs;
      }
      return;
    }
    default: {
      e.aiTimer2 -= ms;
      chaseStep(e, player.x, player.y, dt);
      if (e.aiTimer2 > 0) return;
      const dx = player.x - e.x;
      const dy = player.y - e.y;
      const dist = Math.hypot(dx, dy);
      if (dist > cfg.triggerRange || dist < 1) return;
      e.dirX = dx / dist;
      e.dirY = dy / dist;
      e.facing = Math.atan2(dy, dx);
      e.aiState = TELEGRAPH;
      e.aiTimer = cfg.telegraphMs;
    }
  }
}
