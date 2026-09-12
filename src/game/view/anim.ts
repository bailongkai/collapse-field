/**
 * Procedural animation for single-frame sprites. Every character and enemy is one image mirrored
 * left or right, so the life in them comes from here: a walk is a bob and a lean driven by the
 * distance covered, an attack is a recoil, a hit is a squash. All of it is pure arithmetic on
 * numbers the view already has, so it costs nothing in the simulation and is easy to test.
 */

/** world units of travel per full bob cycle: a short stride for a chibi */
export const STRIDE = 56;
/** stride bob in units, and the lean into the step in radians */
export const BOB_AMP = 2.6;
export const LEAN_AMP = 0.07;

export interface Pose {
  dy: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
}

/** Advances a walk phase by the distance moved; standing still holds the phase where it is. */
export function advancePhase(phase: number, dist: number): number {
  return (phase + (dist / STRIDE) * Math.PI * 2) % (Math.PI * 2);
}

/**
 * The walk. Bob peaks twice a cycle (each foot), the lean once, so a body rocks as it hops. A
 * body that has stopped eases back to rest through `settle`, 0..1.
 */
export function walkPose(phase: number, moving: number, out: Pose): Pose {
  const bob = Math.abs(Math.sin(phase)) * BOB_AMP * moving;
  out.dy = bob > 0 ? -bob : 0;
  out.rotation = Math.sin(phase) * LEAN_AMP * moving;
  // the hop stretches the body a touch at the top of the bounce
  const s = 1 + (bob / BOB_AMP) * 0.04;
  out.scaleX = 1 / s;
  out.scaleY = s;
  return out;
}

/** A slow breath for a body standing still, `t` in seconds. */
export function idlePose(t: number, out: Pose): Pose {
  const b = Math.sin(t * Math.PI * 2 * 0.9) * 0.015;
  out.dy = 0;
  out.rotation = 0;
  out.scaleX = 1 - b;
  out.scaleY = 1 + b;
  return out;
}

/**
 * The squash of a hit: wide and flat at once, springing back over `ms`. `k` is 1 at the hit and
 * falls to 0; the curve overshoots once so it reads as a bounce and not a shrink.
 */
export function squash(k: number, amount = 0.22): { scaleX: number; scaleY: number } {
  const w = Math.sin(k * Math.PI) * amount;
  return { scaleX: 1 + w, scaleY: 1 - w * 0.8 };
}

export type RecoilKind = 'lunge' | 'kick' | 'pulse';

/**
 * The recoil of a shot, `k` from 1 (the shot) to 0. A blade lunges forward, a gun kicks back, and
 * everything else pulses. `dir` is +1 facing right, -1 facing left.
 */
export function recoil(kind: RecoilKind, k: number, dir: number): { dx: number; scaleX: number; scaleY: number } {
  const e = Math.sin(k * Math.PI);
  switch (kind) {
    case 'lunge':
      return { dx: dir * e * 7, scaleX: 1 + e * 0.16, scaleY: 1 - e * 0.1 };
    case 'kick':
      return { dx: -dir * e * 5, scaleX: 1 - e * 0.08, scaleY: 1 + e * 0.06 };
    default:
      return { dx: 0, scaleX: 1 + e * 0.07, scaleY: 1 + e * 0.07 };
  }
}

/** How a weapon archetype throws the body that fires it. */
export function recoilKindFor(behavior: string): RecoilKind {
  if (behavior === 'slash') return 'lunge';
  if (behavior === 'stream' || behavior === 'aimed') return 'kick';
  return 'pulse';
}

/**
 * Stretch along the direction of travel for a body moving much faster than it walks: the dash of
 * a rusher, the charge of a boss. `ratio` is speed over the definition's speed.
 */
export function dashStretch(ratio: number): number {
  if (ratio <= 1.6) return 0;
  return Math.min(0.28, (ratio - 1.6) * 0.08);
}
