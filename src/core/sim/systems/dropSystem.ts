import type { GemTier } from '../../../data/types';
import type { Enemy } from '../entities/enemy';
import type { World } from '../world';

export const GEM_VALUE: Record<Exclude<GemTier, 'none'>, number> = { blue: 1, green: 3, red: 5 };

/** Spawns the XP gem(s) a dying enemy leaves behind. Pickup rolls land with the pickup system. */
export function dropForEnemy(world: World, e: Enemy, gemCap: number): void {
  const def = e.def;
  if (!def || def.gemTier === 'none') return;
  const value = GEM_VALUE[def.gemTier];
  const count = def.gemCount ?? 1;
  for (let i = 0; i < count; i++) {
    const angle = count === 1 ? 0 : (i / count) * Math.PI * 2;
    const r = count === 1 ? 0 : 40;
    spawnGem(world, e.x + Math.cos(angle) * r, e.y + Math.sin(angle) * r, value, def.gemTier, gemCap);
  }
}

/**
 * Adds a gem, or folds its value into the gem nearest the player once the cap is reached, so late
 * game XP is never lost to a full pool and the merged gem is always somewhere reachable.
 */
export function spawnGem(world: World, x: number, y: number, value: number, tier: Exclude<GemTier, 'none'>, gemCap: number): void {
  if (world.gems.count >= gemCap || world.gems.isFull) {
    const target = nearestGem(world, world.player.x, world.player.y);
    if (target) {
      target.value += value;
      target.tier = 'merged';
      return;
    }
  }
  const g = world.gems.spawn();
  if (!g) return;
  g.x = x;
  g.y = y;
  g.value = value;
  g.tier = tier;
  g.attracted = false;
  g.t = 0;
  world.events.push('gem', x, y, value, tier);
}

export function nearestGem(world: World, x: number, y: number) {
  const alive = world.gems.aliveList();
  let best = null;
  let bestD = Infinity;
  for (let i = 0; i < world.gems.count; i++) {
    const g = world.gems.items[alive[i]];
    const dx = g.x - x;
    const dy = g.y - y;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = g;
    }
  }
  return best;
}
