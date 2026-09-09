import type { Enemy } from '../../sim/entities/enemy';
import type { Player } from '../../sim/entities/player';
import type { World } from '../../sim/world';
import { chaseStep } from './chase';

/**
 * 维修工兵: follows at a distance and, on an interval, tops up every enemy within reach. It never
 * heals itself, so the answer to one is always the same — kill it first — which is a priority
 * decision the field did not ask for before.
 */
export function healerStep(world: World, e: Enemy, player: Player, dt: number): void {
  const cfg = e.def!.heal;
  if (!cfg) return;
  const dx = player.x - e.x;
  const dy = player.y - e.y;
  const dist = Math.hypot(dx, dy) || 1;
  if (dist > cfg.keepDistance) chaseStep(e, player.x, player.y, dt);
  else if (dist < cfg.keepDistance * 0.7) {
    const speed = e.def!.speed * e.speedMult * 0.6;
    e.x -= (dx / dist) * speed * dt;
    e.y -= (dy / dist) * speed * dt;
  }
  e.aiTimer2 -= dt * 1000;
  if (e.aiTimer2 > 0) return;
  e.aiTimer2 = cfg.intervalMs;
  const r = cfg.range;
  const n = world.grid.queryInto(e.x - r, e.y - r, e.x + r, e.y + r, world.queryBuf2);
  let healed = 0;
  for (let i = 0; i < n; i++) {
    const o = world.enemies.items[world.queryBuf2[i]];
    if (!o.active || o.id === e.id || o.hp >= o.maxHp) continue;
    const ox = o.x - e.x;
    const oy = o.y - e.y;
    if (ox * ox + oy * oy > r * r) continue;
    o.hp = Math.min(o.maxHp, o.hp + cfg.amount);
    healed++;
  }
  if (healed > 0) world.events.push('heal', e.x, e.y, healed, e.defId);
}
