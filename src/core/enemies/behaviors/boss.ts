import type { Enemy } from '../../sim/entities/enemy';
import type { Player } from '../../sim/entities/player';
import type { World } from '../../sim/world';
import { spawnRing } from '../../sim/systems/spawnSystem';
import { chaseStep } from './chase';

const CHASE = 0;
const TELEGRAPH = 1;
const CHARGE = 2;

/**
 * 母舰: a slow chaser that, on a timer, stops and flashes, then charges the player's position at
 * several times its speed, and periodically drops a ring of drones around itself. Both give the
 * fight a rhythm to read instead of a wall of health to grind down.
 */
export function bossStep(world: World, e: Enemy, player: Player, dt: number): void {
  const cfg = e.def!.boss;
  if (!cfg) {
    chaseStep(e, player.x, player.y, dt);
    return;
  }
  const ms = dt * 1000;

  // reinforcements on their own clock, whatever the boss is doing
  e.aiTimer2 -= ms;
  if (e.aiTimer2 <= 0) {
    e.aiTimer2 = cfg.summonEveryMs;
    spawnRing(world, cfg.summon, cfg.summonCount, e.radius + 40, {
      isEvent: false,
      x: e.x,
      y: e.y,
      hpMult: 1,
      dmgMult: e.dmgMult,
    });
  }

  switch (e.aiState) {
    case TELEGRAPH:
      e.aiTimer -= ms;
      e.flashMs = 40;
      if (e.aiTimer <= 0) {
        e.aiState = CHARGE;
        e.aiTimer = cfg.chargeMs;
      }
      return;
    case CHARGE: {
      e.aiTimer -= ms;
      const speed = e.def!.speed * e.speedMult * cfg.chargeSpeedMult;
      e.x += e.dirX * speed * dt;
      e.y += e.dirY * speed * dt;
      if (e.aiTimer <= 0) {
        e.aiState = CHASE;
        e.lifeMs = cfg.chargeEveryMs; // reuse as the charge cooldown
      }
      return;
    }
    default: {
      chaseStep(e, player.x, player.y, dt);
      e.lifeMs -= ms;
      if (e.lifeMs > 0) return;
      const dx = player.x - e.x;
      const dy = player.y - e.y;
      const dist = Math.hypot(dx, dy) || 1;
      e.dirX = dx / dist;
      e.dirY = dy / dist;
      e.aiState = TELEGRAPH;
      e.aiTimer = cfg.telegraphMs;
      world.events.push('telegraph', e.x, e.y, 0, e.defId, true);
    }
  }
}
