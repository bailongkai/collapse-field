/**
 * Axis-aligned solid rectangles, resolved against circles by pushing the circle out along the
 * shallowest axis. Good enough for a handful of containers; not a physics engine and not meant to
 * be one.
 */
export interface ObstacleRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Whether a circle overlaps the rectangle at all. */
export function overlaps(r: ObstacleRect, cx: number, cy: number, radius: number): boolean {
  const nx = Math.max(r.x, Math.min(cx, r.x + r.w));
  const ny = Math.max(r.y, Math.min(cy, r.y + r.h));
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy < radius * radius;
}

/**
 * Pushes a circle out of every rectangle it overlaps and returns the corrected centre. A circle
 * whose centre is inside a rectangle is pushed out the nearest side, which is what keeps a body
 * that spawned inside a wall from being trapped there.
 */
export function resolveCircle(rects: readonly ObstacleRect[], cx: number, cy: number, radius: number, out: { x: number; y: number }): boolean {
  let x = cx;
  let y = cy;
  let moved = false;
  for (const r of rects) {
    const insideX = x > r.x && x < r.x + r.w;
    const insideY = y > r.y && y < r.y + r.h;
    if (insideX && insideY) {
      // centre inside: leave by the nearest side
      const toLeft = x - r.x;
      const toRight = r.x + r.w - x;
      const toTop = y - r.y;
      const toBottom = r.y + r.h - y;
      const m = Math.min(toLeft, toRight, toTop, toBottom);
      if (m === toLeft) x = r.x - radius;
      else if (m === toRight) x = r.x + r.w + radius;
      else if (m === toTop) y = r.y - radius;
      else y = r.y + r.h + radius;
      moved = true;
      continue;
    }
    const nx = Math.max(r.x, Math.min(x, r.x + r.w));
    const ny = Math.max(r.y, Math.min(y, r.y + r.h));
    const dx = x - nx;
    const dy = y - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 >= radius * radius || d2 === 0) continue;
    const d = Math.sqrt(d2);
    const push = radius - d;
    x += (dx / d) * push;
    y += (dy / d) * push;
    moved = true;
  }
  out.x = x;
  out.y = y;
  return moved;
}
