import type { Enemy } from '../../sim/entities/enemy';
import type { Player } from '../../sim/entities/player';
import type { World } from '../../sim/world';
import { spawnEnemy, spawnRing } from '../../sim/systems/spawnSystem';
import { chaseStep } from './chase';
import { spawnHostileBolt } from './ranged';
import { bossAccretion, bossCollapse, bossHarpoon, bossMortar, bossPulse, bossRotor, bossShield, bossTide } from './bossExtras';

const CHASE = 0;
const TELEGRAPH = 1;
const CHARGE = 2;
const FADING = 3;

/**
 * Every boss shares one skeleton — a slow chaser that stops, flashes and charges on a timer, and
 * drops reinforcements around itself — and each gets its own fight from the extras its config
 * turns on: a fan of bolts, mines left where it stood, a pull, a blink-and-strike. The final boss
 * adds an enrage, so a fight that drags on stops being winnable by kiting.
 */
export function bossStep(world: World, e: Enemy, player: Player, dt: number): void {
  const cfg = e.def!.boss;
  if (!cfg) {
    chaseStep(e, player.x, player.y, dt);
    return;
  }
  const ms = dt * 1000;
  e.ageMs += ms;

  if (cfg.final && !e.enraged && e.ageMs >= cfg.final.enrageAfterMs) {
    e.enraged = true;
    e.speedMult *= cfg.final.enrageSpeedMult;
    e.dmgMult *= cfg.final.enrageDmgMult;
    world.events.push('enrage', e.x, e.y, 0, e.defId, true);
  }

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

  const dx = player.x - e.x;
  const dy = player.y - e.y;
  const dist = Math.hypot(dx, dy) || 1;
  const nx = dx / dist;
  const ny = dy / dist;

  // the armour arcs own e.aiAngle and turn on their own clock
  if (cfg.rotor) bossRotor(e, dt, ms);
  else if (cfg.shield) bossShield(e, player, dt, ms);

  // the set piece on aiTimer4/aiTimer5/aiState2: one per boss
  if (cfg.pulse) bossPulse(world, e, ms);
  else if (cfg.tide) bossTide(world, e, player, dt, ms);
  else if (cfg.harpoon) bossHarpoon(world, e, player, dt, ms);
  else if (cfg.collapse) bossCollapse(world, e, player, dt, ms);
  else if (cfg.accretion) bossAccretion(world, e, dt, ms);

  // the gun on aiTimer3: one per boss, which is why these share a clock
  if (cfg.mortar) bossMortar(world, e, player, ms);
  else if (cfg.volley || cfg.mine) {
    e.aiTimer3 -= ms;
    if (e.aiTimer3 <= 0) {
      if (cfg.volley) {
        e.aiTimer3 = cfg.volley.everyMs;
        const base = Math.atan2(ny, nx);
        const spread = (cfg.volley.spreadDeg * Math.PI) / 180;
        for (let i = 0; i < cfg.volley.count; i++) {
          const a = cfg.volley.count === 1 ? base : base - spread / 2 + (spread * i) / (cfg.volley.count - 1);
          spawnHostileBolt(world, e, Math.cos(a), Math.sin(a), cfg.volley.boltSpeed, cfg.volley.boltDamage * e.dmgMult, 2.2);
        }
      } else if (cfg.mine) {
        e.aiTimer3 = cfg.mine.everyMs;
        let mines = 0;
        const alive = world.enemies.aliveList();
        for (let i = 0; i < world.enemies.count; i++) if (world.enemies.items[alive[i]].defId === cfg.mine.enemy) mines++;
        if (mines < cfg.mine.max) spawnEnemy(world, cfg.mine.enemy, { x: e.x, y: e.y, dmgMult: e.dmgMult, hpMult: 1 });
      }
    }
  }
  if (cfg.pull && dist < cfg.pull.range && e.aiState === CHASE) {
    const strength = cfg.pull.strength * (1 - dist / cfg.pull.range);
    player.x -= nx * strength * dt;
    player.y -= ny * strength * dt;
  }

  switch (e.aiState) {
    case FADING:
      e.aiTimer -= ms;
      e.flashMs = 40;
      if (e.aiTimer > 0) return;
      {
        const a = world.rng.next() * Math.PI * 2;
        e.x = player.x + Math.cos(a) * cfg.blink!.distance;
        e.y = player.y + Math.sin(a) * cfg.blink!.distance;
        e.kbx = 0;
        e.kby = 0;
        // reappear and strike: the charge follows the blink without a chase in between
        const bx = player.x - e.x;
        const by = player.y - e.y;
        const bl = Math.hypot(bx, by) || 1;
        e.dirX = bx / bl;
        e.dirY = by / bl;
        e.aiState = TELEGRAPH;
        e.aiTimer = cfg.telegraphMs;
        world.events.push('telegraph', e.x, e.y, 0, e.defId, true);
      }
      return;
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
        if (cfg.blink) e.aiTimer3 = cfg.blink.everyMs;
      }
      return;
    }
    default: {
      chaseStep(e, player.x, player.y, dt);
      if (cfg.blink) {
        e.aiTimer3 -= ms;
        if (e.aiTimer3 <= 0) {
          e.aiState = FADING;
          e.aiTimer = cfg.blink.telegraphMs;
          return;
        }
      }
      e.lifeMs -= ms;
      if (e.lifeMs > 0) return;
      // a boss that charges along its armour makes standing in the shielded arc the punished
      // choice, rather than two separate things to read at once
      const along = cfg.rotor?.chargeAlongFacing ?? cfg.shield?.chargeAlongFacing;
      e.dirX = along ? Math.cos(e.aiAngle) : nx;
      e.dirY = along ? Math.sin(e.aiAngle) : ny;
      e.aiState = TELEGRAPH;
      e.aiTimer = cfg.telegraphMs;
      world.events.push('telegraph', e.x, e.y, 0, e.defId, true);
    }
  }
}
