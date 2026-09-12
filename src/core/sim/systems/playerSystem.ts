import type { PlayerStats } from '../../../data/types';
import { FIXED_DT, IFRAME_MS, PLAYER_BASE_SPEED } from '../../../config';
import type { Player } from '../entities/player';

/** Movement, facing, i-frame countdown and health regeneration. */
export function stepPlayer(player: Player, stats: PlayerStats, dt: number): void {
  const { inputX, inputY } = player;
  if (inputX !== 0 || inputY !== 0) {
    // corrosive ground subtracts from the move rather than shoving: standing still in it is free,
    // and it can never reverse a player who is walking out
    const speed = Math.max(40, PLAYER_BASE_SPEED * stats.moveSpeed - player.drag);
    player.x += inputX * speed * dt;
    player.y += inputY * speed * dt;
    // left or right only, and vertical movement leaves it alone, so turning is one deliberate input
    if (inputX > 0) player.facing = 0;
    else if (inputX < 0) player.facing = Math.PI;
  }
  // the pools re-apply it every tick they are stood in, so clearing it here is what ends it
  player.drag = 0;
  if (player.iframesMs > 0) player.iframesMs = Math.max(0, player.iframesMs - dt * 1000);
  if (stats.recovery > 0 && player.hp < stats.maxHealth) {
    player.healFraction += stats.recovery * dt;
    // epsilon: 30 ticks of 2 HP/s sums to 0.9999999999999999, which must still heal a whole point
    if (player.healFraction >= 1 - 1e-9) {
      const whole = Math.floor(player.healFraction + 1e-9);
      player.healFraction -= whole;
      player.hp = Math.min(stats.maxHealth, player.hp + whole);
    }
  }
}

/** Sets the normalised input direction; diagonal input is scaled so it is not faster. */
export function setPlayerInput(player: Player, dx: number, dy: number): void {
  const len = Math.hypot(dx, dy);
  if (len === 0) {
    player.inputX = 0;
    player.inputY = 0;
    return;
  }
  player.inputX = dx / len;
  player.inputY = dy / len;
}

export const PLAYER_IFRAME_MS = IFRAME_MS;
export const PLAYER_STEP_DT = FIXED_DT;
