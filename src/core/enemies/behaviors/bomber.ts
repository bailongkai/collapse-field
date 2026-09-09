import type { Enemy } from '../../sim/entities/enemy';
import type { Player } from '../../sim/entities/player';
import type { World } from '../../sim/world';
import { chaseStep } from './chase';

const ARMED = 1;

/**
 * 自爆无人机 / 感应雷: closes in, and once inside its trigger range stops, flashes for the length of
 * its fuse, then detonates. The fuse is the whole design — a bomb with no warning is a tax, a bomb
 * with a warning is a decision about which way to run. A speed of zero makes it a mine.
 *
 * Detonation itself is resolved by the simulation, which owns player damage; this only says when.
 * Returns true on the tick the bomb goes off.
 */
export function bomberStep(e: Enemy, player: Player, dt: number): boolean {
  const cfg = e.def!.explode;
  if (!cfg) return false;
  const ms = dt * 1000;
  if (e.aiState === ARMED) {
    e.aiTimer -= ms;
    e.flashMs = 40;
    return e.aiTimer <= 0;
  }
  if (e.def!.speed > 0) chaseStep(e, player.x, player.y, dt);
  const dx = player.x - e.x;
  const dy = player.y - e.y;
  if (dx * dx + dy * dy > cfg.triggerRange * cfg.triggerRange) return false;
  e.aiState = ARMED;
  e.aiTimer = cfg.fuseMs;
  return false;
}

/** Whether the player is inside the blast. */
export function inBlast(e: Enemy, world: World): boolean {
  const cfg = e.def!.explode!;
  const dx = world.player.x - e.x;
  const dy = world.player.y - e.y;
  return dx * dx + dy * dy <= cfg.radius * cfg.radius;
}
