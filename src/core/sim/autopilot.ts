import type { World } from './world';
import { setPlayerInput } from './systems/playerSystem';

/**
 * A hands-off player for the balance harness: back off only when something is about to touch you,
 * otherwise go and collect the nearest gem, otherwise drift in a slow circle so fresh enemies keep
 * walking into the weapons.
 *
 * The two obvious simpler policies both measure nothing. A motionless player dies in thirty
 * seconds to any wave table, and a player who simply flees outruns every chase enemy and ends a
 * ten-minute run at level one with two kills.
 */
export function driveAutopilot(world: World, tick: number): void {
  const p = world.player;

  // 1. back off only from a real crowd. Fleeing from every single enemy is self-defeating: facing
  //    follows movement, so a fleeing player swings the blade into empty space and outruns a horde
  //    that is slower than they are, ending a long run with a handful of kills.
  const danger = 90;
  const near = world.grid.queryInto(p.x - danger, p.y - danger, p.x + danger, p.y + danger, world.queryBuf);
  let awayX = 0;
  let awayY = 0;
  let threats = 0;
  for (let i = 0; i < near; i++) {
    const e = world.enemies.items[world.queryBuf[i]];
    if (!e.active) continue;
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < 1 || d2 > danger * danger) continue;
    const w = 1 / d2;
    awayX += dx * w;
    awayY += dy * w;
    threats++;
  }
  const lowHealth = p.hp < 35;
  if (threats >= 3 || (threats > 0 && lowHealth)) {
    const len = Math.hypot(awayX, awayY) || 1;
    setPlayerInput(p, awayX / len, awayY / len);
    return;
  }

  // 2. a gem close by is worth a detour
  const gem = nearestGem(world, 250);
  if (gem) {
    setPlayerInput(p, gem.x, gem.y);
    return;
  }

  // 3. otherwise walk at the nearest enemy, which also turns the blade towards it
  const enemy = world.nearestEnemy(p.x, p.y, 600);
  if (enemy) {
    const dx = enemy.x - p.x;
    const dy = enemy.y - p.y;
    const len = Math.hypot(dx, dy) || 1;
    setPlayerInput(p, dx / len, dy / len);
    return;
  }

  // 4. nothing near: fetch a farther gem, or drift so fresh enemies keep walking into the weapons
  const far = nearestGem(world, 900);
  if (far) {
    setPlayerInput(p, far.x, far.y);
    return;
  }
  const angle = (tick / 60) * 0.5;
  setPlayerInput(p, Math.cos(angle), Math.sin(angle));
}

/** Direction to the nearest gem within `maxDist`, or null. */
function nearestGem(world: World, maxDist: number): { x: number; y: number } | null {
  const p = world.player;
  let bestX = 0;
  let bestY = 0;
  let bestD2 = maxDist * maxDist;
  let found = false;
  const gems = world.gems.aliveList();
  for (let i = 0; i < world.gems.count; i++) {
    const g = world.gems.items[gems[i]];
    const dx = g.x - p.x;
    const dy = g.y - p.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD2) {
      bestD2 = d2;
      bestX = dx;
      bestY = dy;
      found = true;
    }
  }
  if (!found) return null;
  const len = Math.hypot(bestX, bestY) || 1;
  return { x: bestX / len, y: bestY / len };
}
