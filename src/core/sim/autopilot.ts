import type { World } from './world';
import { setPlayerInput } from './systems/playerSystem';
import { FIXED_DT_MS } from '../../config';
import { carriesChest, weaponDef } from '../content/registry';

/**
 * A hands-off player for the balance harness.
 *
 * It steers by scoring sixteen candidate directions each step rather than by following a ladder of
 * if-statements, because every simple policy that was tried here measured the policy instead of the
 * wave table. A motionless player dies in thirty seconds to any wave table. A player who flees
 * outruns every chase enemy and ends a ten-minute run at level one. A player who walks at the
 * nearest enemy walks into the middle of a crowd and dies at three minutes, which left minutes five
 * to fifteen with no instrument pointed at them at all — the late game could not be tuned because
 * nothing ever survived to see it.
 *
 * The score is: avoid walking into bodies, prefer open ground, pick up gems that are on the way,
 * close the distance when the field has thinned out, and turn into the swing when a directional
 * weapon is about to come off cooldown. That last term is the whole skill the weapons ask for; a
 * policy without it spends the run with its weapons pointed at the empty side of the screen.
 *
 * It is an instrument, not a model of a person. It kites better than anyone playing with a thumb on
 * a virtual stick, so its survival times are a ceiling rather than an expectation; what it is good
 * for is comparing two versions of the content under identical play.
 */

const DIRS = 16;
const DIR_X = new Float64Array(DIRS);
const DIR_Y = new Float64Array(DIRS);
for (let i = 0; i < DIRS; i++) {
  const a = (i / DIRS) * Math.PI * 2;
  DIR_X[i] = Math.cos(a);
  DIR_Y[i] = Math.sin(a);
}

/** How far the steering looks for bodies. Beyond this a chase enemy is not a threat this second. */
const SENSE = 260;
/** Anything nearer than this in a candidate direction makes that direction close to unusable. */
const TOUCH = 52;
const MAX_TRACKED = 96;
/** How strongly the previous heading is preferred, in the same units as the other pulls. */
const MOMENTUM = 18;
/**
 * How dearly a body in the way is priced against the pulls that want to go there. Measured over
 * sixteen seeds: at 4 a hands-off run averages 249 s and two seeds reach five minutes; at 8 it
 * averages 566 s and twelve do. Below about 6 the late game is simply not reachable, and the
 * instrument cannot see the half of the run it is meant to be measuring.
 */
const THREAT_W = 8;
/**
 * How far out of its way the policy goes for experience. Raising it is counter-productive: at 45
 * the runs are shorter and the levels lower, because gems come to the player by magnetism anyway
 * and walking to them walks into bodies.
 */
const GEM_W = 14;
/**
 * How much a body carrying a reward is worth going after. A person who can see a supply chest
 * inside an elite goes and kills it; a policy that only reads bodies as obstacles walks past every
 * chest in the run, which measures the kiting rather than the reward.
 */
const PRIZE_W = 35;
/** and its bulk is discounted, because the prize is worth taking a hit for */
const PRIZE_THREAT_SCALE = 0.5;
/** how many bodies within sense count as "no room to fight here" */
const CROWDED = 14;

// scratch, reused every step: the simulation must not allocate inside its own loop
const eDx = new Float64Array(MAX_TRACKED);
const eDy = new Float64Array(MAX_TRACKED);
const eDist = new Float64Array(MAX_TRACKED);
const ePrize = new Uint8Array(MAX_TRACKED);

const AIM_LEAD_TICKS = 10;
const CROWD_RADIUS = 340;
/** Behaviours whose shots go where the character faces, rather than at a target or all round. */
const DIRECTIONAL: ReadonlySet<string> = new Set(['slash', 'stream']);

