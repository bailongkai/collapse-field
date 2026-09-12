import type { Enemy } from '../../sim/entities/enemy';
import type { Player } from '../../sim/entities/player';
import type { World } from '../../sim/world';
import { spawnEnemy } from '../../sim/systems/spawnSystem';

/**
 * The set pieces that tell one boss from another. `bossStep` owns the skeleton every boss shares —
 * chase, telegraph, charge, summon — and everything here runs alongside it on its own clocks, so a
 * boss is a skeleton plus the two or three of these its definition turns on.
 *
 * None of them damages the player directly: area damage is queued on `world.blasts` and the
 * simulation resolves it, because armor, i-frames and god mode are its to apply and not theirs.
 */

const IDLE = 0;
const TELEGRAPH = 1;
const ACTIVE = 2;

/** How much of a hit lands on a boss whose armour is in the way. 1 means it is not. */
export function bossArmourScale(e: Enemy, dirX: number, dirY: number): number {
  const cfg = e.def?.boss;
  const arc = cfg?.rotor ?? cfg?.shield;
  if (!arc) return 1;
  const f = dirX * Math.cos(e.aiAngle) + dirY * Math.sin(e.aiAngle);
  return f <= -Math.cos((arc.arcDeg * Math.PI) / 360) ? arc.frontScale : 1;
}

/**
 * The gun on `aiTimer3`: a salvo of shells lobbed onto the floor ahead of the player. Only one gun
 * extra runs per boss, which is why volley, mine and this one share a clock.
 */
export function bossMortar(world: World, e: Enemy, player: Player, ms: number): void {
  const cfg = e.def!.boss!.mortar!;
  e.aiTimer3 -= ms;
  if (e.aiTimer3 > 0) return;
  if (e.aiState2 === IDLE) {
    // the wind-up is on the boss, not on the ground: the shells are the ground's warning
    e.aiState2 = ACTIVE;
    e.aiTimer3 = cfg.windupMs;
    e.aiTimer5 = cfg.salvo;
    e.flashMs = 60;
    return;
  }
  let alive = 0;
  const list = world.enemies.aliveList();
  for (let i = 0; i < world.enemies.count; i++) if (world.enemies.items[list[i]].defId === cfg.shell) alive++;
  if (alive < cfg.maxShells) {
    const tx = player.x + player.inputX * cfg.leadPx + (world.rng.next() * 2 - 1) * cfg.spreadPx;
    const ty = player.y + player.inputY * cfg.leadPx + (world.rng.next() * 2 - 1) * cfg.spreadPx;
    spawnEnemy(world, cfg.shell, { x: tx, y: ty, dmgMult: e.dmgMult, hpMult: 1 });
  }
  e.aiTimer5 -= 1;
  if (e.aiTimer5 > 0) {
    e.aiTimer3 = cfg.salvoGapMs;
  } else {
    e.aiState2 = IDLE;
    e.aiTimer3 = cfg.intervalMs;
  }
}

/** A ring of damage off the boss itself: the answer is to be somewhere else when it lands. */
export function bossPulse(world: World, e: Enemy, ms: number): void {
  const cfg = e.def!.boss!.pulse!;
  e.aiTimer4 -= ms;
  if (e.aiState2 === TELEGRAPH) {
    e.flashMs = 40;
    if (e.aiTimer4 > 0) return;
    e.aiState2 = IDLE;
    e.aiTimer4 = cfg.everyMs;
    world.blasts.push({ x: e.x, y: e.y, radius: cfg.radius, damage: cfg.damage * e.dmgMult, id: e.defId });
    world.events.push('explode', e.x, e.y, 0, e.defId, true);
    return;
  }
  if (e.aiTimer4 > 0) return;
  e.aiState2 = TELEGRAPH;
  e.aiTimer4 = cfg.telegraphMs;
  world.events.push('telegraph', e.x, e.y, 0, e.defId, true);
}

