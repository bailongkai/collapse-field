import type { World } from '../world';
import { spawnPickup } from './pickupSystem';

/** What a collapse is called when it is the thing that hurt the player. */
export const COLLAPSE_SOURCE = 'collapse';

/**
 * Marks a circle of floor and leaves the reward in the middle of it.
 *
 * The direction is drawn from the run's own generator, so where the floor goes is a function of
 * the seed like everything else. It is placed at a distance rather than under the player: the
 * decision it offers is whether to walk in, and a circle drawn around someone's feet is not a
 * decision, it is a bill.
 */
export function openCollapse(world: World, cfg: { radius: number; distance: number; warnMs: number; damage: number; reward: string }, viewW: number, viewH: number): void {
  const a = world.rng.next() * Math.PI * 2;
  const off = placeInView(Math.cos(a) * cfg.distance, Math.sin(a) * cfg.distance, cfg.radius + CLEAR, viewW, viewH);
  const x = world.player.x + off.x;
  const y = world.player.y + off.y;
  world.collapses.push({ x, y, radius: cfg.radius, leftMs: cfg.warnMs, totalMs: cfg.warnMs, damage: cfg.damage, reward: cfg.reward });
  spawnPickup(world, cfg.reward, x, y);
  world.events.push('collapseWarn', x, y, cfg.radius, cfg.reward, true);
}

/** how far outside the circle the player is left standing when it is drawn */
const CLEAR = 60;
/** how far in from the edge of the view the middle of the circle is kept */
const EDGE = 110;

/**
 * Pulls an offset from the player inside what the player can see, without bringing it closer than
 * `minDist`. A warning drawn off the bottom of a landscape screen is a warning nobody was given,
 * and the view is 720 units tall at best; so the short axis is clamped and the distance is made
 * up along the long one.
 */
export function placeInView(dx: number, dy: number, minDist: number, viewW: number, viewH: number): { x: number; y: number } {
  const maxX = Math.max(0, viewW / 2 - EDGE);
  const maxY = Math.max(0, viewH / 2 - EDGE);
  let x = Math.max(-maxX, Math.min(maxX, dx));
  let y = Math.max(-maxY, Math.min(maxY, dy));
  if (Math.hypot(x, y) < minDist) {
    if (maxX >= maxY) x = (dx < 0 ? -1 : 1) * Math.sqrt(Math.max(0, minDist * minDist - y * y));
    else y = (dy < 0 ? -1 : 1) * Math.sqrt(Math.max(0, minDist * minDist - x * x));
  }
  return { x, y };
}

/**
 * Counts every marked circle down and drops the ones that have run out.
 *
 * A collapse takes the ordinary bodies standing on it as well as the reward. That is deliberate
 * twice over: a hazard stacked on top of a crowd is a death nobody could have read, so the hazard
 * removes the crowd it lands on; and it makes the circle something to lead a crowd into, which is
 * a use for it that has nothing to do with the chest. They drop nothing and are not kills, the way
 * a spent bomber is not, because the player did not earn them. Bosses and scenery stay.
 *
 * The player is hurt through `world.blasts`, like every other area attack, so armour, i-frames
 * and god mode apply.
 */
export function stepCollapses(world: World, dtMs: number): void {
  const zones = world.collapses;
  for (let z = zones.length - 1; z >= 0; z--) {
    const zone = zones[z];
    zone.leftMs -= dtMs;
    if (zone.leftMs > 0) continue;

    // announced before the bodies it takes, so the view knows which hole each of them fell into
    world.events.push('collapse', zone.x, zone.y, zone.radius, zone.reward, true);
    const r2 = zone.radius * zone.radius;
    const alive = world.enemies.aliveList();
    for (let i = world.enemies.count - 1; i >= 0; i--) {
      const e = world.enemies.items[alive[i]];
      if (!e.active || !e.def || e.def.bossBar || e.def.behavior === 'prop') continue;
      const dx = e.x - zone.x;
      const dy = e.y - zone.y;
      if (dx * dx + dy * dy > r2) continue;
      world.events.push('swallowed', e.x, e.y, 0, e.defId);
      world.enemies.free(e);
    }
    let lost = false;
    const pickups = world.pickups.aliveList();
    for (let i = world.pickups.count - 1; i >= 0; i--) {
      const p = world.pickups.items[pickups[i]];
      if (!p.active || p.defId !== zone.reward) continue;
      const dx = p.x - zone.x;
      const dy = p.y - zone.y;
      if (dx * dx + dy * dy > r2) continue;
      lost = true;
      world.pickups.free(p);
    }
    // What the player did with the offer, for the telemetry: whether the cache was still lying there
    // (`n` 1) and whether they were still standing on the floor (`big`). The event is an experiment's
    // only way of saying whether anyone goes in, and it has to report the offer turned down as well
    // as the one taken or the number measures the circle's placement rather than the player.
    const ppx = world.player.x - zone.x;
    const ppy = world.player.y - zone.y;
    world.events.push('collapseResult', zone.x, zone.y, lost ? 1 : 0, zone.reward, ppx * ppx + ppy * ppy <= r2);
    world.blasts.push({ x: zone.x, y: zone.y, radius: zone.radius, damage: zone.damage, id: COLLAPSE_SOURCE });
    zones.splice(z, 1);
  }
}
