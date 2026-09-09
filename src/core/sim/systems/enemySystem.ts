import { KNOCKBACK_DECAY, KNOCKBACK_MAX } from '../../../config';
import { chaseStep } from '../../enemies/behaviors/chase';
import { rangedStep } from '../../enemies/behaviors/ranged';
import { dasherStep } from '../../enemies/behaviors/dasher';
import { bossStep } from '../../enemies/behaviors/boss';
import { bomberStep } from '../../enemies/behaviors/bomber';
import { healerStep } from '../../enemies/behaviors/healer';
import { tractorStep } from '../../enemies/behaviors/tractor';
import { nestStep } from '../../enemies/behaviors/nest';
import { blinkStep } from '../../enemies/behaviors/blink';
import { layerStep } from '../../enemies/behaviors/layer';
import type { Enemy } from '../entities/enemy';
import type { Player } from '../entities/player';
import type { World } from '../world';

/**
 * Moves every enemy according to its per-instance behavior and integrates knockback as a decaying
 * velocity, so a hit shoves an enemy back without ever teleporting it.
 */
/**
 * Moves every enemy, and reports the bombers whose fuse ran out this step so the simulation, which
 * owns player damage and enemy death, can resolve the blasts.
 */
export function stepEnemies(world: World, player: Player, dt: number, playerSpeed: number, detonated: Enemy[]): void {
  detonated.length = 0;
  world.enemies.forEach((e) => {
    switch (e.behavior) {
      case 'bomber':
        if (bomberStep(e, player, dt)) detonated.push(e);
        break;
      case 'healer':
        healerStep(world, e, player, dt);
        break;
      case 'tractor':
        tractorStep(e, player, dt);
        break;
      case 'nest':
        nestStep(world, e, dt);
        break;
      case 'blink':
        blinkStep(world, e, player, dt);
        break;
      case 'layer':
        layerStep(world, e, player, dt);
        break;
      case 'prop':
        break;
      case 'line':
        e.x += e.dirX * e.lineSpeed * dt;
        e.y += e.dirY * e.lineSpeed * dt;
        e.lifeMs -= dt * 1000;
        break;
      case 'reaper': {
        // always closes on the player, whatever their move speed
        const speed = Math.max(e.def!.speed, 1.15 * playerSpeed);
        const dx = player.x - e.x;
        const dy = player.y - e.y;
        const len = Math.hypot(dx, dy);
        if (len > 0.001) {
          e.x += (dx / len) * speed * dt;
          e.y += (dy / len) * speed * dt;
          e.facing = Math.atan2(dy, dx);
        }
        break;
      }
      case 'ranged':
        rangedStep(world, e, player, dt);
        break;
      case 'dasher':
        dasherStep(e, player, dt);
        break;
      case 'boss':
        bossStep(world, e, player, dt);
        break;
      case 'chase':
      default:
        chaseStep(e, player.x, player.y, dt);
        break;
    }

    if (e.kbx !== 0 || e.kby !== 0) {
      e.x += e.kbx * dt;
      e.y += e.kby * dt;
      e.kbx *= KNOCKBACK_DECAY;
      e.kby *= KNOCKBACK_DECAY;
      if (Math.abs(e.kbx) < 1) e.kbx = 0;
      if (Math.abs(e.kby) < 1) e.kby = 0;
    }
    if (e.flashMs > 0) e.flashMs = Math.max(0, e.flashMs - dt * 1000);
  });
}

/** Adds a knockback impulse in px/s, scaled by the enemy's resistance and clamped. */
export function applyKnockback(e: Enemy, dirX: number, dirY: number, strength: number): void {
  const resist = e.def?.knockbackResist ?? 0;
  if (resist >= 1) return;
  const mag = strength * (1 - resist);
  e.kbx = Math.max(-KNOCKBACK_MAX, Math.min(KNOCKBACK_MAX, e.kbx + dirX * mag));
  e.kby = Math.max(-KNOCKBACK_MAX, Math.min(KNOCKBACK_MAX, e.kby + dirY * mag));
}
