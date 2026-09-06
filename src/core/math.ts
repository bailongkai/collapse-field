export const TAU = Math.PI * 2;

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function dist2(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.sqrt(dist2(ax, ay, bx, by));
}

/** True when two circles overlap. */
export function circlesOverlap(ax: number, ay: number, ar: number, bx: number, by: number, br: number): boolean {
  const r = ar + br;
  return dist2(ax, ay, bx, by) <= r * r;
}

/**
 * True when a point lies inside a rectangle whose near edge is at (ox, oy), extending `len` along
 * `angle` and `width` across it. Used for the blade sweep.
 */
export function pointInOrientedRect(px: number, py: number, ox: number, oy: number, angle: number, len: number, width: number): boolean {
  const dx = px - ox;
  const dy = py - oy;
  const c = Math.cos(-angle);
  const s = Math.sin(-angle);
  const lx = dx * c - dy * s;
  const ly = dx * s + dy * c;
  return lx >= 0 && lx <= len && ly >= -width / 2 && ly <= width / 2;
}

export function normalize(x: number, y: number): { x: number; y: number } {
  const l = Math.hypot(x, y);
  if (l === 0) return { x: 0, y: 0 };
  return { x: x / l, y: y / l };
}

export function angleOf(x: number, y: number): number {
  return Math.atan2(y, x);
}
