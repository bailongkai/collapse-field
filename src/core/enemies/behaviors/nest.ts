import type { Enemy } from '../../sim/entities/enemy';
import type { World } from '../../sim/world';
import { spawnRing } from '../../sim/systems/spawnSystem';

/**
 * 孵化囊: does not move at all, and hatches a clutch on a timer for as long as it stands. The lab
 * is a stage about numbers; this is where the numbers come from, and it is the one thing there the
 * player has to go to rather than wait for.
 */
export function nestStep(world: World, e: Enemy, dt: number): void {
  const cfg = e.def!.nest;
  if (!cfg) return;
  e.aiTimer2 -= dt * 1000;
  if (e.aiTimer2 > 0) return;
  e.aiTimer2 = cfg.intervalMs;
  e.flashMs = 60;
  spawnRing(world, cfg.summon, cfg.count, e.radius + 24, { x: e.x, y: e.y, hpMult: 1, dmgMult: e.dmgMult, speedMult: e.speedMult });
}
