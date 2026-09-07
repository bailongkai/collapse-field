import type { World } from './world';
import { setPlayerInput } from './systems/playerSystem';
import { FIXED_DT_MS } from '../../config';
import { weaponDef } from '../content/registry';

/**
 * A hands-off player for the balance harness: turn into the swing when a directional weapon is
 * about to fire, otherwise back off from a real crowd, otherwise collect the nearest gem, otherwise
 * drift in a slow circle so fresh enemies keep walking into the weapons.
 *
 * The three obvious simpler policies all measure nothing. A motionless player dies in thirty
 * seconds to any wave table; a player who simply flees outruns every chase enemy and ends a
 * ten-minute run at level one with two kills; and a player who only ever backs away from danger
 * spends the whole run with their weapons pointed at the empty side of the screen, which measures
 * the policy rather than the wave table.
 */
export function driveAutopilot(world: World, tick: number): void {
  const p = world.player;

  // 0. aim. Weapons fire to the side the character faces, and facing follows horizontal movement,
  //    so a directional weapon coming off cooldown is worth a moment of turning towards the crowd.
  //    This is the whole skill the weapons ask for, and a policy that never does it under-reports
  //    what the wave table is worth.
  if (aboutToFire(world)) {
    const side = crowdSide(world);
    if (side !== 0) {
      setPlayerInput(p, side, dodgeY(world));
      return;
    }
  }

  // 1. back off only from a real crowd. Fleeing from every single enemy is self-defeating: it
  //    turns the weapons away from the horde and outruns enemies that are slower than the player
  //    anyway, ending a long run with a handful of kills.
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

const AIM_LEAD_TICKS = 10;
const CROWD_RADIUS = 340;

/** Whether a weapon that fires to the side is about to come off cooldown. */
function aboutToFire(world: World): boolean {
  for (const inst of world.weaponInstances) {
    const def = weaponDef(inst.defId);
    if (!DIRECTIONAL.has(def.behavior)) continue;
    if (inst.volleyLeft > 0) return true;
    if (inst.cooldownLeft <= AIM_LEAD_TICKS * FIXED_DT_MS) return true;
  }
  return false;
}

/** Behaviours whose shots go where the character faces, rather than at a target or all round. */
const DIRECTIONAL: ReadonlySet<string> = new Set(['slash', 'stream']);

/** Which side, -1 or 1, holds the weight of the nearby crowd; 0 when nothing is near. */
function crowdSide(world: World): number {
  const p = world.player;
  const r = CROWD_RADIUS;
  const n = world.grid.queryInto(p.x - r, p.y - r, p.x + r, p.y + r, world.queryBuf);
  let bias = 0;
  for (let i = 0; i < n; i++) {
    const e = world.enemies.items[world.queryBuf[i]];
    if (!e.active) continue;
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > r * r || d2 < 1) continue;
    // weight by proximity, and discount enemies almost directly above or below: turning towards
    // them buys nothing because the sweep would pass over their heads
    bias += (dx > 0 ? 1 : -1) * (Math.abs(dx) / Math.sqrt(d2)) / d2;
  }
  return bias > 0 ? 1 : bias < 0 ? -1 : 0;
}

/** The vertical part of a retreat: step off the line the crowd is walking down. */
function dodgeY(world: World): number {
  const p = world.player;
  const danger = 110;
  const n = world.grid.queryInto(p.x - danger, p.y - danger, p.x + danger, p.y + danger, world.queryBuf);
  let away = 0;
  for (let i = 0; i < n; i++) {
    const e = world.enemies.items[world.queryBuf[i]];
    if (!e.active) continue;
    const dy = p.y - e.y;
    const d2 = (p.x - e.x) ** 2 + dy * dy;
    if (d2 > danger * danger || d2 < 1) continue;
    away += dy / d2;
  }
  return away > 0 ? 1 : away < 0 ? -1 : 0;
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
