import type { Enemy } from '../../sim/entities/enemy';
import type { Player } from '../../sim/entities/player';
import type { World } from '../../sim/world';
import { spawnEnemy } from '../../sim/systems/spawnSystem';
import { chaseStep } from './chase';

const LOADING = 0;
const FIRING = 1;

/**
 * 曲射炮艇: stands off half a screen away and lobs shells onto the floor a little ahead of where
 * the player is walking. The shells are ordinary bomber bodies with an enormous trigger range, so
 * they arm on their first tick and flash for the whole fuse; killing one cancels it.
 *
 * It is the only attack in the game aimed at where the player is going rather than where they are,
 * and the only one that resolves on a clock instead of on a collision. Standing still to fight is
 * the answer it does not accept.
 */
export function mortarStep(world: World, e: Enemy, player: Player, dt: number): void {
  const cfg = e.def!.mortar;
  if (!cfg) return;
  const ms = dt * 1000;
  const dx = player.x - e.x;
  const dy = player.y - e.y;
  const d = Math.hypot(dx, dy) || 1;
  e.facing = Math.atan2(dy, dx);

  // it wants a firing distance: walks in from outside it, backs off when crowded
  if (d > cfg.standRange) chaseStep(e, player.x, player.y, dt);
  else if (d < cfg.retreatRange) {
    const s = e.def!.speed * e.speedMult * cfg.retreatSpeedMult;
    e.x -= (dx / d) * s * dt;
    e.y -= (dy / d) * s * dt;
  }

  if (e.aiState === LOADING) {
    e.aiTimer2 -= ms;
    if (e.aiTimer2 <= 0 && d <= cfg.standRange + 140) {
      e.aiState = FIRING;
      e.aiTimer = cfg.windupMs;
      e.aiTimer3 = cfg.salvo;
    }
    return;
  }

  // the barrel glows for the whole wind-up: the tell is on the gun, not on the ground
  e.aiTimer -= ms;
  e.flashMs = 40;
  if (e.aiTimer > 0) return;

  // shells are capped: they are bodies, and an uncapped barrage would starve the wave spawner
  let alive = 0;
  const list = world.enemies.aliveList();
  for (let i = 0; i < world.enemies.count; i++) if (world.enemies.items[list[i]].defId === cfg.shell) alive++;
  if (alive < cfg.maxShells) {
    const tx = player.x + player.inputX * cfg.leadPx + (world.rng.next() * 2 - 1) * cfg.spreadPx;
    const ty = player.y + player.inputY * cfg.leadPx + (world.rng.next() * 2 - 1) * cfg.spreadPx;
    spawnEnemy(world, cfg.shell, { x: tx, y: ty, dmgMult: e.dmgMult, hpMult: 1 });
  }
  e.aiTimer3 -= 1;
  if (e.aiTimer3 > 0) e.aiTimer = cfg.salvoGapMs;
  else {
    e.aiState = LOADING;
    e.aiTimer2 = cfg.intervalMs;
  }
}
