import type { World } from '../world';
import type { Enemy } from '../entities/enemy';
import type { ChestGrade } from '../../levelup/chest';
import { spawnPickup } from './pickupSystem';

/** What a collapse is called when it is the thing that hurt the player. */
export const COLLAPSE_SOURCE = 'collapse';
/**
 * A cache taken with this much warning left or less pays as a boss chest. The round trip into the
 * circle and out is about two and a half seconds, so a player who waits for the last three is one
 * who has decided to run it close; the bigger chest is what that nerve is worth.
 */
export const COLLAPSE_LATE_MS = 3000;
/** how far from a marked circle a chasing body is drawn towards it, and how strongly */
const CROWD_PULL_RANGE = 640;
const CROWD_PULL = 0.35;
/** a body this close to the circle goes for the cache itself and stands guard over it */
const GUARD_MARGIN = 120;

/** The grade a chest pays at: the stated one, or a boss chest for a cache taken late off a marked floor. */
export function collapseRewardGrade(world: World, pickupId: string, x: number, y: number, base: ChestGrade): ChestGrade {
  for (const zone of world.collapses) {
    if (zone.reward !== pickupId) continue;
    const dx = x - zone.x;
    const dy = y - zone.y;
    if (dx * dx + dy * dy > zone.radius * zone.radius) continue;
    return zone.leftMs <= COLLAPSE_LATE_MS ? 'boss' : base;
  }
  return base;
}

/**
 * Where a chasing body heads while the floor is marked. A body already at the circle goes for the
 * cache and stands over it; the rest of the crowd within range heads part of the way towards the
 * circle, so it thickens around it. The circle used to be empty when it went, forty-eight times
 * out of forty-eight, under every policy tried: a cache with nobody near it costs nothing to take
 * and a circle with nobody on it is nothing to lead a crowd into. The guards are swallowed with
 * the floor if nobody clears them, and swallowed bodies drop nothing, which is the price of
 * leaving the cache alone. The blend for the rest is a blend rather than a destination, so the
 * crowd still comes for the player and the player can still be followed in.
 */
export function crowdTarget(world: World, e: Enemy, out: { x: number; y: number }): { x: number; y: number } {
  const p = world.player;
  out.x = p.x;
  out.y = p.y;
  for (const zone of world.collapses) {
    const dx = zone.x - e.x;
    const dy = zone.y - e.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > CROWD_PULL_RANGE * CROWD_PULL_RANGE) continue;
    const guard = zone.radius + GUARD_MARGIN;
    if (d2 <= guard * guard) {
      out.x = zone.x;
      out.y = zone.y;
    } else {
      out.x = p.x + (zone.x - p.x) * CROWD_PULL;
      out.y = p.y + (zone.y - p.y) * CROWD_PULL;
    }
    return out;
  }
  return out;
}

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
