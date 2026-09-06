import { ENEMY_CAP, SEPARATION_MARGIN, SEPARATION_MAX_PUSH } from '../../../config';
import type { Rng } from '../../rng';
import type { World } from '../world';

const PUSH_FACTOR = 0.6;

const pushX = new Float64Array(ENEMY_CAP);
const pushY = new Float64Array(ENEMY_CAP);
const touched = new Int32Array(ENEMY_CAP);

/**
 * Soft crowd separation. Pushes are accumulated per enemy and applied once, clamped per step, so a
 * body jammed between many neighbours drifts apart instead of being flung.
 *
 * Separation applies to every chase enemy, including those touching the player: a small crowd
 * settles into a ring slightly wider than its bodies, which is why contact damage allows the same
 * slack (see collisionSystem) instead of exempting nearby enemies and letting them stack.
 *
 * Only pairs near the camera are considered — off-screen overlap is invisible and skipping it is
 * what keeps this pass cheap at 500+ enemies.
 */
export function stepSeparation(world: World, rng: Rng, viewW: number, viewH: number): void {
  const { grid, enemies, player } = world;
  const halfW = viewW / 2 + SEPARATION_MARGIN;
  const halfH = viewH / 2 + SEPARATION_MARGIN;
  const minX = player.x - halfW;
  const maxX = player.x + halfW;
  const minY = player.y - halfH;
  const maxY = player.y + halfH;

  const eligible = (id: number): boolean => {
    const e = enemies.items[id];
    if (!e.active || e.behavior !== 'chase') return false;
    return e.x >= minX && e.x <= maxX && e.y >= minY && e.y <= maxY;
  };

  const mark = (id: number): void => {
    if (touched[id] === 0) {
      touched[id] = 1;
      // reuse the scratch slot list; ids are unique so this stays within capacity
      pushX[id] = 0;
      pushY[id] = 0;
    }
  };

  grid.forEachPair((ia, ib) => {
    if (!eligible(ia) || !eligible(ib)) return;
    const a = enemies.items[ia];
    const b = enemies.items[ib];

    let dx = b.x - a.x;
    let dy = b.y - a.y;
    const rr = a.radius + b.radius;
    const d2 = dx * dx + dy * dy;
    if (d2 >= rr * rr) return;
    let d = Math.sqrt(d2);
    if (d < 1e-6) {
      const ang = rng.next() * Math.PI * 2;
      dx = Math.cos(ang);
      dy = Math.sin(ang);
      d = 1;
    } else {
      dx /= d;
      dy /= d;
    }
    const push = (rr - d) * 0.5 * PUSH_FACTOR;
    mark(ia);
    mark(ib);
    pushX[ia] -= dx * push;
    pushY[ia] -= dy * push;
    pushX[ib] += dx * push;
    pushY[ib] += dy * push;
  });

  // apply the accumulated pushes, clamped per enemy per step
  const alive = enemies.aliveList();
  for (let i = 0; i < enemies.count; i++) {
    const id = alive[i];
    if (touched[id] === 0) continue;
    touched[id] = 0;
    let px = pushX[id];
    let py = pushY[id];
    const len = Math.hypot(px, py);
    if (len > SEPARATION_MAX_PUSH) {
      const k = SEPARATION_MAX_PUSH / len;
      px *= k;
      py *= k;
    }
    const e = enemies.items[id];
    e.x += px;
    e.y += py;
  }
}
