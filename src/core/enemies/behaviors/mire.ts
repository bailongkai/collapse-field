import type { Enemy } from '../../sim/entities/enemy';
import type { Player } from '../../sim/entities/player';

/**
 * 腐蚀池: not a spawn but a leaving — what a blighted body puts on the floor when it dies. It deals
 * no damage; it takes speed away from anyone standing in it, and it can be shot away.
 *
 * Where a thing is killed has never mattered in this game: corpses are free, so the best play is
 * to fight at contact and let bodies fall where they fall. A mire makes killing into terrain-making
 * and asks whether the ground is worth holding.
 *
 * Returns true when it has dried up and should be freed.
 */
export function mireStep(e: Enemy, player: Player, dt: number): boolean {
  const cfg = e.def!.mire;
  if (!cfg) return false;
  const ms = dt * 1000;
  e.ageMs += ms;
  if (e.ageMs >= cfg.ttlMs) return true;
  // thinning out, so the last second is visible rather than a surprise
  if (e.ageMs >= cfg.ttlMs - cfg.fadeMs && e.ageMs % 300 < 60) e.flashMs = 30;

  const dx = player.x - e.x;
  const dy = player.y - e.y;
  if (dx * dx + dy * dy > cfg.radius * cfg.radius) return false;
  // the strongest pool wins rather than the pools adding up: corpses cluster, and a sum would make
  // two overlapping pools a death sentence instead of a decision
  player.drag = Math.max(player.drag, cfg.dragPxPerSec);
  return false;
}