/** A shell of bodies orbiting the boss, refilled while it lives: a wall that has to be opened. */
export function bossAccretion(world: World, e: Enemy, dt: number, ms: number): void {
  const cfg = e.def!.boss!.accretion!;
  e.aiAngle += ((cfg.degPerSec * Math.PI) / 180) * dt;
  // hold the ring together: the bodies are ordinary enemies, parked on the orbit every tick
  let held = 0;
  const list = world.enemies.aliveList();
  for (let i = 0; i < world.enemies.count; i++) {
    const o = world.enemies.items[list[i]];
    if (o.defId !== cfg.enemy || o.aiTimer2 !== e.serial) continue;
    const a = e.aiAngle + (o.aiAngle || 0);
    o.x = e.x + Math.cos(a) * cfg.radius;
    o.y = e.y + Math.sin(a) * cfg.radius;
    o.facing = a;
    held++;
  }
  e.aiTimer4 -= ms;
  if (e.aiTimer4 > 0 || held >= cfg.count) return;
  e.aiTimer4 = cfg.refillMs;
  const slot = spawnEnemy(world, cfg.enemy, { x: e.x + cfg.radius, y: e.y, dmgMult: e.dmgMult, hpMult: 1 });
  if (slot) {
    // remembered by serial, so a recycled slot never inherits a dead boss's orbit
    slot.aiTimer2 = e.serial;
    slot.aiAngle = (held / Math.max(1, cfg.count)) * Math.PI * 2;
  }
}

/** Breathes: everything is hauled in, then thrown back out. Kiting stops being a policy. */
export function bossTide(world: World, e: Enemy, player: Player, dt: number, ms: number): void {
  const cfg = e.def!.boss!.tide!;
  const dx = player.x - e.x;
  const dy = player.y - e.y;
  const d = Math.hypot(dx, dy) || 1;
  e.aiTimer4 -= ms;
  switch (e.aiState2) {
    case TELEGRAPH:
      e.flashMs = 40;
      if (e.aiTimer4 > 0) return;
      e.aiState2 = ACTIVE;
      e.aiTimer4 = cfg.inhaleMs;
      e.aiTimer5 = 0;
      return;
    case ACTIVE:
      if (d < cfg.range) {
        // flat, not falling off with distance: a tide is not a tractor, it takes everyone equally
        player.x -= (dx / d) * cfg.pullStrength * dt;
        player.y -= (dy / d) * cfg.pullStrength * dt;
      }
      if (e.aiTimer4 > 0) return;
      e.aiState2 = 3;
      e.aiTimer4 = cfg.pushMs;
      return;
    case 3:
      player.x += (dx / d) * cfg.pushStrength * dt;
      player.y += (dy / d) * cfg.pushStrength * dt;
      if (e.aiTimer4 > 0) return;
      e.aiState2 = IDLE;
      e.aiTimer4 = cfg.everyMs;
      return;
    default:
      if (e.aiTimer4 > 0) return;
      e.aiState2 = TELEGRAPH;
      e.aiTimer4 = cfg.telegraphMs;
      world.events.push('telegraph', e.x, e.y, 0, e.defId, true);
  }
}

/** A line thrown down a lane: it hauls the player in and charges them for being on the end of it. */
export function bossHarpoon(world: World, e: Enemy, player: Player, dt: number, ms: number): void {
  const cfg = e.def!.boss!.harpoon!;
  const dx = player.x - e.x;
  const dy = player.y - e.y;
  const d = Math.hypot(dx, dy) || 1;
  e.aiTimer4 -= ms;
  if (e.aiState2 === TELEGRAPH) {
    e.flashMs = 40;
    e.facing = Math.atan2(dy, dx);
    if (e.aiTimer4 > 0) return;
    if (d > cfg.range) {
      e.aiState2 = IDLE;
      e.aiTimer4 = cfg.everyMs;
      return;
    }
    e.aiState2 = ACTIVE;
    e.aiTimer4 = cfg.durationMs;
    world.blasts.push({ x: player.x, y: player.y, radius: 40, damage: cfg.damage * e.dmgMult, id: e.defId });
    return;
  }
  if (e.aiState2 === ACTIVE) {
    player.x -= (dx / d) * cfg.pull * dt;
    player.y -= (dy / d) * cfg.pull * dt;
    if (e.aiTimer4 > 0) return;
    e.aiState2 = IDLE;
    e.aiTimer4 = cfg.everyMs;
    return;
  }
  if (e.aiTimer4 > 0) return;
  e.aiState2 = TELEGRAPH;
  e.aiTimer4 = cfg.telegraphMs;
  world.events.push('telegraph', e.x, e.y, 0, e.defId, true);
}

