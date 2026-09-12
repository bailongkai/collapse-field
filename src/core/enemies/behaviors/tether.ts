import type { Enemy } from '../../sim/entities/enemy';
import type { Player } from '../../sim/entities/player';
import type { World } from '../../sim/world';
import { chaseStep } from './chase';

const PLAYER_RADIUS = 16;

/**
 * 束缚者: they work in pairs. Two of them within range are joined by a taut beam, and walking into
 * the beam shoves the player out of it, so a pair is a moving wall with two ends rather than two
 * bodies with a gap between them.
 *
 * It is the first enemy whose danger lives in the space between two of them, so a crowd has to be
 * read as line segments instead of circles. Killing either end removes the wall.
 */
export function tetherStep(world: World, e: Enemy, player: Player, dt: number): void {
  const cfg = e.def!.tether;
  if (!cfg) return;
  const ms = dt * 1000;
  const speed = e.def!.speed * e.speedMult * cfg.approachSpeedMult;
  chaseStep(e, player.x, player.y, dt, speed);

  // aiTimer2 holds the partner's slot, aiTimer3 its serial, aiTimer the relink clock
  e.aiTimer -= ms;
  let partner: Enemy | null = e.aiTimer2 >= 0 ? world.enemies.items[e.aiTimer2] : null;
  let ok =
    partner !== null &&
    partner.active &&
    partner.serial === e.aiTimer3 &&
    partner.defId === e.defId &&
    (partner.x - e.x) * (partner.x - e.x) + (partner.y - e.y) * (partner.y - e.y) <= cfg.breakRange * cfg.breakRange;

  if (!ok || e.aiTimer <= 0) {
    e.aiTimer = cfg.relinkMs;
    const r = cfg.linkRange;
    const n = world.grid.queryInto(e.x - r, e.y - r, e.x + r, e.y + r, world.queryBuf2);
    let best: Enemy | null = null;
    let bestD2 = r * r;
    for (let i = 0; i < n; i++) {
      const o = world.enemies.items[world.queryBuf2[i]];
      if (!o.active || o.id === e.id || o.defId !== e.defId) continue;
      const d2 = (o.x - e.x) * (o.x - e.x) + (o.y - e.y) * (o.y - e.y);
      if (d2 < bestD2) {
        bestD2 = d2;
        best = o;
      }
    }
    e.aiTimer2 = best ? best.id : -1;
    e.aiTimer3 = best ? best.serial : 0;
    partner = best;
    ok = best !== null;
  }

  // only the lower-id end resolves the beam, so a pair pushes once and not twice
  if (!ok || !partner || e.id > partner.id) return;
  const vx = partner.x - e.x;
  const vy = partner.y - e.y;
  const l2 = vx * vx + vy * vy || 1;
  const t = Math.max(0, Math.min(1, ((player.x - e.x) * vx + (player.y - e.y) * vy) / l2));
  const cx = e.x + vx * t;
  const cy = e.y + vy * t;
  let ox = player.x - cx;
  let oy = player.y - cy;
  let d = Math.hypot(ox, oy);
  if (d >= cfg.beamHalfWidth + PLAYER_RADIUS) return;
  if (d < 1e-3) {
    // dead on the line: pick a side deterministically rather than by luck
    const s = e.id % 2 === 0 ? 1 : -1;
    const l = Math.sqrt(l2);
    ox = (-vy / l) * s;
    oy = (vx / l) * s;
    d = 1;
  }
  player.x += (ox / d) * cfg.push * dt;
  player.y += (oy / d) * cfg.push * dt;
  e.flashMs = 40;
  partner.flashMs = 40;
}

/** The live beams, as pairs of endpoints, for the view. Recomputed from the same links each frame. */
export function tetherBeams(world: World, out: number[]): number[] {
  out.length = 0;
  const alive = world.enemies.aliveList();
  for (let i = 0; i < world.enemies.count; i++) {
    const e = world.enemies.items[alive[i]];
    if (e.behavior !== 'tether' || e.aiTimer2 < 0) continue;
    const p = world.enemies.items[e.aiTimer2];
    if (!p.active || p.serial !== e.aiTimer3 || e.id > p.id) continue;
    out.push(e.x, e.y, p.x, p.y);
  }
  return out;
}
