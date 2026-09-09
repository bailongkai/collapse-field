import type { Enemy } from '../../sim/entities/enemy';
import type { Player } from '../../sim/entities/player';
import type { World } from '../../sim/world';
import { spawnEnemy } from '../../sim/systems/spawnSystem';
import { chaseStep } from './chase';

/**
 * 布雷艇: circles the player at a distance and leaves a mine behind every few seconds. The mines
 * are what matter; the ship itself only decides where they go, which is wherever the player was
 * about to be.
 */
export function layerStep(world: World, e: Enemy, player: Player, dt: number): void {
  const cfg = e.def!.layer;
  if (!cfg) return;
  const dx = player.x - e.x;
  const dy = player.y - e.y;
  const dist = Math.hypot(dx, dy) || 1;
  const speed = e.def!.speed * e.speedMult;
  if (dist > cfg.keepDistance * 1.15) chaseStep(e, player.x, player.y, dt);
  else if (dist < cfg.keepDistance * 0.85) {
    e.x -= (dx / dist) * speed * dt;
    e.y -= (dy / dist) * speed * dt;
  } else {
    // sidestep around the player; the sign is fixed per body so it does not jitter
    const side = e.id % 2 === 0 ? 1 : -1;
    e.x += (-dy / dist) * side * speed * dt;
    e.y += (dx / dist) * side * speed * dt;
    e.facing = Math.atan2(dy, dx);
  }
  e.aiTimer2 -= dt * 1000;
  if (e.aiTimer2 > 0) return;
  e.aiTimer2 = cfg.intervalMs;
  // a cap, so a layer that is never dealt with does not carpet the field
  let mines = 0;
  const alive = world.enemies.aliveList();
  for (let i = 0; i < world.enemies.count; i++) if (world.enemies.items[alive[i]].defId === cfg.mine) mines++;
  if (mines >= cfg.maxMines) return;
  spawnEnemy(world, cfg.mine, { x: e.x, y: e.y, dmgMult: e.dmgMult, hpMult: 1 });
}