/**
 * Draws everything towards itself and then goes off. The only attack in the game whose answer is
 * to be far away, which is why the draw and the blast together have to fit inside a screen.
 */
export function bossCollapse(world: World, e: Enemy, player: Player, dt: number, ms: number): void {
  const cfg = e.def!.boss!.collapse!;
  const dx = player.x - e.x;
  const dy = player.y - e.y;
  const d = Math.hypot(dx, dy) || 1;
  e.aiTimer4 -= ms;
  switch (e.aiState2) {
    case TELEGRAPH:
      e.flashMs = 40;
      if (e.aiTimer4 > 0) return;
      e.aiState2 = ACTIVE;
      e.aiTimer4 = cfg.drawMs;
      return;
    case ACTIVE:
      player.x -= (dx / d) * cfg.drawSpeed * dt;
      player.y -= (dy / d) * cfg.drawSpeed * dt;
      e.flashMs = 40;
      if (e.aiTimer4 > 0) return;
      e.aiState2 = IDLE;
      e.aiTimer4 = cfg.everyMs;
      world.blasts.push({ x: e.x, y: e.y, radius: cfg.radius, damage: cfg.damage * e.dmgMult, id: e.defId });
      world.events.push('explode', e.x, e.y, 0, e.defId, true);
      return;
    default:
      if (e.aiTimer4 > 0) return;
      e.aiState2 = TELEGRAPH;
      e.aiTimer4 = cfg.telegraphMs;
      world.events.push('telegraph', e.x, e.y, 0, e.defId, true);
  }
}

/** An armoured arc that turns on its own clock, so the open side is somewhere else in a moment. */
export function bossRotor(e: Enemy, dt: number, ms: number): void {
  const cfg = e.def!.boss!.rotor!;
  const dir = e.aiState2 === 1 ? -1 : 1;
  const spin = ((cfg.spinDegPerSec * (e.enraged ? cfg.enrageSpinMult : 1) * Math.PI) / 180) * dt;
  e.aiAngle += dir * spin;
  e.aiTimer4 -= ms;
  if (e.aiTimer4 <= 0) {
    e.aiTimer4 = cfg.reverseEveryMs;
    e.aiState2 = e.aiState2 === 1 ? 0 : 1;
    e.flashMs = 60;
  }
  e.aiTimer5 -= ms;
  if (e.aiTimer5 <= 0) {
    e.aiTimer5 = cfg.tellEveryMs;
    e.flashMs = 30;
  }
}

/** A shield across the front, turning at a fixed rate: the boss version of the bulwark. */
export function bossShield(e: Enemy, player: Player, dt: number, ms: number): void {
  const cfg = e.def!.boss!.shield!;
  let delta = Math.atan2(player.y - e.y, player.x - e.x) - e.aiAngle;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  const max = ((cfg.turnDegPerSec * Math.PI) / 180) * dt;
  e.aiAngle += Math.max(-max, Math.min(max, delta));
  e.aiTimer5 -= ms;
  if (Math.abs(delta) < 0.2 && e.aiTimer5 <= 0) {
    e.aiTimer5 = cfg.tellEveryMs;
    e.flashMs = 30;
  }
}
