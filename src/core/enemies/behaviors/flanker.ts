import type { Enemy } from '../../sim/entities/enemy';
import type { Player } from '../../sim/entities/player';

const ARC_ABOVE = 1;
const ARC_BELOW = 2;
const HOVER_ABOVE = 3;
const HOVER_BELOW = 4;
const DIVE = 5;
const RECOVER = 6;

/**
 * 侧翼猎手: it refuses to come straight in. It swings wide, lines up directly above or below the
 * player just outside the blade's band, hangs there flashing, then drops straight down the one
 * axis the game's weapons do not cover, and pulls out to go round again.
 *
 * The character faces left or right and the blade sweeps a horizontal band, so a body overhead is
 * a body the blade passes over. This is the first enemy that reads the shape of the player's
 * weapons rather than their position; the counter is one deliberate sideways press.
 */
export function flankerStep(e: Enemy, player: Player, dt: number): void {
  const cfg = e.def!.flank;
  if (!cfg) return;
  const ms = dt * 1000;
  if (e.aiState === 0) e.aiState = e.y <= player.y ? ARC_ABOVE : ARC_BELOW;
  const side = e.aiState === ARC_ABOVE || e.aiState === HOVER_ABOVE ? -1 : 1;
  // five lanes off the slot id, so a group does not stack into one unreadable blob
  const lane = player.x + ((e.id % 5) - 2) * cfg.columnJitterPx;
  const tx = lane;
  const ty = player.y + side * cfg.hoverRange;

  switch (e.aiState) {
    case ARC_ABOVE:
    case ARC_BELOW: {
      const dx = tx - e.x;
      const dy = ty - e.y;
      const d = Math.hypot(dx, dy) || 1;
      const s = e.def!.speed * e.speedMult * cfg.arcSpeedMult;
      e.x += (dx / d) * s * dt;
      e.y += (dy / d) * s * dt;
      e.facing = Math.atan2(dy, dx);
      if (d < 26 && Math.abs(e.x - lane) < cfg.columnHalfWidth) {
        e.aiState += 2;
        e.aiTimer = cfg.settleMs;
      }
      return;
    }
    case HOVER_ABOVE:
    case HOVER_BELOW: {
      // it flashes for the whole settle: the dive is faster than the player, so the warning is
      // the entire fairness argument
      e.aiTimer -= ms;
      e.flashMs = 40;
      const k = Math.min(1, 6 * dt);
      e.x += (tx - e.x) * k;
      e.y += (ty - e.y) * k;
      if (e.aiTimer <= 0) {
        e.dirX = 0;
        e.dirY = -side;
        e.aiState = DIVE;
        e.aiTimer = cfg.diveMs;
        e.facing = Math.atan2(e.dirY, e.dirX);
      }
      return;
    }
    case DIVE: {
      e.aiTimer -= ms;
      const s = e.def!.speed * e.speedMult * cfg.diveSpeedMult;
      e.x += e.dirX * s * dt;
      e.y += e.dirY * s * dt;
      if (e.aiTimer <= 0) {
        e.aiState = RECOVER;
        e.aiTimer = cfg.recoverMs;
      }
      return;
    }
    default: {
      e.aiTimer -= ms;
      const s = e.def!.speed * e.speedMult * 0.5;
      e.x -= e.dirX * s * dt;
      e.y -= e.dirY * s * dt;
      if (e.aiTimer <= 0) e.aiState = e.y <= player.y ? ARC_ABOVE : ARC_BELOW;
    }
  }
}