export function driveAutopilot(world: World, tick: number): void {
  const p = world.player;

  // --- gather the bodies that matter this step, once
  const n = world.grid.queryInto(p.x - SENSE, p.y - SENSE, p.x + SENSE, p.y + SENSE, world.queryBuf);
  let count = 0;
  let nearestD = Infinity;
  let nearestX = 0;
  let nearestY = 0;
  let prizeD = Infinity;
  let prizeX = 0;
  let prizeY = 0;
  for (let i = 0; i < n && count < MAX_TRACKED; i++) {
    const e = world.enemies.items[world.queryBuf[i]];
    if (!e.active) continue;
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    const d = Math.hypot(dx, dy);
    if (d > SENSE || d < 1e-6) continue;
    eDx[count] = dx / d;
    eDy[count] = dy / d;
    // a body's own radius is what the player actually collides with, not its centre
    eDist[count] = Math.max(1, d - e.radius);
    const prize = !!e.def && carriesChest(e.def);
    ePrize[count] = prize ? 1 : 0;
    count++;
    if (d < nearestD) {
      nearestD = d;
      nearestX = dx / d;
      nearestY = dy / d;
    }
    if (prize && d < prizeD) {
      prizeD = d;
      prizeX = dx / d;
      prizeY = dy / d;
    }
  }

  // --- the pulls that do not depend on direction
  const gem = nearestGem(world, 320);
  const side = aboutToFire(world) ? crowdSide(world) : 0;
  // when the field has thinned out, go and find the fight: the weapons only reach 140 px, and a
  // player who keeps their distance collects no experience and never builds anything
  const engage = count === 0 || nearestD > 210;
  // nothing is worth chasing through a wall of bodies
  const safety = Math.max(0, 1 - count / CROWDED);

  let best = 0;
  let bestScore = -Infinity;
  for (let d = 0; d < DIRS; d++) {
    const ux = DIR_X[d];
    const uy = DIR_Y[d];
    let threat = 0;
    for (let i = 0; i < count; i++) {
      // only bodies ahead of this direction are in the way; behind is somebody else's problem
      const facing = ux * eDx[i] + uy * eDy[i];
      if (facing <= 0) continue;
      const dist = eDist[i];
      const w = ePrize[i] ? THREAT_W * PRIZE_THREAT_SCALE : THREAT_W;
      threat += (facing * facing * SENSE * w) / dist;
      if (dist < TOUCH && facing > 0.5) threat += 300;
    }
    let s = -threat;
    if (gem) s += (ux * gem.x + uy * gem.y) * GEM_W;
    if (engage && nearestD < Infinity) s += (ux * nearestX + uy * nearestY) * 22;
    // a chest on legs is worth going after, but only when there is room to fight it. Standing to
    // trade blows in the middle of a full field is how a run ends, prize or no prize.
    if (prizeD < Infinity) s += (ux * prizeX + uy * prizeY) * PRIZE_W * safety;
    // turning costs a step of distance and buys a swing that lands: worth it, but not at any price
    if (side !== 0 && Math.sign(ux) === side) s += Math.abs(ux) * 26;
    // momentum. Without it the best direction flips between two near-equal neighbours every step
    // and the character vibrates on the spot, which is the one thing a crowd never forgives.
    s += (ux * p.inputX + uy * p.inputY) * MOMENTUM;
    // with nothing else to say, drift rather than dither on the spot
    if (count === 0 && !gem) s += Math.cos((tick / 60) * 0.5 - Math.atan2(uy, ux)) * 5;
    if (s > bestScore) {
      bestScore = s;
      best = d;
    }
  }

  setPlayerInput(p, DIR_X[best], DIR_Y[best]);
}

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

/** Which side, -1 or 1, holds the weight of the nearby crowd; 0 when nothing is near. */
function crowdSide(world: World): number {
  const p = world.player;
  const r = CROWD_RADIUS;
  const n = world.grid.queryInto(p.x - r, p.y - r, p.x + r, p.y + r, world.queryBuf2);
  let bias = 0;
  for (let i = 0; i < n; i++) {
    const e = world.enemies.items[world.queryBuf2[i]];
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
