import type { Enemy } from '../../sim/entities/enemy';
import type { Player } from '../../sim/entities/player';
import type { World } from '../../sim/world';
import { spawnHostileBolt } from './ranged';

/**
 * 压制炮台: it walks in slowly and charges a shot the whole time the player is far away, then
 * fires a fan. Step inside its range and the charge visibly drains: it is harmless up close.
 *
 * Every other body is more dangerous the nearer it is, which is where the whole kiting strategy
 * comes from. This one inverts that, so the answer to it is to walk into the crowd — and whether
 * the crowd will allow that is the decision it exists to ask.
 */
export function suppressorStep(world: World, e: Enemy, player: Player, dt: number): void {
  const cfg = e.def!.suppress;
  if (!cfg) return;
  const ms = dt * 1000;
  const dx = player.x - e.x;
  const dy = player.y - e.y;
  const d = Math.hypot(dx, dy) || 1;
  const nx = dx / d;
  const ny = dy / d;
  e.facing = Math.atan2(dy, dx);

  // it always closes, slowly: ignoring it forever is not an option either
  const s = e.def!.speed * e.speedMult * cfg.advanceSpeedMult;
  e.x += nx * s * dt;
  e.y += ny * s * dt;

  // aiTimer is the charge: positive is winding up, negative is cooling down
  if (e.aiTimer < 0) {
    e.aiTimer = Math.min(0, e.aiTimer + ms);
    return;
  }
  if (d <= cfg.armRange) {
    // disarmed, and visibly so: the charge bleeds off faster than it built
    e.aiTimer = Math.max(0, e.aiTimer - ms * cfg.decayMult);
    return;
  }
  e.aiTimer += ms;
  if (e.aiTimer >= cfg.windupMs * cfg.tellAt) e.flashMs = 40;
  if (e.aiTimer < cfg.windupMs) return;

  const base = Math.atan2(ny, nx);
  const spread = (cfg.spreadDeg * Math.PI) / 180;
  for (let i = 0; i < cfg.count; i++) {
    const a = cfg.count === 1 ? base : base - spread / 2 + (spread * i) / (cfg.count - 1);
    spawnHostileBolt(world, e, Math.cos(a), Math.sin(a), cfg.boltSpeed, cfg.boltDamage * e.dmgMult, 2.4);
  }
  e.aiTimer = -cfg.cooldownMs;
}
