import type { Enemy } from '../../sim/entities/enemy';
import type { Player } from '../../sim/entities/player';
import { chaseStep } from './chase';

/**
 * 牵引车: holds its distance and drags the player towards itself. It does no damage of its own;
 * what it does is take the choice of where to stand away for as long as it lives, which on a deck
 * full of slow, heavy bodies is the most dangerous thing on it.
 */
export function tractorStep(e: Enemy, player: Player, dt: number): void {
  const cfg = e.def!.tractor;
  if (!cfg) return;
  const dx = player.x - e.x;
  const dy = player.y - e.y;
  const dist = Math.hypot(dx, dy) || 1;
  if (dist > cfg.keepDistance) chaseStep(e, player.x, player.y, dt);
  else e.facing = Math.atan2(dy, dx);
  if (dist > cfg.range) return;
  // the pull weakens with distance so the edge of the beam is an invitation, not a wall
  const strength = cfg.pull * (1 - dist / cfg.range) * e.speedMult;
  player.x -= (dx / dist) * strength * dt;
  player.y -= (dy / dist) * strength * dt;
  e.flashMs = 30;
}
