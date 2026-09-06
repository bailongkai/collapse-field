import { GEM_COLLECT_RADIUS, MAGNET_BASE_RADIUS } from '../../../config';
import type { PlayerStats } from '../../../data/types';
import type { World } from '../world';
import { nearestGem } from './dropSystem';

const MAGNET_BASE_SPEED = 120;
const MAGNET_ACCEL = 1400;
const MAGNET_MAX_SPEED = 2400;

export interface GemHarvest {
  /** raw XP collected this step, before the growth multiplier */
  xp: number;
}

/**
 * Magnet, collection and out-of-reach folding. A gem inside the magnet radius hesitates then snaps
 * to the player on an accelerating curve; a gem left far behind folds its value into the nearest
 * gem instead of stranding that XP forever.
 */
export function stepGems(world: World, stats: PlayerStats, dt: number, farRadius: number): GemHarvest {
  const p = world.player;
  const magnetRadius = MAGNET_BASE_RADIUS * stats.magnet;
  const magnet2 = magnetRadius * magnetRadius;
  const collect2 = GEM_COLLECT_RADIUS * GEM_COLLECT_RADIUS;
  const far2 = farRadius * farRadius;
  let xp = 0;

  world.gems.forEach((g) => {
    const dx = p.x - g.x;
    const dy = p.y - g.y;
    const d2 = dx * dx + dy * dy;

    if (!g.attracted) {
      if (d2 <= magnet2) {
        g.attracted = true;
        g.t = 0;
      } else if (d2 > far2) {
        const target = nearestGem(world, p.x, p.y);
        if (target && target !== g) {
          target.value += g.value;
          target.tier = 'merged';
          world.gems.free(g);
        }
        return;
      }
    }

    if (!g.attracted) return;

    g.t += dt;
    const speed = Math.min(MAGNET_BASE_SPEED + MAGNET_ACCEL * g.t * g.t, MAGNET_MAX_SPEED);
    const d = Math.sqrt(d2) || 1;
    g.x += (dx / d) * speed * dt;
    g.y += (dy / d) * speed * dt;

    if (d2 <= collect2 || d <= speed * dt) {
      xp += g.value;
      world.events.push('gem', g.x, g.y, g.value, g.tier);
      world.gems.free(g);
    }
  });

  return { xp };
}

/** Marks every gem as attracted; used by the magnet pickup. */
export function vacuumGems(world: World): number {
  let n = 0;
  world.gems.forEach((g) => {
    if (!g.attracted) {
      g.attracted = true;
      g.t = 0;
    }
    n++;
  });
  return n;
}
