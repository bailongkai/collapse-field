import { MAGNET_BASE_RADIUS } from '../../../config';
import type { PickupDef, PlayerStats } from '../../../data/types';
import { pickupDef } from '../../content/registry';
import type { Rng } from '../../rng';
import type { Enemy } from '../entities/enemy';
import type { World } from '../world';

const PICKUP_MAGNET_SCALE = 0.8;

export interface PickupCollected {
  def: PickupDef;
  x: number;
  y: number;
}

/** Places a pickup on the ground; returns false when the pool or the ground limit is full. */
export function spawnPickup(world: World, defId: string, x: number, y: number): boolean {
  const def = pickupDef(defId);
  if (def.maxOnGround !== undefined) {
    let onGround = 0;
    const alive = world.pickups.aliveList();
    for (let i = 0; i < world.pickups.count; i++) {
      if (world.pickups.items[alive[i]].defId === defId) onGround++;
    }
    if (onGround >= def.maxOnGround) return false;
  }
  const p = world.pickups.spawn();
  if (!p) return false;
  p.defId = defId;
  p.x = x;
  p.y = y;
  p.radius = def.radius;
  p.attracted = false;
  return true;
}

/** Rolls this enemy's drops: its own table first, then the generic per-kill chances scaled by luck. */
export function rollDrops(world: World, e: Enemy, rng: Rng, luck: number, generic: readonly PickupDef[]): void {
  for (const drop of e.def?.drops ?? []) {
    if (rng.next() < drop.chance) spawnPickup(world, drop.pickup, e.x, e.y);
  }
  for (const def of generic) {
    if (def.dropChance <= 0) continue;
    if (rng.next() < def.dropChance * luck) spawnPickup(world, def.id, e.x, e.y);
  }
}

/** Moves magnetic pickups toward the player and reports the ones collected this step. */
export function stepPickups(world: World, stats: PlayerStats, dt: number, out: PickupCollected[]): void {
  out.length = 0;
  const p = world.player;
  const magnet = MAGNET_BASE_RADIUS * stats.magnet * PICKUP_MAGNET_SCALE;
  const magnet2 = magnet * magnet;

  world.pickups.forEach((item) => {
    const def = pickupDef(item.defId);
    const dx = p.x - item.x;
    const dy = p.y - item.y;
    const d2 = dx * dx + dy * dy;

    if (def.magnetic) {
      if (!item.attracted && d2 <= magnet2) item.attracted = true;
      if (item.attracted) {
        const d = Math.sqrt(d2) || 1;
        const speed = 420;
        item.x += (dx / d) * speed * dt;
        item.y += (dy / d) * speed * dt;
      }
    }

    const reach = item.radius + 18;
    if (d2 <= reach * reach) {
      out.push({ def, x: item.x, y: item.y });
      world.pickups.free(item);
    }
  });
}
