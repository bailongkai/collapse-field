import type { Enemy } from '../../sim/entities/enemy';
import type { Player } from '../../sim/entities/player';
import type { World } from '../../sim/world';

/**
 * 拾荒者: it never comes for the player. It runs the other way, eating experience gems off the
 * floor, and after its timer it leaves the field with everything it swallowed.
 *
 * Every other body is a problem that arrives, so the whole game can be played by retreating. This
 * one can only be answered by going after it, and ignoring it has a price rather than a risk. It
 * attacks the run's economy instead of its health.
 */
export function scavengerStep(world: World, e: Enemy, player: Player, dt: number): boolean {
  const cfg = e.def!.scavenge;
  if (!cfg) return false;
  const ms = dt * 1000;
  e.ageMs += ms;
  // the last second before it goes is visible, so leaving is a thing the player watched happen
  if (e.ageMs >= cfg.escapeMs - cfg.escapeTellMs) e.flashMs = 40;
  if (e.ageMs >= cfg.escapeMs) return true;

  if (e.aiTimer > 0) {
    // swallowing: it stands still, which is the window that makes the chase winnable
    e.aiTimer -= ms;
    return false;
  }

  e.aiTimer2 -= ms;
  if (e.aiTimer2 <= 0) {
    e.aiTimer2 = cfg.scanMs;
    let bestD2 = cfg.seekRange * cfg.seekRange;
    let bestX = 0;
    let bestY = 0;
    let found = false;
    const gems = world.gems.items;
    for (let i = 0; i < gems.length; i++) {
      const g = gems[i];
      // a merged gem can be worth a level on its own; swallowing one would be a disaster with no
      // feedback, so it only ever takes the small ones
      if (!g.active || g.value > cfg.maxGemValue) continue;
      const gx = g.x - e.x;
      const gy = g.y - e.y;
      const d2 = gx * gx + gy * gy;
      if (d2 <= cfg.eatRadius * cfg.eatRadius && e.aiState < cfg.gemsMax) {
        world.gems.free(g);
        e.aiState++;
        e.flashMs = 60;
        e.aiTimer = cfg.eatPauseMs;
        return false;
      }
      if (d2 < bestD2) {
        bestD2 = d2;
        bestX = g.x;
        bestY = g.y;
        found = true;
      }
    }
    if (found) {
      const d = Math.sqrt(bestD2) || 1;
      e.dirX = (bestX - e.x) / d;
      e.dirY = (bestY - e.y) / d;
    } else {
      e.dirX = 0;
      e.dirY = 0;
    }
  }

  const dx = e.x - player.x;
  const dy = e.y - player.y;
  const d = Math.hypot(dx, dy) || 1;
  const fleeing = d < cfg.fleeRange || e.aiState >= cfg.gemsMax;
  // away from the player, still drifting towards food
  const hx = fleeing ? (dx / d) * 0.7 + e.dirX * 0.3 : e.dirX;
  const hy = fleeing ? (dy / d) * 0.7 + e.dirY * 0.3 : e.dirY;
  const len = Math.hypot(hx, hy);
  if (len > 1e-4) {
    const s = e.def!.speed * e.speedMult * (fleeing ? cfg.fleeSpeedMult : 1);
    e.x += (hx / len) * s * dt;
    e.y += (hy / len) * s * dt;
    e.facing = Math.atan2(hy, hx);
  }
  return false;
}
