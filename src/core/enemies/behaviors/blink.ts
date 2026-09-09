import type { Enemy } from '../../sim/entities/enemy';
import type { Player } from '../../sim/entities/player';
import type { World } from '../../sim/world';
import { chaseStep } from './chase';

const CHASE = 0;
const FADING = 1;

/**
 * 相位艇: chases, then on a timer flashes out and reappears a fixed distance from the player in a
 * random direction — behind them as often as not. The orbit is the stage where running does not
 * work, and this is the enemy that makes the point without needing to be fast.
 */
export function blinkStep(world: World, e: Enemy, player: Player, dt: number): void {
  const cfg = e.def!.blink;
  if (!cfg) return;
  const ms = dt * 1000;
  if (e.aiState === FADING) {
    e.aiTimer -= ms;
    e.flashMs = 40;
    if (e.aiTimer > 0) return;
    const a = world.rng.next() * Math.PI * 2;
    e.x = player.x + Math.cos(a) * cfg.distance;
    e.y = player.y + Math.sin(a) * cfg.distance;
    e.kbx = 0;
    e.kby = 0;
    e.aiState = CHASE;
    e.aiTimer2 = cfg.everyMs;
    world.events.push('telegraph', e.x, e.y, 0, e.defId, false);
    return;
  }
  chaseStep(e, player.x, player.y, dt);
  e.aiTimer2 -= ms;
  if (e.aiTimer2 > 0) return;
  e.aiState = FADING;
  e.aiTimer = cfg.telegraphMs;
}
