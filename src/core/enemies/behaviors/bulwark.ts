import type { Enemy } from '../../sim/entities/enemy';
import type { Player } from '../../sim/entities/player';
import { chaseStep } from './chase';

/**
 * 盾卫: keeps a shield pointed at the player and walks the way it points, turning at a fixed rate.
 * Hits landing inside its front arc barely scratch it, so the answer is an angle rather than a
 * distance: circling close out-turns it, circling far does not. It is the one body in the game for
 * which standing next to it is safer than standing away from it.
 *
 * The damage reduction itself lives in `Simulation.damageEnemy`, which owns damage.
 */
export function bulwarkStep(e: Enemy, player: Player, dt: number): void {
  const cfg = e.def!.bulwark;
  if (!cfg) return;
  const want = Math.atan2(player.y - e.y, player.x - e.x);
  let delta = want - e.facing;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  const max = ((cfg.turnDegPerSec * Math.PI) / 180) * dt;
  e.facing += Math.max(-max, Math.min(max, delta));

  if (cfg.walkFacing) {
    // it walks where it points, so a flanked one blunders past instead of tracking the player
    const s = e.def!.speed * e.speedMult;
    e.x += Math.cos(e.facing) * s * dt;
    e.y += Math.sin(e.facing) * s * dt;
  } else {
    chaseStep(e, player.x, player.y, dt);
  }

  // a pulse whenever it is squarely on the player: the "you are in front of it" tell
  e.aiTimer2 -= dt * 1000;
  if (Math.abs(delta) < 0.15 && e.aiTimer2 <= 0) {
    e.flashMs = 30;
    e.aiTimer2 = cfg.tellEveryMs;
  }
}

/** How much of a hit lands, given where it came from. 1 means the shield is not in the way. */
export function bulwarkScale(e: Enemy, dirX: number, dirY: number): number {
  const cfg = e.def?.bulwark;
  if (!cfg) return 1;
  // dir points attacker -> enemy; facing points enemy -> player. A hit from the front opposes it.
  const f = dirX * Math.cos(e.facing) + dirY * Math.sin(e.facing);
  return f <= -Math.cos((cfg.arcDeg * Math.PI) / 360) ? cfg.frontScale : 1;
}
